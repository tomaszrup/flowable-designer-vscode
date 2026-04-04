export const PROPERTY_PANEL_STYLES = `.card {
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
	min-width: 0;
}

.property-group {
	display: grid;
	gap: 8px;
	padding: 12px;
	border: 1px solid var(--border);
	border-radius: 6px;
	margin-bottom: 8px;
	background: color-mix(in srgb, var(--bg) 90%, var(--text) 10%);
	min-width: 0;
}

.property-group > * {
	min-width: 0;
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
	min-width: 0;
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
}`;