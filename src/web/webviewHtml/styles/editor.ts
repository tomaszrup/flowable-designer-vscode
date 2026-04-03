export const ADVANCED_EDITOR_STYLES = String.raw`.djs-minimap {
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

.bjs-drilldown {
	width: 20px;
	height: 20px;
	padding: 0;
	cursor: pointer;
	border: none;
	border-radius: 3px;
	outline: none;
	fill: var(--button-text, #fff);
	background-color: var(--button, #0e639c);
}

.bjs-drilldown:hover {
	background-color: var(--vscode-button-hoverBackground, color-mix(in srgb, var(--button) 85%, white));
}

.bjs-drilldown:focus-visible {
	outline: 2px solid var(--vscode-focusBorder, #007fd4);
	outline-offset: 1px;
}

.bjs-drilldown-empty {
	display: none;
}

.selected .bjs-drilldown-empty {
	display: inherit;
}

.bjs-breadcrumbs {
	position: absolute;
	display: none;
	flex-wrap: wrap;
	align-items: center;
	top: 10px;
	left: 10px;
	padding: 6px 12px;
	margin: 0;
	font-family: var(--vscode-font-family);
	font-size: 13px;
	line-height: normal;
	list-style: none;
	background: var(--panel);
	border: 1px solid var(--border);
	border-radius: 6px;
	box-shadow: 0 2px 8px rgba(0,0,0,0.2);
	z-index: 10;
}

.bjs-breadcrumbs-shown .bjs-breadcrumbs {
	display: flex;
}

.djs-palette-shown .bjs-breadcrumbs {
	left: 90px;
}

.djs-palette-shown.djs-palette-two-column .bjs-breadcrumbs {
	left: 140px;
}

.bjs-breadcrumbs li {
	display: inline-flex;
	padding-bottom: 0;
	align-items: center;
}

.bjs-breadcrumbs li a {
	cursor: pointer;
	color: var(--vscode-textLink-foreground, var(--button));
}

.bjs-breadcrumbs li a:hover {
	text-decoration: underline;
}

.bjs-breadcrumbs li:last-of-type a {
	color: var(--text);
	cursor: default;
	text-decoration: none;
}

.bjs-breadcrumbs li:not(:first-child)::before {
	content: '\203A';
	padding: 0 6px;
	color: var(--muted);
	font-size: 16px;
}

.bjs-breadcrumbs .bjs-crumb {
	display: inline-block;
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.djs-direct-editing-parent {
	color: var(--text) !important;
	border-color: var(--vscode-focusBorder, #007fd4) !important;
}

.djs-direct-editing-content {
	color: var(--text) !important;
}

.djs-direct-editing-parent[style*="background-color: rgb(255, 255, 255)"],
.djs-direct-editing-parent[style*="background-color: #ffffff"] {
	background-color: var(--surface) !important;
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
}`;