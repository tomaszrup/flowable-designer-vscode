export const BASE_STYLES = `:root {
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

.shell:focus,
.canvas:focus,
.canvas:focus-visible,
#canvas:focus,
#canvas:focus-visible,
.djs-container:focus,
.djs-container:focus-visible,
.djs-container svg:focus,
.djs-container svg:focus-visible,
.djs-parent:focus,
.djs-parent:focus-visible,
body:focus,
html:focus {
	outline: none !important;
	border-color: transparent !important;
}

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

.toolbar button:disabled {
	opacity: 0.4;
	cursor: default;
}

.toolbar button:disabled:hover {
	background: transparent;
}

.toolbar button.active {
	background: color-mix(in srgb, var(--text) 15%, transparent);
	border-color: color-mix(in srgb, var(--text) 30%, transparent);
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
	outline: none;
}

#canvas {
	height: 100%;
	min-height: 420px;
	outline: none;
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
	min-width: 0;
}

.sidebar h2 {
	margin: 0 0 8px;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--muted);
}`;