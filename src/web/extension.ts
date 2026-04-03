import * as vscode from 'vscode';
import { BpmnEditorProvider } from './bpmnEditorProvider';
import { BPMN_EDITOR_VIEW_TYPE, DEFAULT_BPMN_XML, FLOWABLE_BPMN_LANGUAGE } from './flowableBpmn';
import { registerProcessNavigator } from './processNavigatorProvider';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('flowable-bpmn');

export function activate(context: vscode.ExtensionContext) {
	const provider = BpmnEditorProvider.register(context, diagnosticCollection);

	const navigator = registerProcessNavigator(context);
	context.subscriptions.push(
		provider,
		diagnosticCollection,
		vscode.commands.registerCommand('flowable-bpmn-designer.newDiagram', async () => {
			const document = await vscode.workspace.openTextDocument({
				language: FLOWABLE_BPMN_LANGUAGE,
				content: DEFAULT_BPMN_XML,
			});

			await vscode.commands.executeCommand('vscode.openWith', document.uri, BPMN_EDITOR_VIEW_TYPE);
		}),
		vscode.commands.registerCommand('flowable-bpmn-designer.exportImage', () => {
			BpmnEditorProvider.requestSvgExport();
		}),
		vscode.commands.registerCommand('flowable-bpmn-designer.validate', () => {
			BpmnEditorProvider.requestValidation();
		}),
	);

	// Expose navigator for editor provider to call refresh
	BpmnEditorProvider.setNavigator(navigator);
}

export function deactivate() {
	diagnosticCollection.dispose();
}
