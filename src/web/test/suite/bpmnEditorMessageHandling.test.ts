import { describe, expect, test, vi, beforeEach } from 'vitest';
import type * as vscode from 'vscode';

const vscodeMocks = vi.hoisted(() => ({
	showOpenDialog: vi.fn(),
	showWarningMessage: vi.fn(),
	showTextDocument: vi.fn(),
	showInformationMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	setTextDocumentLanguage: vi.fn(),
	executeCommand: vi.fn(),
	getWorkspaceFolder: vi.fn(),
	asRelativePath: vi.fn(),
	getConfiguration: vi.fn(() => ({ get: vi.fn() })),
	stat: vi.fn(),
}));

vi.mock('vscode', () => ({
	window: {
		showOpenDialog: vscodeMocks.showOpenDialog,
		showWarningMessage: vscodeMocks.showWarningMessage,
		showTextDocument: vscodeMocks.showTextDocument,
		showInformationMessage: vscodeMocks.showInformationMessage,
		showErrorMessage: vscodeMocks.showErrorMessage,
		visibleTextEditors: [],
	},
	workspace: {
		getWorkspaceFolder: vscodeMocks.getWorkspaceFolder,
		workspaceFolders: undefined,
		asRelativePath: vscodeMocks.asRelativePath,
		getConfiguration: vscodeMocks.getConfiguration,
		fs: {
			stat: vscodeMocks.stat,
		},
	},
	Uri: {
		joinPath: (base: { path?: string }, ...segments: string[]) => ({
			path: [base.path || '', ...segments].join('/'),
		}),
		parse: (value: string) => ({ toString: () => value }),
		file: (value: string) => ({ fsPath: value, toString: () => value }),
	},
	ViewColumn: {
		Beside: 2,
	},
	commands: {
		executeCommand: vscodeMocks.executeCommand,
	},
	languages: {
		setTextDocumentLanguage: vscodeMocks.setTextDocumentLanguage,
	},
}));

import { handleBpmnWebviewMessage } from '../../bpmnEditorMessageHandling';

function createUri(path: string): vscode.Uri {
	return {
		path,
		toString: () => `file://${path}`,
	} as unknown as vscode.Uri;
}

function createOptions(webview: vscode.Webview, documentUri: vscode.Uri) {
	return {
		document: { uri: documentUri } as vscode.TextDocument,
		webview,
		updateWebview: vi.fn(),
		getDocumentXml: vi.fn(() => ''),
		updateTextDocument: vi.fn(),
		handleSvgExport: vi.fn(),
		applyDiagnostics: vi.fn(),
		refreshNavigator: vi.fn(),
		getOnDiskHash: vi.fn(() => 0),
		setLastWrittenXml: vi.fn(),
	};
}

describe('handleBpmnWebviewMessage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('posts a workspace-relative file reference for picked files', async () => {
		const workspaceUri = createUri('/workspace');
		const documentUri = createUri('/workspace/diagram.bpmn');
		const selectedUri = createUri('/workspace/scripts/init.groovy');
		const webview = { postMessage: vi.fn() } as unknown as vscode.Webview;

		vscodeMocks.getWorkspaceFolder.mockImplementation((uri: vscode.Uri) => {
			if (uri.toString() === documentUri.toString() || uri.toString() === selectedUri.toString()) {
				return { uri: workspaceUri };
			}
			return undefined;
		});
		vscodeMocks.showOpenDialog.mockResolvedValue([selectedUri]);
		vscodeMocks.asRelativePath.mockReturnValue('scripts/init.groovy');

		await handleBpmnWebviewMessage({ type: 'pick-file' }, createOptions(webview, documentUri));

		expect(webview.postMessage).toHaveBeenCalledWith({ type: 'file-picked', path: 'scripts/init.groovy' });
		expect(vscodeMocks.showWarningMessage).not.toHaveBeenCalled();
	});

	test('rejects files outside the current workspace folder', async () => {
		const currentWorkspaceUri = createUri('/workspace');
		const otherWorkspaceUri = createUri('/other-workspace');
		const documentUri = createUri('/workspace/diagram.bpmn');
		const selectedUri = createUri('/other-workspace/scripts/init.groovy');
		const webview = { postMessage: vi.fn() } as unknown as vscode.Webview;

		vscodeMocks.getWorkspaceFolder.mockImplementation((uri: vscode.Uri) => {
			if (uri.toString() === documentUri.toString()) {
				return { uri: currentWorkspaceUri };
			}
			if (uri.toString() === selectedUri.toString()) {
				return { uri: otherWorkspaceUri };
			}
			return undefined;
		});
		vscodeMocks.showOpenDialog.mockResolvedValue([selectedUri]);

		await handleBpmnWebviewMessage({ type: 'pick-file' }, createOptions(webview, documentUri));

		expect(webview.postMessage).not.toHaveBeenCalled();
		expect(vscodeMocks.showWarningMessage).toHaveBeenCalledWith('Selected file must be inside the current workspace folder.');
	});
});