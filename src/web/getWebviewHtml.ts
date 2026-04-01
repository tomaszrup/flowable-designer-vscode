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
	const minimapCssUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'bpmn-assets', 'diagram-js-minimap.css')
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link rel="stylesheet" href="${diagramCssUri}" />
	<link rel="stylesheet" href="${bpmnCssUri}" />
	<link rel="stylesheet" href="${minimapCssUri}" />
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
			--popup-border-color: var(--vscode-widget-border, transparent);
			--popup-entry-hover-color: var(--vscode-list-hoverBackground, hsl(225, 10%, 95%));
			--popup-entry-title-color: var(--vscode-descriptionForeground, hsl(225, 10%, 55%));
			--popup-description-color: var(--vscode-descriptionForeground, hsl(225, 10%, 55%));
			--popup-no-results-color: var(--vscode-descriptionForeground, hsl(225, 10%, 55%));
			--popup-disabled-color: var(--vscode-disabledForeground, hsl(225, 10%, 35%));
			--popup-header-group-divider-color: var(--vscode-widget-border, hsl(225, 10%, 75%));
			--popup-search-border-color: var(--vscode-input-border, hsl(225, 10%, 75%));
			--popup-search-focus-border-color: var(--vscode-focusBorder, hsl(205, 100%, 50%));
			--popup-search-focus-background-color: var(--vscode-input-background, hsl(205, 100%, 95%));
			--shape-drop-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-focusBorder, hsl(205, 100%, 50%)));
			--shape-drop-not-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-errorForeground, hsl(360, 100%, 45%)));
			--shape-connect-allowed-fill-color: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-focusBorder, hsl(205, 100%, 50%)));
		}

		.djs-popup {
			color: var(--vscode-editor-foreground, hsl(225, 10%, 15%));
		}

		.djs-popup-search input {
			color: var(--vscode-input-foreground, var(--vscode-editor-foreground, hsl(225, 10%, 15%)));
			background: var(--vscode-input-background, var(--vscode-editor-background, hsl(0, 0%, 100%)));
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
			grid-template-columns: minmax(0, 1fr) 4px var(--sidebar-width, 320px);
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

		.card:has(#issues:empty),
		.card:has(#issues[style*="display: none"]) {
			display: none;
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
			padding: 12px;
			border: 1px solid var(--border);
			border-radius: 6px;
			margin-bottom: 8px;
			background: color-mix(in srgb, var(--bg) 90%, var(--text) 10%);
		}

		.property-group:last-child {
			margin-bottom: 0;
		}

		.property-group h3 {
			margin: 0;
			padding: 0 0 4px;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--text);
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			user-select: none;
		}

		.property-group h3::before {
			content: '';
			display: inline-block;
			width: 0;
			height: 0;
			border-style: solid;
			border-width: 4px 0 4px 6px;
			border-color: transparent transparent transparent var(--muted);
			transition: transform 0.15s;
			flex-shrink: 0;
		}

		.property-group h3[aria-expanded="true"]::before {
			transform: rotate(90deg);
		}

		.property-group.collapsed > :not(h3) {
			display: none;
		}

		.property-group.collapsed {
			gap: 0;
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

		.unsaved-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--button);
			display: none;
			flex-shrink: 0;
		}

		.unsaved-dot.visible {
			display: block;
		}

		.resize-handle {
			cursor: col-resize;
			background: transparent;
		}

		.resize-handle:hover,
		.resize-handle.active {
			background: var(--vscode-focusBorder);
		}

		.toolbar button:disabled {
			opacity: 0.4;
			cursor: default;
		}

		.toolbar button:disabled:hover {
			background: transparent;
		}

		/* Toast notifications */
		.toast-container {
			position: fixed;
			bottom: 16px;
			right: 16px;
			z-index: 100;
			display: flex;
			flex-direction: column-reverse;
			gap: 8px;
			pointer-events: none;
		}

		.toast {
			padding: 8px 14px;
			border-radius: 6px;
			font-size: 12px;
			line-height: 1.4;
			max-width: 340px;
			pointer-events: auto;
			animation: toast-in 0.2s ease-out;
			box-shadow: 0 2px 8px rgba(0,0,0,0.25);
		}

		.toast.toast-info {
			background: var(--vscode-editorInfo-foreground, #3794ff);
			color: #fff;
		}

		.toast.toast-success {
			background: var(--vscode-testing-iconPassed, #73c991);
			color: #000;
		}

		.toast.toast-error {
			background: var(--vscode-errorForeground, #f44);
			color: #fff;
		}

		.toast.toast-out {
			animation: toast-out 0.15s ease-in forwards;
		}

		@keyframes toast-in {
			from { opacity: 0; transform: translateY(8px); }
			to   { opacity: 1; transform: translateY(0); }
		}

		@keyframes toast-out {
			from { opacity: 1; transform: translateY(0); }
			to   { opacity: 0; transform: translateY(8px); }
		}

		/* Auto-resize textarea */
		.field textarea {
			resize: vertical;
			min-height: 54px;
			overflow: hidden;
		}

		/* Property search */
		.sidebar-search {
			padding: 6px 14px 4px;
			background: var(--panel);
			position: sticky;
			top: 33px;
			z-index: 2;
		}

		.sidebar-search input {
			width: 100%;
			padding: 4px 8px;
			border-radius: 4px;
			border: 1px solid var(--input-border);
			background: var(--input);
			color: var(--text);
			font: inherit;
			font-size: 12px;
		}

		.sidebar-search input::placeholder {
			color: var(--muted);
		}

		.sidebar-search input:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: -1px;
		}

		.property-group.search-hidden {
			display: none;
		}

		/* Status icons */
		#status::before {
			margin-right: 4px;
		}

		#status[data-state="idle"]::before {
			content: '\\2713';
		}

		#status[data-state="error"]::before {
			content: '\\26A0';
		}

		/* Field validation */
		.field-error {
			font-size: 11px;
			color: var(--vscode-errorForeground, #f44);
			margin-top: 2px;
		}

		.field input.invalid,
		.field textarea.invalid {
			border-color: var(--vscode-errorForeground, #f44);
		}

		.properties-actions {
			display: flex;
			justify-content: flex-start;
		}

		#status[data-state="error"] {
			color: var(--vscode-errorForeground);
		}

		/* Drag-to-reorder */
		.drag-handle {
			cursor: grab;
			color: var(--muted);
			font-size: 14px;
			line-height: 1;
			user-select: none;
			padding: 2px 4px;
			border-radius: 3px;
			flex-shrink: 0;
		}

		.drag-handle:hover {
			background: color-mix(in srgb, var(--text) 10%, transparent);
			color: var(--text);
		}

		.field-array-item[draggable="true"] {
			transition: opacity 0.15s, border-color 0.15s;
		}

		.field-array-item.dragging {
			opacity: 0.4;
		}

		.field-array-item.drag-over {
			border-color: var(--vscode-focusBorder);
			box-shadow: 0 0 0 1px var(--vscode-focusBorder);
		}

		/* Minimap VS Code theme overrides */
		.djs-minimap {
			background-color: var(--panel) !important;
			border-color: var(--border) !important;
			border-radius: 6px !important;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
		}

		.djs-minimap .map {
			width: 200px;
			height: 120px;
		}

		.djs-minimap .toggle {
			display: none !important;
		}

		.djs-minimap .viewport-dom {
			border-color: var(--vscode-focusBorder, orange) !important;
		}

		.djs-minimap.open .overlay {
			background: color-mix(in srgb, var(--panel) 20%, transparent) !important;
		}

		@media (max-width: 900px) {
			.layout {
				grid-template-columns: 1fr;
				grid-template-rows: minmax(0, 1fr) minmax(0, 40%);
			}

			.sidebar {
				border-left: 0;
				border-top: 1px solid var(--border);
			}

			.resize-handle {
				display: none;
			}
		}
	</style>
</head>
<body>
	<div class="shell">
		<header class="toolbar" role="toolbar" aria-label="Editor toolbar">
			<div class="toolbar-left">
				<strong>Flowable BPMN Designer</strong>
				<button id="btn-undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>Undo</button>
				<button id="btn-redo" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>Redo</button>
				<button id="btn-view-source" aria-label="View BPMN XML source">View Source</button>
			</div>
			<div class="toolbar-right">
				<span class="unsaved-dot" id="unsaved-dot" title="Unsaved changes" role="status" aria-label="Unsaved changes indicator"></span>
				<span id="status" role="status" aria-live="polite">Preparing diagram editor...</span>
			</div>
		</header>
		<div class="layout">
			<section class="canvas" role="application" aria-label="BPMN diagram canvas">
				<div id="canvas"></div>
			</section>
			<div class="resize-handle" id="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0"></div>
		<aside class="sidebar" role="complementary" aria-label="Element properties">
				<div class="sidebar-header">
					<h2>Properties</h2>
				</div>
				<div class="sidebar-search">
					<input type="text" id="property-search" placeholder="Filter properties..." aria-label="Filter property groups" />
				</div>
				<div class="sidebar-body">
					<div class="card">
						<p id="issues" role="log" aria-live="polite">Waiting for BPMN XML...</p>
					</div>
					<div class="properties-panel">
						<div id="properties"></div>
					</div>
				</div>
			</aside>
		</div>
		<div class="toast-container" id="toast-container" role="alert" aria-live="assertive"></div>
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
