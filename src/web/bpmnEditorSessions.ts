import * as vscode from 'vscode';
import { getActiveBpmnTextDocument, resolveActiveBpmnUri } from './bpmnEditorRouting';

interface BpmnEditorSession {
	id: string;
	document: vscode.TextDocument;
	webview: vscode.Webview;
}

const sessions = new Map<string, BpmnEditorSession>();
const documentSessionIds = new Map<string, string[]>();
const webviewSessionIds = new WeakMap<vscode.Webview, string>();
let sessionIdCounter = 0;
let lastActiveSessionId: string | undefined;

function getDocumentKey(document: vscode.TextDocument): string {
	return document.uri.toString();
}

function getFallbackSessionId(): string | undefined {
	const sessionIds = Array.from(sessions.keys());
	return sessionIds[sessionIds.length - 1];
}

export function registerBpmnEditorSession(document: vscode.TextDocument, webview: vscode.Webview): void {
	sessionIdCounter += 1;
	const id = `${getDocumentKey(document)}::${sessionIdCounter}`;
	sessions.set(id, { id, document, webview });
	webviewSessionIds.set(webview, id);
	const documentKey = getDocumentKey(document);
	documentSessionIds.set(documentKey, [...(documentSessionIds.get(documentKey) || []), id]);
	lastActiveSessionId = id;
}

export function markBpmnEditorSessionActive(document: vscode.TextDocument, webview?: vscode.Webview): void {
	const webviewSessionId = webview ? webviewSessionIds.get(webview) : undefined;
	if (webviewSessionId && sessions.has(webviewSessionId)) {
		lastActiveSessionId = webviewSessionId;
		return;
	}

	const sessionIds = documentSessionIds.get(getDocumentKey(document)) || [];
	const fallbackSessionId = sessionIds.find((sessionId) => sessions.has(sessionId));
	if (fallbackSessionId) {
		lastActiveSessionId = fallbackSessionId;
	}
}

export function unregisterBpmnEditorSession(document: vscode.TextDocument, webview: vscode.Webview): void {
	const sessionId = webviewSessionIds.get(webview);
	const session = sessionId ? sessions.get(sessionId) : undefined;
	if (!session || session.document.uri.toString() !== document.uri.toString()) {
		return;
	}

	sessions.delete(session.id);
	const documentKey = getDocumentKey(document);
	const remainingDocumentSessionIds = (documentSessionIds.get(documentKey) || []).filter((id) => id !== session.id && sessions.has(id));
	if (remainingDocumentSessionIds.length > 0) {
		documentSessionIds.set(documentKey, remainingDocumentSessionIds);
	} else {
		documentSessionIds.delete(documentKey);
	}
	if (lastActiveSessionId === session.id) {
		lastActiveSessionId = remainingDocumentSessionIds[remainingDocumentSessionIds.length - 1] || getFallbackSessionId();
	}
}

export function getActiveBpmnEditorSession(): BpmnEditorSession | undefined {
	const activeUri = resolveActiveBpmnUri();
	if (activeUri) {
		const activeSessionIds = documentSessionIds.get(activeUri.toString()) || [];
		if (lastActiveSessionId && activeSessionIds.includes(lastActiveSessionId)) {
			const activeSession = sessions.get(lastActiveSessionId);
			if (activeSession) {
				return activeSession;
			}
		}
		for (const sessionId of activeSessionIds) {
			const activeSession = sessions.get(sessionId);
			if (activeSession) {
				return activeSession;
			}
		}
	}

	if (lastActiveSessionId) {
		return sessions.get(lastActiveSessionId);
	}

	return undefined;
}

export function getActiveBpmnDocument(): vscode.TextDocument | undefined {
	return getActiveBpmnEditorSession()?.document || getActiveBpmnTextDocument();
}