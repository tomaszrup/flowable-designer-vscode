import { describe, expect, test, vi } from 'vitest';
import type * as vscode from 'vscode';

vi.mock('vscode', () => ({
	Uri: {
		joinPath(base: { path: string }, ...segments: string[]) {
			const prefix = base.path.replace(/\/+$/, '');
			const suffix = segments.map((segment) => segment.replace(/^\/+|\/+$/g, '')).join('/');

			return { path: `${prefix}/${suffix}` };
		},
	},
}));

import { getWebviewHtml } from '../../getWebviewHtml';

function createWebviewMock(): { extensionUri: vscode.Uri; webview: vscode.Webview } {
	const extensionUri = { path: '/extension-root' } as unknown as vscode.Uri;
	const webview = {
		asWebviewUri(uri: { path: string }) {
			return `webview:${uri.path}`;
		},
		cspSource: 'vscode-resource:',
	} as unknown as vscode.Webview;

	return { extensionUri, webview };
}

describe('getWebviewHtml', () => {
	test('includes required asset URIs and application anchors', () => {
		const { extensionUri, webview } = createWebviewMock();
		const html = getWebviewHtml(webview, extensionUri);

		expect(html).toContain('href="webview:/extension-root/dist/webview/bpmn-assets/diagram-js.css"');
		expect(html).toContain('href="webview:/extension-root/dist/webview/bpmn-assets/bpmn-font/css/bpmn.css"');
		expect(html).toContain('href="webview:/extension-root/dist/webview/bpmn-assets/diagram-js-minimap.css"');
		expect(html).toContain('src="webview:/extension-root/dist/webview/app.js"');
		expect(html).toContain('id="canvas"');
		expect(html).toContain('id="properties"');
		expect(html).toContain('id="toast-container"');
	});

	test('reuses one nonce across CSP, style, and script tags', () => {
		const { extensionUri, webview } = createWebviewMock();
		const html = getWebviewHtml(webview, extensionUri);
		const styleNonce = html.match(/<style nonce="([^"]+)">/)?.[1];
		const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];

		expect(styleNonce).toBeDefined();
		expect(styleNonce).toHaveLength(32);
		expect(scriptNonce).toBe(styleNonce);
		expect(html).toContain(`style-src vscode-resource: 'nonce-${styleNonce}'`);
		expect(html).toContain(`script-src 'nonce-${styleNonce}'`);
	});
});