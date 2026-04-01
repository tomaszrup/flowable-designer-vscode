import * as vscode from 'vscode';

function getNonce(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';

	for (let index = 0; index < 32; index += 1) {
		nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}

	return nonce;
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const nonce = getNonce();
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'app.js'));
	const diagramCssUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'diagram-js.css')
	);
	const bpmnCssUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'bpmn-font', 'css', 'bpmn.css')
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link rel="stylesheet" href="${diagramCssUri}" />
	<link rel="stylesheet" href="${bpmnCssUri}" />
	<title>Flowable BPMN Designer</title>
	<style nonce="${nonce}">
		:root {
			color-scheme: light;
			--border: color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent);
			--panel: var(--vscode-sideBar-background);
			--surface: var(--vscode-editor-background);
			--text: var(--vscode-editor-foreground);
			--muted: var(--vscode-descriptionForeground);
			--input: var(--vscode-input-background);
			--input-border: var(--vscode-input-border);
			--button: var(--vscode-button-background);
			--button-text: var(--vscode-button-foreground);
		}

		* {
			box-sizing: border-box;
		}

		html,
		body {
			height: 100%;
			margin: 0;
			padding: 0;
			overflow: hidden;
			background: var(--surface);
			color: var(--text);
			font-family: var(--vscode-font-family);
		}

		/* diagram-js critical safety-net styles */
		.djs-outline,
		.djs-selection-outline {
			fill: none;
		}

		.djs-outline {
			visibility: hidden;
		}

		.djs-element.selected .djs-outline {
			visibility: visible;
		}

		.djs-connection .djs-visual {
			fill: none;
		}

		.djs-hit-stroke,
		.djs-hit-click-stroke,
		.djs-hit-all,
		.djs-hit-no-move {
			fill: none;
			stroke-opacity: 0;
		}

		/* Override diagram-js palette for VS Code dark themes */
		.djs-parent {
			--canvas-fill-color: var(--vscode-editor-background, hsl(0, 0%, 100%));
			--context-pad-entry-background-color: var(--vscode-editor-background, hsl(0, 0%, 100%));
			--context-pad-entry-hover-background-color: color-mix(in srgb, var(--vscode-editor-background, hsl(225, 10%, 95%)) 80%, var(--vscode-editor-foreground, hsl(225, 10%, 15%)));
			--palette-entry-color: var(--vscode-editor-foreground, hsl(225, 10%, 15%));
			--palette-entry-hover-color: var(--vscode-focusBorder, hsl(205, 100%, 45%));
			--palette-background-color: var(--vscode-editor-background, hsl(225, 10%, 97%));
			--palette-border-color: var(--vscode-widget-border, hsl(225, 10%, 75%));
			--popup-background-color: var(--vscode-editor-background, hsl(0, 0%, 100%));
			--shape-drop-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-focusBorder, hsl(205, 100%, 50%)));
			--shape-drop-not-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-errorForeground, hsl(360, 100%, 45%)));
			--shape-connect-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-focusBorder, hsl(205, 100%, 50%)));
		}

		.djs-context-pad .entry {
			background-color: var(--vscode-editor-background, hsl(0, 0%, 100%));
			box-shadow: 0 0 2px 1px var(--vscode-editor-background, hsl(0, 0%, 100%));
		}

		.djs-context-pad .entry:hover {
			background-color: color-mix(in srgb, var(--vscode-editor-background, hsl(225, 10%, 95%)) 80%, var(--vscode-editor-foreground, hsl(225, 10%, 15%)));
		}

		.shell {
			display: grid;
			grid-template-rows: auto 1fr;
			height: 100vh;
			width: 100vw;
			overflow: hidden;
		}

		.toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			padding: 6px 12px;
			border-bottom: 1px solid var(--border);
			background: var(--panel);
			font-size: 12px;
		}

		.toolbar-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.toolbar-right {
			display: flex;
			align-items: center;
			gap: 10px;
		}

		.toolbar button {
			padding: 3px 10px;
			border: 1px solid var(--border);
			border-radius: 4px;
			background: transparent;
			color: var(--text);
			font: inherit;
			font-size: 11px;
			cursor: pointer;
		}

		.toolbar button:hover {
			background: color-mix(in srgb, var(--text) 10%, transparent);
		}

		.layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 320px;
			min-height: 0;
		}

		.canvas {
			position: relative;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
		}

		#canvas {
			height: 100%;
			min-height: 420px;
		}

		.sidebar {
			position: relative;
			z-index: 1;
			padding: 0;
			border-left: 1px solid var(--border);
			background: var(--panel);
			overflow-y: auto;
			overflow-x: hidden;
		}

		.sidebar-header {
			position: sticky;
			top: 0;
			z-index: 2;
			padding: 8px 14px;
			background: var(--panel);
			border-bottom: 1px solid var(--border);
		}

		.sidebar-header h2 {
			margin: 0;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--muted);
		}

		.sidebar-body {
			padding: 8px 14px 16px;
		}

		.sidebar h2 {
			margin: 0 0 8px;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--muted);
		}

		.card {
			padding: 10px 12px;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: color-mix(in srgb, var(--surface) 92%, transparent);
			margin-bottom: 10px;
		}

		.card p,
		#issues {
			margin: 0;
			color: var(--muted);
			font-size: 11px;
			line-height: 1.5;
		}

		.properties-panel {
			display: grid;
			gap: 0;
		}

		.property-group {
			display: grid;
			gap: 8px;
			padding: 12px 0;
			border-bottom: 1px solid var(--border);
		}

		.property-group:last-child {
			border-bottom: none;
		}

		.property-group h3 {
			margin: 0;
			padding: 0 0 4px;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--text);
		}

		.field {
			display: grid;
			gap: 4px;
		}

		.field.inline {
			grid-template-columns: 1fr auto;
			align-items: center;
			gap: 8px;
		}

		.field label {
			font-size: 11px;
			color: var(--muted);
		}

		.field input,
		.field select,
		.field textarea,
		.field button {
			font: inherit;
			font-size: 12px;
		}

		.field input[type="text"],
		.field select,
		.field textarea {
			width: 100%;
			padding: 5px 8px;
			border-radius: 4px;
			border: 1px solid var(--input-border);
			background: var(--input);
			color: var(--text);
		}

		.field input:focus,
		.field select:focus,
		.field textarea:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: -1px;
		}

		.field input[type="checkbox"] {
			appearance: none;
			-webkit-appearance: none;
			width: 34px;
			height: 18px;
			margin: 0;
			border: 1px solid var(--input-border);
			border-radius: 9px;
			background: var(--input);
			cursor: pointer;
			position: relative;
			flex-shrink: 0;
			transition: background 0.15s, border-color 0.15s;
		}

		.field input[type="checkbox"]::after {
			content: '';
			position: absolute;
			top: 2px;
			left: 2px;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			background: var(--muted);
			transition: transform 0.15s, background 0.15s;
		}

		.field input[type="checkbox"]:checked {
			background: var(--button);
			border-color: var(--button);
		}

		.field input[type="checkbox"]:checked::after {
			background: var(--button-text);
			transform: translateX(16px);
		}

		.field input[type="checkbox"]:focus-visible {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 1px;
		}

		.field button,
		.properties-actions button {
			padding: 4px 10px;
			border: 0;
			border-radius: 4px;
			background: var(--button);
			color: var(--button-text);
			font-size: 11px;
			cursor: pointer;
		}

		.field button:hover,
		.properties-actions button:hover {
			background: var(--vscode-button-hoverBackground, color-mix(in srgb, var(--button) 85%, white));
		}

		.field-array-item {
			display: grid;
			gap: 6px;
			padding: 8px;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: color-mix(in srgb, var(--surface) 50%, transparent);
		}

		.btn-remove {
			padding: 3px 8px;
			border: 1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44) 40%, transparent);
			border-radius: 4px;
			background: transparent;
			color: var(--vscode-errorForeground, #f44);
			font-size: 11px;
			cursor: pointer;
			justify-self: start;
		}

		.btn-remove:hover {
			background: color-mix(in srgb, var(--vscode-errorForeground, #f44) 14%, transparent);
		}

		.properties-actions {
			display: flex;
			justify-content: flex-start;
		}

		#status[data-state="error"] {
			color: var(--vscode-errorForeground);
		}

		@media (max-width: 900px) {
			.layout {
				grid-template-columns: 1fr;
				grid-template-rows: minmax(0, 1fr) auto;
			}

			.sidebar {
				border-left: 0;
				border-top: 1px solid var(--border);
			}
		}
	</style>
</head>
<body>
	<div class="shell">
		<header class="toolbar">
			<div class="toolbar-left">
				<strong>Flowable BPMN Designer</strong>
				<button id="btn-view-source">View Source</button>
			</div>
			<div class="toolbar-right">
				<span id="status">Preparing diagram editor...</span>
			</div>
		</header>
		<div class="layout">
			<section class="canvas">
				<div id="canvas"></div>
			</section>
		<aside class="sidebar">
				<div class="sidebar-header">
					<h2>Properties</h2>
				</div>
				<div class="sidebar-body">
					<div class="card">
						<p id="issues">Waiting for BPMN XML...</p>
					</div>
					<div class="properties-panel">
						<div id="properties"></div>
					</div>
				</div>
			</aside>
		</div>
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
