export const PROPERTY_INTERACTION_STYLES = String.raw`.toast-container {
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
	to { opacity: 1; transform: translateY(0); }
}

@keyframes toast-out {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(8px); }
}

.field textarea {
	resize: vertical;
	min-height: 54px;
	overflow: hidden;
}

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

#status::before {
	margin-right: 4px;
}

#status[data-state="idle"]::before {
	content: '\2713';
}

#status[data-state="error"]::before {
	content: '\26A0';
}

#status[data-state="error"] {
	color: var(--vscode-errorForeground);
}

.field-error {
	font-size: 11px;
	color: var(--vscode-errorForeground, #f44);
	margin-top: 2px;
}

.field input.invalid,
.field textarea.invalid {
	border-color: var(--vscode-errorForeground, #f44);
}

.file-references {
	display: grid;
	gap: 6px;
	margin-top: 4px;
	min-width: 0;
}

.file-ref-icon {
	flex-shrink: 0;
	opacity: 0.8;
	position: relative;
	top: 1px;
}

.file-reference-link {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 2px 8px;
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	white-space: normal;
	overflow-wrap: anywhere;
	word-break: break-word;
	border-radius: 4px;
	background: color-mix(in srgb, var(--vscode-textLink-foreground, #3794ff) 12%, transparent);
	color: var(--vscode-textLink-foreground, #3794ff);
	font-size: 11px;
	line-height: 1.4;
	text-decoration: none;
	cursor: pointer;
	border: 1px solid color-mix(in srgb, var(--vscode-textLink-foreground, #3794ff) 25%, transparent);
}

.file-reference-link:hover {
	background: color-mix(in srgb, var(--vscode-textLink-foreground, #3794ff) 20%, transparent);
	text-decoration: underline;
}

.file-browse-btn {
	margin-top: 4px;
	padding: 4px 10px;
	border: 1px solid var(--border);
	border-radius: 4px;
	background: transparent;
	color: var(--text);
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}

.file-browse-btn:hover {
	background: color-mix(in srgb, var(--text) 10%, transparent);
}

.properties-actions {
	display: flex;
	justify-content: flex-start;
}

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
}`;