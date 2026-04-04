import { beforeEach, describe, expect, test, vi } from 'vitest';

const resolveActiveBpmnUri = vi.fn();
const getActiveBpmnTextDocument = vi.fn();

vi.mock('vscode', () => ({}));
vi.mock('../../bpmnEditorRouting', () => ({
	resolveActiveBpmnUri: (...args: unknown[]) => resolveActiveBpmnUri(...args),
	getActiveBpmnTextDocument: (...args: unknown[]) => getActiveBpmnTextDocument(...args),
}));

let sessions: typeof import('../../bpmnEditorSessions');

describe('bpmn editor sessions', () => {

	beforeEach(async () => {
		vi.resetModules();
		sessions = await import('../../bpmnEditorSessions');
		resolveActiveBpmnUri.mockReset();
		getActiveBpmnTextDocument.mockReset();
	});

	test('keeps split editors for the same document as distinct sessions', () => {
		const document = { uri: { toString: () => 'file:///diagram.bpmn' } };
		const firstWebview = {};
		const secondWebview = {};

		sessions.registerBpmnEditorSession(document as never, firstWebview as never);
		sessions.registerBpmnEditorSession(document as never, secondWebview as never);
		resolveActiveBpmnUri.mockReturnValue(document.uri);

		expect(sessions.getActiveBpmnEditorSession()?.webview).toBe(secondWebview);
	});

	test('falls back to another open session when the last active editor closes', () => {
		const document = { uri: { toString: () => 'file:///diagram.bpmn' } };
		const firstWebview = {};
		const secondWebview = {};

		sessions.registerBpmnEditorSession(document as never, firstWebview as never);
		sessions.registerBpmnEditorSession(document as never, secondWebview as never);
		sessions.markBpmnEditorSessionActive(document as never, secondWebview as never);
		sessions.unregisterBpmnEditorSession(document as never, secondWebview as never);

		expect(sessions.getActiveBpmnEditorSession()?.webview).toBe(firstWebview);
	});
});