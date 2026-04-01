import * as vscode from 'vscode';
import { BPMN_EDITOR_VIEW_TYPE, DEFAULT_BPMN_XML } from './flowableBpmn';
import { extractFlowableDocumentState, mergeFlowableDocumentXml } from './flowable/roundTrip';
import { validateBpmnXml } from './flowable/validation';
import { getWebviewHtml } from './getWebviewHtml';
import type { BpmnValidationIssue, WebviewToHostMessage } from './shared/messages';
import type { ProcessNavigatorProvider } from './processNavigatorProvider';

interface ImageOverlayConfig {
	enabled: boolean;
	showProcessKey: boolean;
	showNamespace: boolean;
	showFilename: boolean;
	showDate: boolean;
	color: string;
	backgroundColor: string;
}

function getImageExportConfig(): { enabled: boolean; format: string; overlay: ImageOverlayConfig } {
	const config = vscode.workspace.getConfiguration('flowableBpmnDesigner.imageExport');
	return {
		enabled: config.get<boolean>('enabled', false),
		format: config.get<string>('format', 'svg'),
		overlay: {
			enabled: config.get<boolean>('overlay.enabled', false),
			showProcessKey: config.get<boolean>('overlay.showProcessKey', true),
			showNamespace: config.get<boolean>('overlay.showNamespace', true),
			showFilename: config.get<boolean>('overlay.showFilename', true),
			showDate: config.get<boolean>('overlay.showDate', true),
			color: config.get<string>('overlay.color', '#999999'),
			backgroundColor: config.get<string>('overlay.backgroundColor', '#ffffff'),
		},
	};
}

function addOverlayToSvg(svg: string, overlay: ImageOverlayConfig, processKey: string, targetNamespace: string, filename: string): string {
	if (!overlay.enabled) {
		return svg;
	}

	const lines: string[] = [];
	if (overlay.showProcessKey && processKey) { lines.push(`Key: ${processKey}`); }
	if (overlay.showNamespace && targetNamespace) { lines.push(`NS: ${targetNamespace}`); }
	if (overlay.showFilename && filename) { lines.push(`File: ${filename}`); }
	if (overlay.showDate) { lines.push(`Date: ${new Date().toISOString().split('T')[0]}`); }

	if (lines.length === 0) { return svg; }

	const lineHeight = 16;
	const padding = 8;
	const textWidth = Math.max(...lines.map(l => l.length * 7)) + padding * 2;
	const textHeight = lines.length * lineHeight + padding * 2;

	const overlayGroup = `<g transform="translate(10, 10)">
<rect width="${textWidth}" height="${textHeight}" fill="${escapeAttr(overlay.backgroundColor)}" stroke="${escapeAttr(overlay.color)}" stroke-width="0.5" rx="3" opacity="0.9"/>
${lines.map((line, i) => `<text x="${padding}" y="${padding + (i + 1) * lineHeight - 3}" font-family="Arial, sans-serif" font-size="11" fill="${escapeAttr(overlay.color)}">${escapeXmlText(line)}</text>`).join('\n')}
</g>`;

	// Insert before closing </svg>
	return svg.replace(/<\/svg>\s*$/, `${overlayGroup}\n</svg>`);
}

function escapeAttr(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXmlText(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class BpmnEditorProvider implements vscode.CustomTextEditorProvider {
	private static activeWebview: vscode.Webview | undefined;
	private static activeDocument: vscode.TextDocument | undefined;
	private static diagnosticCollection: vscode.DiagnosticCollection;
	private static pendingSvgResolve: ((svg: string) => void) | undefined;
	private static navigator: ProcessNavigatorProvider | undefined;

	public static setNavigator(nav: ProcessNavigatorProvider): void {
		BpmnEditorProvider.navigator = nav;
	}

	public static register(context: vscode.ExtensionContext, diagnostics: vscode.DiagnosticCollection): vscode.Disposable {
		BpmnEditorProvider.diagnosticCollection = diagnostics;
		const provider = new BpmnEditorProvider(context);

		return vscode.window.registerCustomEditorProvider(BPMN_EDITOR_VIEW_TYPE, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		});
	}

	public static requestSvgExport(): void {
		if (!BpmnEditorProvider.activeWebview) {
			void vscode.window.showWarningMessage('No active BPMN editor.');
			return;
		}
			void Promise.resolve(BpmnEditorProvider.activeWebview.postMessage({ type: 'request-svg' })).catch(() => {});
	}

	public static requestValidation(): void {
		if (!BpmnEditorProvider.activeDocument) {
			void vscode.window.showWarningMessage('No active BPMN editor.');
			return;
		}
		const xml = BpmnEditorProvider.activeDocument.getText();
		const issues = validateBpmnXml(xml);
		BpmnEditorProvider.applyDiagnostics(BpmnEditorProvider.activeDocument.uri, issues);
		if (issues.length === 0) {
			void vscode.window.showInformationMessage('BPMN validation passed — no issues found.');
		} else {
			void vscode.window.showWarningMessage(`BPMN validation found ${issues.length} issue(s). See Problems panel.`);
		}
	}

	private static applyDiagnostics(uri: vscode.Uri, issues: BpmnValidationIssue[]): void {
		const diagnostics: vscode.Diagnostic[] = issues.map(issue => {
			const severity = issue.severity === 'error'
				? vscode.DiagnosticSeverity.Error
				: vscode.DiagnosticSeverity.Warning;
			const range = new vscode.Range(0, 0, 0, 0);
			const diag = new vscode.Diagnostic(range, issue.message, severity);
			diag.source = 'Flowable BPMN';
			if (issue.elementId) {
				diag.code = issue.elementId;
			}
			return diag;
		});
		BpmnEditorProvider.diagnosticCollection.set(uri, diagnostics);
	}

	private constructor(private readonly context: vscode.ExtensionContext) {}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel
	): Promise<void> {
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this.context.extensionUri,
				vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
			],
		};
		webviewPanel.webview.html = getWebviewHtml(webviewPanel.webview, this.context.extensionUri);

		BpmnEditorProvider.activeWebview = webviewPanel.webview;
		BpmnEditorProvider.activeDocument = document;

		let lastWrittenXml = '';

		const updateWebview = async () => {
			const currentXml = this.getDocumentXml(document);
			if (currentXml === lastWrittenXml) {
				return;
			}

			const minimapEnabled = vscode.workspace.getConfiguration('flowableBpmnDesigner.editor').get<boolean>('minimap', false);
			try {
				await webviewPanel.webview.postMessage({
					type: 'load-document',
					xml: currentXml,
					flowableState: extractFlowableDocumentState(currentXml),
					minimapEnabled,
				});
				lastWrittenXml = currentXml;
			} catch {
				// Webview may have been disposed
			}
		};

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() !== document.uri.toString()) {
				return;
			}

			void updateWebview();
		});

		webviewPanel.onDidChangeViewState(() => {
			if (webviewPanel.active) {
				BpmnEditorProvider.activeWebview = webviewPanel.webview;
				BpmnEditorProvider.activeDocument = document;
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			if (BpmnEditorProvider.activeWebview === webviewPanel.webview) {
				BpmnEditorProvider.activeWebview = undefined;
				BpmnEditorProvider.activeDocument = undefined;
			}
			BpmnEditorProvider.diagnosticCollection.delete(document.uri);
		});

		webviewPanel.webview.onDidReceiveMessage(async (message: WebviewToHostMessage) => {
			switch (message.type) {
				case 'ready': {
					await updateWebview();
					break;
				}
				case 'save-document': {
					const mergedXml = mergeFlowableDocumentXml(message.xml, this.getDocumentXml(document), message.flowableState);
					lastWrittenXml = mergedXml;
					await this.updateTextDocument(document, mergedXml);

					// Refresh navigator tree
					BpmnEditorProvider.navigator?.refresh(mergedXml);

					// Auto-validate on save
					const validateOnSave = vscode.workspace.getConfiguration('flowableBpmnDesigner.validation').get<boolean>('validateOnSave', true);
					if (validateOnSave) {
						const issues = validateBpmnXml(mergedXml);
						BpmnEditorProvider.applyDiagnostics(document.uri, issues);
					}

					// Auto-export image on save
					const exportConfig = getImageExportConfig();
					if (exportConfig.enabled) {
						void Promise.resolve(webviewPanel.webview.postMessage({ type: 'request-svg' })).catch(() => {});
					}
					break;
				}
				case 'svg-export': {
					if (BpmnEditorProvider.pendingSvgResolve) {
						BpmnEditorProvider.pendingSvgResolve(message.svg);
						BpmnEditorProvider.pendingSvgResolve = undefined;
					} else {
						await this.handleSvgExport(document, message.svg);
					}
					break;
				}
				case 'validation-result': {
					BpmnEditorProvider.applyDiagnostics(document.uri, message.issues);
					break;
				}
				case 'show-error': {
					void vscode.window.showErrorMessage(message.message);
					break;
				}
				case 'open-source': {
					void vscode.window.showTextDocument(document.uri, {
						viewColumn: vscode.ViewColumn.Beside,
						preview: false,
					}).then(editor => {
						void vscode.languages.setTextDocumentLanguage(editor.document, 'xml');
					});
					break;
				}
			}
		});
	}

	private async handleSvgExport(document: vscode.TextDocument, svg: string): Promise<void> {
		const exportConfig = getImageExportConfig();

		// Extract process key and namespace for overlay
		const xml = this.getDocumentXml(document);
		const state = extractFlowableDocumentState(xml);
		const processKey = Object.values(state.elements).find(el => el.type === 'process')?.id || '';
		const targetNamespace = state.targetNamespace || '';
		const filename = document.uri.path.split('/').pop() || '';

		const finalSvg = addOverlayToSvg(svg, exportConfig.overlay, processKey, targetNamespace, filename);

		// Write SVG file alongside the BPMN file
		const bpmnUri = document.uri;
		let svgPath = bpmnUri.path.replace(/\.(bpmn2?|bpmn20\.xml)$/i, '.svg');
		if (svgPath === bpmnUri.path) {
			// Regex didn't match — append .svg as fallback
			svgPath = bpmnUri.path + '.svg';
		}
		const svgUri = bpmnUri.with({ path: svgPath });

		try {
			await vscode.workspace.fs.writeFile(svgUri, new TextEncoder().encode(finalSvg));
			void vscode.window.showInformationMessage(`Diagram exported to ${svgPath.split('/').pop()}`);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`Failed to export diagram: ${msg}`);
		}
	}

	private getDocumentXml(document: vscode.TextDocument): string {
		const text = document.getText();
		return text.trim().length > 0 ? text : DEFAULT_BPMN_XML;
	}

	private async updateTextDocument(document: vscode.TextDocument, xml: string): Promise<void> {
		if (xml === document.getText()) {
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		const lastLine = document.lineCount - 1;
		const range = new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);

		edit.replace(document.uri, range, xml);
		await vscode.workspace.applyEdit(edit);
	}
}