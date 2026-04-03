import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeState = vi.hoisted(() => ({
	window: {
		activeTextEditor: undefined,
		tabGroups: {
			activeTabGroup: {
				activeTab: undefined,
			},
		},
	},
}));

vi.mock('vscode', () => ({
	window: vscodeState.window,
}));

import { getActiveBpmnTextDocument, getTabInputUri, isBpmnFileName, resolveActiveBpmnUri } from '../../bpmnEditorRouting';

describe('bpmn editor routing helpers', () => {
	beforeEach(() => {
		vscodeState.window.activeTextEditor = undefined;
		vscodeState.window.tabGroups.activeTabGroup.activeTab = undefined;
	});

	it('recognizes supported BPMN file names', () => {
		expect(isBpmnFileName('/tmp/process.bpmn')).toBe(true);
		expect(isBpmnFileName('/tmp/process.bpmn2')).toBe(true);
		expect(isBpmnFileName('/tmp/process.bpmn20.xml')).toBe(true);
		expect(isBpmnFileName('/tmp/PROCESS.BPMN')).toBe(true);
		expect(isBpmnFileName('/tmp/process.xml')).toBe(false);
	});

	it('returns a tab input uri when present', () => {
		const uri = { path: '/workspace/process.bpmn', toString: () => 'process' };

		expect(getTabInputUri({ uri } as never)).toBe(uri);
		expect(getTabInputUri({ path: '/workspace/process.bpmn' } as never)).toBeUndefined();
		expect(getTabInputUri(undefined)).toBeUndefined();
	});

	it('prefers the active BPMN text editor document', () => {
		const activeTextEditor = {
			document: {
				fileName: '/workspace/active.bpmn',
				uri: { path: '/workspace/active.bpmn', toString: () => 'active' },
			},
		};
		const activeTab = {
			input: {
				viewType: 'flowable-bpmn-designer.editor',
				uri: { path: '/workspace/background.bpmn', toString: () => 'background' },
			},
		};

		expect(resolveActiveBpmnUri(activeTextEditor as never, activeTab as never)?.path).toBe('/workspace/active.bpmn');
	});

	it('uses the active BPMN custom editor tab when no BPMN text editor is focused', () => {
		const activeTab = {
			input: {
				viewType: 'flowable-bpmn-designer.editor',
				uri: { path: '/workspace/diagram.bpmn', toString: () => 'diagram' },
			},
		};

		expect(resolveActiveBpmnUri(undefined, activeTab as never)?.path).toBe('/workspace/diagram.bpmn');
	});

	it('uses a BPMN tab uri even when the tab is not the custom editor', () => {
		const activeTab = {
			input: {
				viewType: 'other.editor',
				uri: { path: '/workspace/diagram.bpmn2', toString: () => 'diagram' },
			},
		};

		expect(resolveActiveBpmnUri(undefined, activeTab as never)?.path).toBe('/workspace/diagram.bpmn2');
	});

	it('returns undefined when neither the editor nor tab targets a BPMN file', () => {
		const activeTextEditor = {
			document: {
				fileName: '/workspace/readme.md',
				uri: { path: '/workspace/readme.md', toString: () => 'readme' },
			},
		};
		const activeTab = {
			input: {
				viewType: 'other.editor',
				uri: { path: '/workspace/readme.md', toString: () => 'readme' },
			},
		};

		expect(resolveActiveBpmnUri(activeTextEditor as never, activeTab as never)).toBeUndefined();
	});

	it('returns the active BPMN text document only for BPMN editors', () => {
		const activeTextEditor = {
			document: {
				fileName: '/workspace/diagram.bpmn20.xml',
				uri: { path: '/workspace/diagram.bpmn20.xml', toString: () => 'diagram' },
			},
		};
		const nonBpmnTextEditor = {
			document: {
				fileName: '/workspace/readme.md',
				uri: { path: '/workspace/readme.md', toString: () => 'readme' },
			},
		};

		expect(getActiveBpmnTextDocument(activeTextEditor as never)?.fileName).toBe('/workspace/diagram.bpmn20.xml');
		expect(getActiveBpmnTextDocument(nonBpmnTextEditor as never)).toBeUndefined();
		expect(getActiveBpmnTextDocument()).toBeUndefined();
	});

	it('reads active editor and tab defaults from the mocked vscode window', () => {
		vscodeState.window.activeTextEditor = {
			document: {
				fileName: '/workspace/default-editor.bpmn',
				uri: { path: '/workspace/default-editor.bpmn', toString: () => 'default-editor' },
			},
		} as never;

		expect(resolveActiveBpmnUri()?.path).toBe('/workspace/default-editor.bpmn');
		expect(getActiveBpmnTextDocument()?.fileName).toBe('/workspace/default-editor.bpmn');

		vscodeState.window.activeTextEditor = undefined;
		vscodeState.window.tabGroups.activeTabGroup.activeTab = {
			input: {
				viewType: 'flowable-bpmn-designer.editor',
				uri: { path: '/workspace/default-tab.bpmn', toString: () => 'default-tab' },
			},
		} as never;

		expect(resolveActiveBpmnUri()?.path).toBe('/workspace/default-tab.bpmn');
	});
});