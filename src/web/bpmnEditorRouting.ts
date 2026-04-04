import * as vscode from 'vscode';
import { BPMN_EDITOR_VIEW_TYPE } from './flowableBpmn';

const BPMN_FILE_PATTERN = /(?:\.bpmn20\.xml|\.bpmn2|\.bpmn)$/i;

export function isBpmnFileName(fileName: string): boolean {
	return BPMN_FILE_PATTERN.test(fileName);
}

export function getTabInputUri(input: unknown): vscode.Uri | undefined {
	const candidate = input as { uri?: vscode.Uri } | undefined;
	return candidate?.uri;
}

export function resolveActiveBpmnUri(
	activeTextEditor: { document: { fileName: string; uri: vscode.Uri } } | undefined = vscode.window.activeTextEditor,
	activeTab: { input: unknown } | undefined = vscode.window.tabGroups.activeTabGroup.activeTab,
): vscode.Uri | undefined {
	if (activeTextEditor && isBpmnFileName(activeTextEditor.document.fileName)) {
		return activeTextEditor.document.uri;
	}

	const input = activeTab?.input as { viewType?: string; uri?: vscode.Uri } | undefined;
	if (input?.uri && (input.viewType === BPMN_EDITOR_VIEW_TYPE || isBpmnFileName(input.uri.path))) {
		return input.uri;
	}

	return undefined;
}

export function getActiveBpmnTextDocument(
	activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor,
): vscode.TextDocument | undefined {
	if (activeTextEditor && isBpmnFileName(activeTextEditor.document.fileName)) {
		return activeTextEditor.document;
	}

	return undefined;
}