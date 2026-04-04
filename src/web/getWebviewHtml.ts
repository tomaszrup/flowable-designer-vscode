import * as vscode from 'vscode';
import { WEBVIEW_BODY_HTML } from './webviewHtml/body';
import { getWebviewHeadHtml } from './webviewHtml/head';
import { getNonce } from './webviewHtml/nonce';

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const nonce = getNonce();
	const scriptUri = String(webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'app.js')));
	const diagramCssUri = String(webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'diagram-js.css')
	));
	const bpmnCssUri = String(webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'bpmn-font', 'css', 'bpmn.css')
	));
	const minimapCssUri = String(webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'diagram-js-minimap.css')
	));

	return `<!DOCTYPE html>
<html lang="en">
${getWebviewHeadHtml({
		bpmnCssUri,
		cspSource: webview.cspSource,
		diagramCssUri,
		minimapCssUri,
		nonce,
	})}
${WEBVIEW_BODY_HTML}
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
