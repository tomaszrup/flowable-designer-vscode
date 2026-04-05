import type { WebviewToHostMessage } from '../shared/messages';

interface PropertyUiDeps {
	collapsedGroups: Set<string>;
	persistUiState: () => void;
	nextFieldId: (prefix: string) => string;
	postMessage: (message: WebviewToHostMessage) => void;
	status: HTMLElement;
	issues: HTMLElement;
	toastContainer: HTMLElement;
}

export interface PropertyUi {
	setStatus: (message: string, state?: 'idle' | 'error') => void;
	showToast: (message: string, level?: 'info' | 'success' | 'error', duration?: number) => void;
	renderIssues: (lines: string[]) => void;
	toIssueMessage: (warning: unknown) => string;
	flushPendingTextEdits: () => void;
	createGroup: (title: string) => HTMLDivElement;
	createField: (labelText: string, control: HTMLElement, inline?: boolean) => HTMLDivElement;
	createTextInput: (value: string, onCommit: (nextValue: string) => void, placeholder?: string, validate?: (value: string) => string | null) => HTMLInputElement;
	createCheckbox: (value: boolean, onCommit: (nextValue: boolean) => void) => HTMLInputElement;
	createTextArea: (value: string, onCommit: (nextValue: string) => void, placeholder?: string) => HTMLTextAreaElement;
	renderFileReferences: (refs: string[]) => HTMLDivElement;
	createSelect: (options: string[], selected: string, onCommit: (nextValue: string) => void) => HTMLSelectElement;
	createReferenceSelect: (options: Array<{ value: string; label: string }>, selected: string, onCommit: (nextValue: string) => void, placeholder?: string) => HTMLSelectElement;
}

function toIssueMessage(warning: unknown): string {
	if (warning instanceof Error) {
		return warning.message;
	}

	return String(warning);
}

function createTextInput(
	value: string,
	onCommit: (nextValue: string) => void,
	placeholder?: string,
	validate?: (value: string) => string | null,
): HTMLInputElement {
	return createPendingTextInput(value, onCommit, placeholder, validate, false) as HTMLInputElement;
}

function createPendingTextInput(
	value: string,
	onCommit: (nextValue: string) => void,
	placeholder: string | undefined,
	validate: ((value: string) => string | null) | undefined,
	multiline: boolean,
): HTMLInputElement | HTMLTextAreaElement {
	const control = multiline ? document.createElement('textarea') : document.createElement('input');
	if (control instanceof HTMLInputElement) {
		control.type = 'text';
	}
	if (control instanceof HTMLTextAreaElement) {
		control.rows = 2;
	}
	control.value = value;
	if (placeholder) {
		control.placeholder = placeholder;
	}

	let errorEl: HTMLSpanElement | null = null;
	let lastCommittedValue = value;
	const runValidation = (): string | null => {
		if (!validate) {
			return null;
		}
		const msg = validate(control.value);
		if (msg) {
			control.classList.add('invalid');
			if (!errorEl) {
				errorEl = document.createElement('span');
				errorEl.className = 'field-error';
				control.parentElement?.appendChild(errorEl);
			}
			errorEl.textContent = msg;
		} else {
			control.classList.remove('invalid');
			if (errorEl) {
				errorEl.remove();
				errorEl = null;
			}
		}
		return msg;
	};

	const flush = (): void => {
		if (!control.isConnected) {
			return;
		}
		if (runValidation()) {
			return;
		}
		if (control.value === lastCommittedValue) {
			return;
		}
		lastCommittedValue = control.value;
		onCommit(control.value);
	};

	control.addEventListener('input', () => {
		runValidation();
		if (control instanceof HTMLTextAreaElement) {
			control.style.height = 'auto';
			control.style.height = `${control.scrollHeight}px`;
		}
	});
	control.addEventListener('change', flush);
	control.addEventListener('blur', flush);
	(control as HTMLInputElement & { __flushPendingEdit?: () => void }).__flushPendingEdit = flush;
	if (validate) {
		requestAnimationFrame(runValidation);
	}
	if (control instanceof HTMLTextAreaElement) {
		requestAnimationFrame(() => {
			control.style.height = 'auto';
			control.style.height = `${control.scrollHeight}px`;
		});
	}
	return control;
}

function createCheckbox(value: boolean, onCommit: (nextValue: boolean) => void): HTMLInputElement {
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = value;
	input.setAttribute('role', 'switch');
	input.setAttribute('aria-checked', String(value));
	input.addEventListener('change', () => {
		input.setAttribute('aria-checked', String(input.checked));
		onCommit(input.checked);
	});
	return input;
}

function createTextArea(value: string, onCommit: (nextValue: string) => void, placeholder?: string): HTMLTextAreaElement {
	return createPendingTextInput(value, onCommit, placeholder, undefined, true) as HTMLTextAreaElement;
}

function createSelect(options: string[], selected: string, onCommit: (nextValue: string) => void): HTMLSelectElement {
	const select = document.createElement('select');
	for (const opt of options) {
		const option = document.createElement('option');
		option.value = opt;
		option.textContent = opt;
		option.selected = opt === selected;
		select.appendChild(option);
	}
	select.addEventListener('change', () => onCommit(select.value));
	return select;
}

function createReferenceSelect(
	options: Array<{ value: string; label: string }>,
	selected: string,
	onCommit: (nextValue: string) => void,
	placeholder?: string,
): HTMLSelectElement {
	const select = document.createElement('select');
	const emptyOpt = document.createElement('option');
	emptyOpt.value = '';
	emptyOpt.textContent = placeholder || '(none)';
	emptyOpt.selected = !selected;
	select.appendChild(emptyOpt);
	for (const opt of options) {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === selected;
		select.appendChild(option);
	}
	if (selected && !options.some((option) => option.value === selected)) {
		const customOpt = document.createElement('option');
		customOpt.value = selected;
		customOpt.textContent = `${selected} (custom)`;
		customOpt.selected = true;
		select.appendChild(customOpt);
	}
	select.addEventListener('change', () => onCommit(select.value));
	return select;
}

export function flushFocusedInput(container: HTMLElement): void {
	const focused = container.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="text"]:focus, textarea:focus');
	if (focused) {
		(focused as HTMLInputElement & { __flushPendingEdit?: () => void }).__flushPendingEdit?.();
	}
}

function flushPendingTextEdits(): void {
	for (const control of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea'))) {
		control.dispatchEvent(new Event('blur'));
		(control as HTMLInputElement & { __flushPendingEdit?: () => void }).__flushPendingEdit?.();
	}
}

export function createPropertyUi(deps: PropertyUiDeps): PropertyUi {
	function setStatus(message: string, state: 'idle' | 'error' = 'idle'): void {
		deps.status.textContent = message;
		deps.status.dataset.state = state;
	}

	function showToast(message: string, level: 'info' | 'success' | 'error' = 'info', duration = 3500): void {
		const toast = document.createElement('div');
		toast.className = `toast toast-${level}`;
		toast.textContent = message;
		toast.setAttribute('role', 'alert');
		deps.toastContainer.appendChild(toast);

		globalThis.setTimeout(() => {
			toast.classList.add('toast-out');
			toast.addEventListener('animationend', () => toast.remove());
			globalThis.setTimeout(() => toast.remove(), 500);
		}, duration);
	}

	function renderIssues(lines: string[]): void {
		if (lines.length > 0) {
			deps.issues.textContent = lines.join(' ');
			deps.issues.style.display = '';
		} else {
			deps.issues.textContent = '';
			deps.issues.style.display = 'none';
		}
	}

	function createGroup(title: string): HTMLDivElement {
		const group = document.createElement('div');
		group.className = 'property-group';
		group.setAttribute('role', 'region');
		group.setAttribute('aria-label', title);
		if (deps.collapsedGroups.has(title)) {
			group.classList.add('collapsed');
		}

		const heading = document.createElement('h3');
		heading.textContent = title;
		heading.setAttribute('role', 'button');
		heading.setAttribute('tabindex', '0');
		heading.setAttribute('aria-expanded', deps.collapsedGroups.has(title) ? 'false' : 'true');
		const toggleCollapse = (): void => {
			const isCollapsed = group.classList.toggle('collapsed');
			heading.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
			if (isCollapsed) {
				deps.collapsedGroups.add(title);
			} else {
				deps.collapsedGroups.delete(title);
			}
			deps.persistUiState();
		};
		heading.addEventListener('click', toggleCollapse);
		heading.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleCollapse();
			}
		});
		group.appendChild(heading);

		return group;
	}

	function createField(labelText: string, control: HTMLElement, inline = false): HTMLDivElement {
		const field = document.createElement('div');
		field.className = inline ? 'field inline' : 'field';

		const id = deps.nextFieldId(labelText.toLowerCase().replace(/[^a-z0-9]/g, '-'));
		const label = document.createElement('label');
		label.textContent = labelText;
		label.setAttribute('for', id);
		control.id = id;

		field.append(label, control);

		return field;
	}

	function renderFileReferences(refs: string[]): HTMLDivElement {
		const container = document.createElement('div');
		container.className = 'file-references';
		for (const ref of refs) {
			const link = document.createElement('a');
			link.className = 'file-reference-link';
			link.href = '#';
			const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			icon.setAttribute('width', '12');
			icon.setAttribute('height', '12');
			icon.setAttribute('viewBox', '0 0 16 16');
			icon.setAttribute('fill', 'currentColor');
			icon.classList.add('file-ref-icon');
			icon.innerHTML = '<path d="M13.71 4.29l-3-3A1 1 0 0 0 10 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a1 1 0 0 0-.29-.71zM13 13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h5.59L13 5.41V13z"/>';
			link.appendChild(icon);
			link.appendChild(document.createTextNode(ref));
			link.title = `Open ${ref}`;
			link.addEventListener('click', (event) => {
				event.preventDefault();
				deps.postMessage({ type: 'open-file', path: ref });
			});
			container.appendChild(link);
		}
		return container;
	}

	return {
		setStatus,
		showToast,
		renderIssues,
		toIssueMessage,
		flushPendingTextEdits,
		createGroup,
		createField,
		createTextInput,
		createCheckbox,
		createTextArea,
		renderFileReferences,
		createSelect,
		createReferenceSelect,
	};
}