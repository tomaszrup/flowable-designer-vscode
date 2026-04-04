import * as vscode from 'vscode';
import { mergeFlowableDocumentXml } from './flowable/roundTrip';
import { validateBpmnXml } from './flowable/validation';

import { getImageExportConfig } from './imageExport';
import type { BpmnValidationIssue, WebviewToHostMessage } from './shared/messages';
import { simpleHash } from './shared/hash';

interface MessageHandlerOptions {
	document: vscode.TextDocument;
	webview: vscode.Webview;
	updateWebview: () => Promise<void>;
	getDocumentXml: () => string;
	updateTextDocument: (xml: string) => Promise<void>;
	handleSvgExport: (svg: string) => Promise<void>;
	applyDiagnostics: (uri: vscode.Uri, issues: BpmnValidationIssue[]) => void;
	refreshNavigator: (xml: string) => void;
	getOnDiskHash: () => number;
	setLastWrittenXml: (xml: string) => void;
}

async function handleSaveDocumentMessage(
	message: Extract<WebviewToHostMessage, { type: 'save-document' }>,
	options: MessageHandlerOptions,
): Promise<void> {
	const mergedXml = mergeFlowableDocumentXml(
		message.xml,
		options.getDocumentXml(),
		message.flowableState,
		{ origin: 'designer' },
	);
	options.setLastWrittenXml(mergedXml);
	await options.updateTextDocument(mergedXml);

	if (simpleHash(mergedXml) !== options.getOnDiskHash()) {
		await options.document.save();
	}

	options.refreshNavigator(mergedXml);
	const validateOnSave = vscode.workspace.getConfiguration('flowableBpmnDesigner.validation').get<boolean>('validateOnSave', true);
	if (validateOnSave) {
		options.applyDiagnostics(options.document.uri, validateBpmnXml(mergedXml));
	}

	if (getImageExportConfig().enabled) {
		void Promise.resolve(options.webview.postMessage({ type: 'request-svg' })).catch(() => {});
	}
}

async function handleRunValidationMessage(
	message: Extract<WebviewToHostMessage, { type: 'run-validation' }>,
	options: MessageHandlerOptions,
): Promise<void> {
	const mergedXml = mergeFlowableDocumentXml(
		message.xml,
		options.getDocumentXml(),
		message.flowableState,
		{ origin: 'designer' },
	);
	const issues = validateBpmnXml(mergedXml);
	options.applyDiagnostics(options.document.uri, issues);
	if (issues.length === 0) {
		void vscode.window.showInformationMessage('BPMN validation passed — no issues found.');
		return;
	}
	void vscode.window.showWarningMessage(`BPMN validation found ${issues.length} issue(s). See Problems panel.`);
}

async function toggleSourceEditor(document: vscode.TextDocument): Promise<void> {
	const sourceEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === document.uri.toString());
	if (sourceEditor) {
		await vscode.window.showTextDocument(sourceEditor.document, {
			viewColumn: sourceEditor.viewColumn,
			preserveFocus: false,
		});
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		return;
	}

	void vscode.window.showTextDocument(document.uri, {
		viewColumn: vscode.ViewColumn.Beside,
		preview: false,
	}).then((editor) => {
		void vscode.languages.setTextDocumentLanguage(editor.document, 'xml');
	});
}

async function pickWorkspaceFile(document: vscode.TextDocument, webview: vscode.Webview): Promise<void> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
	const defaultUri = workspaceFolder?.uri ?? vscode.Uri.joinPath(document.uri, '..');
	const result = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Select Script File',
		defaultUri,
	});
	if (!result || result.length === 0) {
		return;
	}

	const relativePath = vscode.workspace.asRelativePath(result[0], false);
	void webview.postMessage({ type: 'file-picked', path: result[0].toString() || relativePath });
}

async function openWorkspaceFile(document: vscode.TextDocument, relativePath: string): Promise<void> {
	let fileUri: vscode.Uri;
	const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relativePath);
	const isAbsoluteFilePath = relativePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(relativePath);
	if (hasScheme) {
		fileUri = vscode.Uri.parse(relativePath, true);
	} else if (isAbsoluteFilePath) {
		fileUri = vscode.Uri.file(relativePath);
	} else {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			void vscode.window.showWarningMessage('No workspace folder found to resolve file path.');
			return;
		}

		fileUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
		if (!vscode.workspace.getWorkspaceFolder(fileUri)) {
			void vscode.window.showWarningMessage('File path must be within the workspace.');
			return;
		}
	}

	try {
		await vscode.workspace.fs.stat(fileUri);
		void vscode.window.showTextDocument(fileUri, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: true,
		});
	} catch {
		void vscode.window.showWarningMessage(`File not found: ${relativePath}`);
	}
}

export async function handleBpmnWebviewMessage(
	message: WebviewToHostMessage,
	options: MessageHandlerOptions,
): Promise<void> {
	switch (message.type) {
		case 'ready':
			await options.updateWebview();
			return;
		case 'save-document':
			await handleSaveDocumentMessage(message, options);
			return;
		case 'svg-export':
			await options.handleSvgExport(message.svg);
			return;
		case 'run-validation':
			await handleRunValidationMessage(message, options);
			return;
		case 'validation-result':
			options.applyDiagnostics(options.document.uri, message.issues);
			return;
		case 'show-error':
			void vscode.window.showErrorMessage(message.message);
			return;
		case 'open-source':
			await toggleSourceEditor(options.document);
			return;
		case 'pick-file':
			await pickWorkspaceFile(options.document, options.webview);
			return;
		case 'open-file':
			if (typeof message.path === 'string' && message.path) {
				await openWorkspaceFile(options.document, message.path);
			}
			return;
	}
}
