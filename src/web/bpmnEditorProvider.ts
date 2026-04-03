import * as vscode from 'vscode';
import { handleBpmnWebviewMessage } from './bpmnEditorMessageHandling';
import { BPMN_EDITOR_VIEW_TYPE, DEFAULT_BPMN_XML } from './flowableBpmn';
import { getActiveBpmnDocument, getActiveBpmnEditorSession, markBpmnEditorSessionActive, registerBpmnEditorSession, unregisterBpmnEditorSession } from './bpmnEditorSessions';
import { extractFlowableDocumentState } from './flowable/roundTrip';
import { createEmptyFlowableState } from './flowable/types';
import { validateBpmnXml } from './flowable/validation';
import { getWebviewHtml } from './getWebviewHtml';

import { addOverlayToSvg, getImageExportConfig } from './imageExport';
import type { BpmnValidationIssue, WebviewToHostMessage } from './shared/messages';
import type { ProcessNavigatorProvider } from './processNavigatorProvider';
import { simpleHash } from './shared/hash';

export class BpmnEditorProvider implements vscode.CustomTextEditorProvider {
	private static diagnosticCollection: vscode.DiagnosticCollection;
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
		const session = getActiveBpmnEditorSession();
		if (!session) {
			void vscode.window.showWarningMessage('No active BPMN editor.');
			return;
		}
		void Promise.resolve(session.webview.postMessage({ type: 'request-svg' })).catch(() => {});
	}

	public static requestValidation(): void {
		const session = getActiveBpmnEditorSession();
		if (session) {
			void Promise.resolve(session.webview.postMessage({ type: 'request-validation' })).catch(() => {
				void vscode.window.showWarningMessage('Unable to contact the active BPMN editor.');
			});
			return;
		}

		const document = getActiveBpmnDocument();
		if (!document) {
			void vscode.window.showWarningMessage('No active BPMN editor.');
			return;
		}
		const xml = document.getText();
		const issues = validateBpmnXml(xml);
		BpmnEditorProvider.applyDiagnostics(document.uri, issues);
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

		registerBpmnEditorSession(document, webviewPanel.webview);

		let lastWrittenXml = '';
		let onDiskHash = simpleHash(this.getDocumentXml(document));

		const updateWebview = async () => {
			const currentXml = this.getDocumentXml(document);
			if (currentXml === lastWrittenXml) {
				return;
			}

			const minimapEnabled = vscode.workspace.getConfiguration('flowableBpmnDesigner.editor').get<boolean>('minimap', false);
			let flowableState = createEmptyFlowableState();
			try {
				flowableState = extractFlowableDocumentState(currentXml);
			} catch {
				// Keep forwarding the current XML so the webview can surface the import/parsing error.
			}
			try {
				await webviewPanel.webview.postMessage({
					type: 'load-document',
					xml: currentXml,
					flowableState,
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
				markBpmnEditorSessionActive(document, webviewPanel.webview);
			}
		});

		// Track whether the source text editor is visible alongside the designer
		const notifySourceVisibility = () => {
			const visible = vscode.window.visibleTextEditors.some(
				e => e.document.uri.toString() === document.uri.toString()
			);
			void webviewPanel.webview.postMessage({ type: 'source-visible', visible });
		};
		const visibleEditorsSubscription = vscode.window.onDidChangeVisibleTextEditors(() => {
			notifySourceVisibility();
		});

		const saveSubscription = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
			if (savedDoc.uri.toString() === document.uri.toString()) {
				onDiskHash = simpleHash(savedDoc.getText());
			}
		});

		const fileWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(vscode.Uri.joinPath(document.uri, '..'), '*')
		);
		const fileChangeSubscription = fileWatcher.onDidChange((uri) => {
			if (uri.toString() === document.uri.toString()) {
				// Wrap in Promise.resolve to ensure .catch() is available (Thenable may not implement it)
				Promise.resolve(vscode.workspace.fs.readFile(uri)).then((content) => {
					onDiskHash = simpleHash(new TextDecoder().decode(content));
				}).catch(() => { /* file may have been deleted or inaccessible */ });
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			saveSubscription.dispose();
			visibleEditorsSubscription.dispose();
			fileWatcher.dispose();
			fileChangeSubscription.dispose();
			unregisterBpmnEditorSession(document, webviewPanel.webview);
			BpmnEditorProvider.diagnosticCollection.delete(document.uri);
		});

		webviewPanel.webview.onDidReceiveMessage(async (message: WebviewToHostMessage) => {
			try {
				await handleBpmnWebviewMessage(message, {
					document,
					webview: webviewPanel.webview,
					updateWebview,
					getDocumentXml: () => this.getDocumentXml(document),
					updateTextDocument: (xml) => this.updateTextDocument(document, xml),
					handleSvgExport: (svg) => this.handleSvgExport(document, svg),
					applyDiagnostics: BpmnEditorProvider.applyDiagnostics,
					refreshNavigator: (xml) => BpmnEditorProvider.navigator?.refresh(xml),
					getOnDiskHash: () => onDiskHash,
					setLastWrittenXml: (xml) => {
						lastWrittenXml = xml;
					},
				});
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'BPMN editor operation failed.');
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