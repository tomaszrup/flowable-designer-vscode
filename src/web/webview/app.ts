import Modeler from 'bpmn-js/lib/Modeler';
import minimapModule from 'diagram-js-minimap';
import {
	cloneFlowableState,
	createEmptyFlowableState,
	type FlowableAttributeKey,
	type FlowableDocumentState,
	type FlowableElementState,
	type FlowableEventListener,
	type FlowableEventListenerImplType,
	type FlowableFieldExtension,
	type FlowableFormProperty,
	type FlowableIOParameter,
	type FlowableListener,
	type FlowableLocalization,
	type FlowableMultiInstance,
	type FlowableSignalDefinition,
	type FlowableMessageDefinition,
	type FlowableTimerDefinition,
	type TimerDefinitionType,
} from '../flowable/types';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../shared/messages';
import { parseFileReferences } from '../shared/fileReferences';
import { validateId, validateRequired, validateRetryCycle, validateTimerValue } from './validators';
import {
	type BpmnElement,
	getBusinessObject,
	getElementId,
	getElementType,
	getEventDefinitionType,
	isActivity,
	isBoundaryEvent,
	isBusinessRuleTask,
	isCallActivity,
	isEndEvent,
	isEventElement,
	isEventSubProcess,
	isExternalWorkerTask,
	isFlowNode,
	isGateway,
	isGenericServiceTask,
	isHttpTask,
	isLane,
	isMailTask,
	isManualTask,
	isParticipant,
	isProcess,
	isReceiveTask,
	isScriptTask,
	isSendTask,
	isSequenceFlow,
	isServiceTask,
	isShellTask,
	isStartEvent,
	isSubProcessType,
	isTextAnnotation,
	isUserTask,
} from './bpmnTypeGuards';

declare function acquireVsCodeApi(): {
	postMessage(message: WebviewToHostMessage): void;
	setState(state: unknown): void;
	getState(): unknown;
};

interface ModelingService {
	updateProperties(element: BpmnElement, properties: Record<string, unknown>): void;
}

interface EventBusService {
	on(eventName: string, listener: (event: Record<string, unknown>) => void): void;
}

interface CanvasService {
	zoom(level: 'fit-viewport'): void;
	viewbox(): { x: number; y: number; width: number; height: number };
	viewbox(box: { x: number; y: number; width: number; height: number }): void;
	getRootElement(): BpmnElement;
	setRootElement(rootElement: BpmnElement): void;
	findRoot(id: string): BpmnElement | undefined;
}

interface ElementRegistryService {
	get(id: string): BpmnElement | undefined;
}

interface CommandStackService {
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
}

interface MinimapService {
	open(): void;
	close(): void;
	toggle(): void;
	isOpen(): boolean;
}

const editableLabels: Partial<Record<FlowableAttributeKey, string>> = {
	candidateStarterUsers: 'Candidate Starter Users',
	candidateStarterGroups: 'Candidate Starter Groups',
	assignee: 'Assignee',
	candidateUsers: 'Candidate Users',
	candidateGroups: 'Candidate Groups',
	formKey: 'Form Key',
	initiator: 'Initiator',
	dueDate: 'Due Date',
	priority: 'Priority',
	category: 'Category',
	skipExpression: 'Skip Expression',
	class: 'Java Class',
	expression: 'Expression',
	delegateExpression: 'Delegate Expression',
	resultVariableName: 'Result Variable',
	async: 'Async',
	exclusive: 'Exclusive',
	triggerable: 'Triggerable',
};

const processAttributes: FlowableAttributeKey[] = [
	'candidateStarterUsers',
	'candidateStarterGroups',
];

const userTaskAttributes: FlowableAttributeKey[] = [
	'assignee',
	'candidateUsers',
	'candidateGroups',
	'formKey',
	'dueDate',
	'priority',
	'category',
	'skipExpression',
	'async',
	'exclusive',
];

const startEventAttributes: FlowableAttributeKey[] = [
	'formKey',
	'initiator',
];

const serviceTaskAttributes: FlowableAttributeKey[] = [
	'class',
	'expression',
	'delegateExpression',
	'resultVariableName',
	'skipExpression',
	'async',
	'exclusive',
	'triggerable',
];

const sendTaskAttributes: FlowableAttributeKey[] = [
	'class',
	'expression',
	'delegateExpression',
	'resultVariableName',
	'skipExpression',
	'async',
	'exclusive',
];

const receiveTaskAttributes: FlowableAttributeKey[] = [
	'async',
	'exclusive',
];

const manualTaskAttributes: FlowableAttributeKey[] = [
	'async',
	'exclusive',
];

const attributePlaceholders: Partial<Record<FlowableAttributeKey, string>> = {
	assignee: 'e.g. ${initiator}',
	candidateUsers: 'e.g. user1, user2',
	candidateGroups: 'e.g. managers, hr',
	candidateStarterUsers: 'e.g. admin, user1',
	candidateStarterGroups: 'e.g. managers',
	formKey: 'e.g. myForm',
	initiator: 'e.g. initiator',
	dueDate: 'e.g. 2026-12-31 or ${dueDate}',
	priority: 'e.g. 50 or ${priority}',
	category: 'e.g. approval',
	skipExpression: 'e.g. ${skip}',
	class: 'e.g. com.example.MyDelegate',
	expression: 'e.g. ${myBean.execute()}',
	delegateExpression: 'e.g. ${myDelegate}',
	resultVariableName: 'e.g. result',
};

const vscode = acquireVsCodeApi();

function requireElement(id: string): HTMLElement {
	const element = document.getElementById(id);

	if (!element) {
		throw new Error(`Flowable BPMN webview failed to initialize required element: ${id}.`);
	}

	return element;
}

function createElementState(id: string, type: string): FlowableElementState {
	return {
		id,
		type,
		activitiAttributes: {},
		fieldExtensions: [],
		taskListeners: [],
		executionListeners: [],
		formProperties: [],
		inputParameters: [],
		outputParameters: [],
		multiInstance: null,
		conditionExpression: '',
		script: '',
		timerDefinition: null,
		errorRef: '',
		signalRef: '',
		messageRef: '',
		terminateAll: '',
		compensateActivityRef: '',
		isForCompensation: '',
		failedJobRetryTimeCycle: '',
		exceptionMaps: [],
		documentation: '',
		preservedAttributes: {},
		preservedExtensionElements: [],
	};
}

function createFieldExtension(): FlowableFieldExtension {
	fieldCounter += 1;
	return {
		id: `field-${fieldCounter}`,
		name: '',
		valueType: 'string',
		value: '',
	};
}

function createListener(kind: 'task' | 'execution'): FlowableListener {
	listenerCounter += 1;
	return {
		id: `${kind}-listener-${listenerCounter}`,
		event: kind === 'task' ? 'create' : 'start',
		implementationType: 'class',
		implementation: '',
	};
}

function createFormProperty(): FlowableFormProperty {
	formPropertyCounter += 1;
	return {
		id: `form-property-${formPropertyCounter}`,
		name: '',
		type: 'string',
		required: false,
		readable: true,
		writable: true,
		defaultValue: '',
	};
}

function setStatus(message: string, state: 'idle' | 'error' = 'idle'): void {
	status.textContent = message;
	status.setAttribute('data-state', state);
}

function showToast(message: string, level: 'info' | 'success' | 'error' = 'info', duration = 3500): void {
	const toast = document.createElement('div');
	toast.className = `toast toast-${level}`;
	toast.textContent = message;
	toast.setAttribute('role', 'alert');
	toastContainer.appendChild(toast);

	window.setTimeout(() => {
		toast.classList.add('toast-out');
		toast.addEventListener('animationend', () => toast.remove());
		// Fallback removal if animationend never fires
		window.setTimeout(() => toast.remove(), 500);
	}, duration);
}

function renderIssues(lines: string[]): void {
	if (lines.length > 0) {
		issues.textContent = lines.join(' ');
		issues.style.display = '';
	} else {
		issues.textContent = '';
		issues.style.display = 'none';
	}
}

function toIssueMessage(warning: unknown): string {
	if (warning instanceof Error) {
		return warning.message;
	}

	return String(warning);
}

function createGroup(title: string): HTMLDivElement {
	const group = document.createElement('div');
	group.className = 'property-group';
	group.setAttribute('role', 'region');
	group.setAttribute('aria-label', title);
	if (collapsedGroups.has(title)) {
		group.classList.add('collapsed');
	}

	const heading = document.createElement('h3');
	heading.textContent = title;
	heading.setAttribute('role', 'button');
	heading.setAttribute('tabindex', '0');
	heading.setAttribute('aria-expanded', collapsedGroups.has(title) ? 'false' : 'true');
	const toggleCollapse = (): void => {
		const isCollapsed = group.classList.toggle('collapsed');
		heading.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
		if (isCollapsed) {
			collapsedGroups.add(title);
		} else {
			collapsedGroups.delete(title);
		}
		persistUiState();
	};
	heading.addEventListener('click', toggleCollapse);
	heading.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleCollapse();
		}
	});
	group.appendChild(heading);

	return group;
}

function createField(labelText: string, control: HTMLElement, inline = false): HTMLDivElement {
	const field = document.createElement('div');
	field.className = inline ? 'field inline' : 'field';

	const id = nextFieldId(labelText.toLowerCase().replace(/[^a-z0-9]/g, '-'));
	const label = document.createElement('label');
	label.textContent = labelText;
	label.setAttribute('for', id);
	control.id = id;

	field.append(label, control);

	return field;
}

function createTextInput(value: string, onCommit: (nextValue: string) => void, placeholder?: string, validate?: (v: string) => string | null): HTMLInputElement {
	const input = document.createElement('input');
	input.type = 'text';
	input.value = value;
	if (placeholder) {
		input.placeholder = placeholder;
	}

	let errorEl: HTMLSpanElement | null = null;
	const runValidation = (): void => {
		if (!validate) { return; }
		const msg = validate(input.value);
		if (msg) {
			input.classList.add('invalid');
			if (!errorEl) {
				errorEl = document.createElement('span');
				errorEl.className = 'field-error';
				input.parentElement?.appendChild(errorEl);
			}
			errorEl.textContent = msg;
		} else {
			input.classList.remove('invalid');
			if (errorEl) { errorEl.remove(); errorEl = null; }
		}
	};

	input.addEventListener('input', runValidation);
	input.addEventListener('change', () => {
		onCommit(input.value);
	});
	// Run initial validation on next frame
	if (validate) {
		requestAnimationFrame(runValidation);
	}
	return input;
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
	const textarea = document.createElement('textarea');
	textarea.rows = 2;
	textarea.value = value;
	if (placeholder) {
		textarea.placeholder = placeholder;
	}
	const autoResize = (): void => {
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	};
	textarea.addEventListener('input', autoResize);
	textarea.addEventListener('change', () => {
		onCommit(textarea.value);
	});
	// Initial size on next frame when element is attached
	requestAnimationFrame(autoResize);
	return textarea;
}

/** Render a container with clickable file reference links. */
function renderFileReferences(refs: string[]): HTMLDivElement {
	const container = document.createElement('div');
	container.className = 'file-references';
	for (const ref of refs) {
		const link = document.createElement('a');
		link.className = 'file-reference-link';
		link.href = '#';
		link.textContent = ref;
		link.title = `Open ${ref}`;
		link.addEventListener('click', (e) => {
			e.preventDefault();
			postMessage({ type: 'open-file', path: ref });
		});
		container.appendChild(link);
	}
	return container;
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
	select.addEventListener('change', () => {
		onCommit(select.value);
	});
	return select;
}

// Drag-to-reorder for collection items
function makeDraggableItem<T>(item: HTMLDivElement, index: number, array: T[], collectionId: string, onReorder: () => void): void {
	const handle = document.createElement('span');
	handle.className = 'drag-handle';
	handle.textContent = '\u2630';
	handle.title = 'Drag to reorder';
	handle.setAttribute('aria-label', 'Drag to reorder');
	item.draggable = true;
	item.insertBefore(handle, item.firstChild);

	const mimeType = `application/x-collection-${collectionId}`;

	item.addEventListener('dragstart', (e: DragEvent) => {
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData(mimeType, String(index));
		}
		item.classList.add('dragging');
	});

	item.addEventListener('dragend', () => {
		item.classList.remove('dragging');
	});

	item.addEventListener('dragover', (e: DragEvent) => {
		if (!e.dataTransfer?.types.includes(mimeType)) { return; }
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		item.classList.add('drag-over');
	});

	item.addEventListener('dragleave', () => {
		item.classList.remove('drag-over');
	});

	item.addEventListener('drop', (e: DragEvent) => {
		if (!e.dataTransfer?.types.includes(mimeType)) { return; }
		e.preventDefault();
		item.classList.remove('drag-over');
		const fromIndex = Number(e.dataTransfer?.getData(mimeType));
		const toIndex = index;
		if (isNaN(fromIndex) || fromIndex === toIndex || fromIndex < 0 || fromIndex >= array.length) { return; }
		const [moved] = array.splice(fromIndex, 1);
		array.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved);
		onReorder();
	});
}

// Reference picker: select with option to type custom value
function createReferenceSelect(options: Array<{ value: string; label: string }>, selected: string, onCommit: (nextValue: string) => void, placeholder?: string): HTMLSelectElement {
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
	// Add current value if not in options
	if (selected && !options.some((o) => o.value === selected)) {
		const customOpt = document.createElement('option');
		customOpt.value = selected;
		customOpt.textContent = `${selected} (custom)`;
		customOpt.selected = true;
		select.appendChild(customOpt);
	}
	select.addEventListener('change', () => {
		onCommit(select.value);
	});
	return select;
}

const canvas = requireElement('canvas');
const status = requireElement('status');
const issues = requireElement('issues');
const properties = requireElement('properties');
const btnViewSource = requireElement('btn-view-source');
const btnUndo = requireElement('btn-undo') as HTMLButtonElement;
const btnRedo = requireElement('btn-redo') as HTMLButtonElement;
const unsavedDot = requireElement('unsaved-dot');
const resizeHandle = requireElement('resize-handle');
const toastContainer = requireElement('toast-container');
const propertySearch = requireElement('property-search') as HTMLInputElement;
const layoutEl = document.querySelector('.layout') as HTMLElement;

const style = getComputedStyle(document.documentElement);
const vscodeText = style.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc';
const vscodeBackground = style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

const modeler = new Modeler({
	container: canvas,
	additionalModules: [minimapModule],
	bpmnRenderer: {
		defaultFillColor: vscodeBackground,
		defaultStrokeColor: vscodeText,
		defaultLabelColor: vscodeText,
	},
});

const eventBus = modeler.get('eventBus') as EventBusService;
const modeling = modeler.get('modeling') as ModelingService;
const canvasService = modeler.get('canvas') as CanvasService;
const elementRegistry = modeler.get('elementRegistry') as ElementRegistryService;
const commandStack = modeler.get('commandStack') as CommandStackService;
const minimap = modeler.get('minimap') as MinimapService;

// Close minimap by default (controlled by extension config)
minimap.close();

let currentXml = '';
let applyingRemoteUpdate = false;
let initialLoadDone = false;
let fieldCounter = 0;
let listenerCounter = 0;
let formPropertyCounter = 0;
let selectedElement: BpmnElement | null = null;
let currentRootId: string | null = null;
let flowableState: FlowableDocumentState = createEmptyFlowableState();
let metadataSaveTimer: number | undefined;
let pendingFilePickTextArea: { textarea: HTMLTextAreaElement; elementId: string } | null = null;
let fieldIdCounter = 0;

function nextFieldId(prefix: string): string {
	fieldIdCounter += 1;
	return `fld-${prefix}-${fieldIdCounter}`;
}

// UI state (persisted across reloads)
const savedUiState = (vscode.getState() || {}) as { collapsedGroups?: string[]; sidebarWidth?: number };
const collapsedGroups = new Set<string>(savedUiState.collapsedGroups || []);
let sidebarWidth = savedUiState.sidebarWidth ?? 320;

function persistUiState(): void {
	const current = (vscode.getState() || {}) as Record<string, unknown>;
	vscode.setState({ ...current, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
}

function updateDirtyIndicator(dirty: boolean): void {
	unsavedDot.classList.toggle('visible', dirty);
}

function updateUndoRedoState(): void {
	btnUndo.disabled = !commandStack.canUndo();
	btnRedo.disabled = !commandStack.canRedo();
}

function postMessage(message: WebviewToHostMessage): void {
	vscode.postMessage(message);
}

function ensureElementState(element: BpmnElement): FlowableElementState {
	const id = getElementId(element);
	const type = getElementType(element);
	const existing = flowableState.elements[id];

	if (existing) {
		existing.type = type;
		return existing;
	}

	const created = createElementState(id, type);
	flowableState.elements[id] = created;
	return created;
}

function renameElementState(oldId: string, newId: string, type: string): void {
	if (!newId || oldId === newId) {
		return;
	}

	const current = flowableState.elements[oldId] || createElementState(oldId, type);
	delete flowableState.elements[oldId];
	flowableState.elements[newId] = {
		...current,
		id: newId,
		type,
	};
	selectedElement = elementRegistry.get(newId) || selectedElement;
	renderProperties();
}

function queueMetadataSave(): void {
	if (metadataSaveTimer) {
		window.clearTimeout(metadataSaveTimer);
	}

	updateDirtyIndicator(true);
	metadataSaveTimer = window.setTimeout(() => {
		void saveXml();
	}, 120);
}

function updateGeneralProperty(property: 'id' | 'name', value: string): void {
	if (!selectedElement) {
		return;
	}

	if (property === 'id') {
		const nextId = value.trim();
		if (!nextId) {
			return;
		}

		const previousId = getElementId(selectedElement);
		renameElementState(previousId, nextId, getElementType(selectedElement));
		modeling.updateProperties(selectedElement, { id: nextId });
		queueMetadataSave();
		return;
	}

	modeling.updateProperties(selectedElement, { name: value });
}

function updateFlowableAttribute(attribute: FlowableAttributeKey, value: string | boolean): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	const stringValue = typeof value === 'boolean' ? (value ? 'true' : '') : value.trim();

	if (stringValue) {
		elementState.activitiAttributes[attribute] = stringValue;
	} else {
		delete elementState.activitiAttributes[attribute];
	}

	queueMetadataSave();
	setStatus('Flowable properties updated');
	renderProperties();
}

function updateFieldExtension(index: number, patch: Partial<FlowableFieldExtension>): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	const nextFieldExtensions = elementState.fieldExtensions.map((fieldExtension, fieldIndex) => {
		if (fieldIndex !== index) {
			return fieldExtension;
		}

		return {
			...fieldExtension,
			...patch,
		};
	});

	if (!nextFieldExtensions[index]) {
		return;
	}

	elementState.fieldExtensions = nextFieldExtensions;
	queueMetadataSave();
	setStatus('Field extensions updated');
	renderProperties();
}

function removeFieldExtension(index: number): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	elementState.fieldExtensions = elementState.fieldExtensions.filter((_, fieldIndex) => fieldIndex !== index);
	queueMetadataSave();
	setStatus('Field extension removed');
	renderProperties();
}

function addFieldExtension(): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	elementState.fieldExtensions = [...elementState.fieldExtensions, createFieldExtension()];
	queueMetadataSave();
	setStatus('Field extension added');
	renderProperties();
}

function updateListener(kind: 'task' | 'execution', index: number, patch: Partial<FlowableListener>): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	const key = kind === 'task' ? 'taskListeners' : 'executionListeners';
	const nextListeners = elementState[key].map((listener, listenerIndex) => {
		if (listenerIndex !== index) {
			return listener;
		}

		return {
			...listener,
			...patch,
		};
	});

	elementState[key] = nextListeners;
	queueMetadataSave();
	setStatus('Listener updated');
	renderProperties();
}

function addListener(kind: 'task' | 'execution'): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	const key = kind === 'task' ? 'taskListeners' : 'executionListeners';
	elementState[key] = [...elementState[key], createListener(kind)];
	queueMetadataSave();
	setStatus('Listener added');
	renderProperties();
}

function removeListener(kind: 'task' | 'execution', index: number): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	const key = kind === 'task' ? 'taskListeners' : 'executionListeners';
	elementState[key] = elementState[key].filter((_, listenerIndex) => listenerIndex !== index);
	queueMetadataSave();
	setStatus('Listener removed');
	renderProperties();
}

function updateFormProperty(index: number, patch: Partial<FlowableFormProperty>): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	elementState.formProperties = elementState.formProperties.map((formProperty, formPropertyIndex) => {
		if (formPropertyIndex !== index) {
			return formProperty;
		}

		return {
			...formProperty,
			...patch,
		};
	});
	queueMetadataSave();
	setStatus('Form property updated');
	renderProperties();
}

function addFormProperty(): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	elementState.formProperties = [...elementState.formProperties, createFormProperty()];
	queueMetadataSave();
	setStatus('Form property added');
	renderProperties();
}

function removeFormProperty(index: number): void {
	if (!selectedElement) {
		return;
	}

	const elementState = ensureElementState(selectedElement);
	elementState.formProperties = elementState.formProperties.filter((_, formPropertyIndex) => formPropertyIndex !== index);
	queueMetadataSave();
	setStatus('Form property removed');
	renderProperties();
}

function updateConditionExpression(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.conditionExpression = value;
	queueMetadataSave();
	setStatus('Condition expression updated');
}

function updateScript(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.script = value;
	queueMetadataSave();
	setStatus('Script updated');
}

function updateMultiInstance(patch: Partial<FlowableMultiInstance>): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	if (!elementState.multiInstance) {
		elementState.multiInstance = {
			sequential: false,
			loopCardinality: '',
			collection: '',
			elementVariable: '',
			completionCondition: '',
		};
	}
	Object.assign(elementState.multiInstance, patch);
	queueMetadataSave();
	setStatus('Multi-instance updated');
	renderProperties();
}

function removeMultiInstance(): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.multiInstance = null;
	queueMetadataSave();
	setStatus('Multi-instance removed');
	renderProperties();
}

let ioParamCounter = 0;
function createIOParameter(): FlowableIOParameter {
	ioParamCounter += 1;
	return { id: `io-param-${ioParamCounter}`, source: '', sourceExpression: '', target: '' };
}

function updateIOParameter(kind: 'input' | 'output', index: number, patch: Partial<FlowableIOParameter>): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	const key = kind === 'input' ? 'inputParameters' : 'outputParameters';
	elementState[key] = elementState[key].map((param, i) => i === index ? { ...param, ...patch } : param);
	queueMetadataSave();
	setStatus('IO parameter updated');
	renderProperties();
}

function addIOParameter(kind: 'input' | 'output'): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	const key = kind === 'input' ? 'inputParameters' : 'outputParameters';
	elementState[key] = [...elementState[key], createIOParameter()];
	queueMetadataSave();
	setStatus('IO parameter added');
	renderProperties();
}

function removeIOParameter(kind: 'input' | 'output', index: number): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	const key = kind === 'input' ? 'inputParameters' : 'outputParameters';
	elementState[key] = elementState[key].filter((_, i) => i !== index);
	queueMetadataSave();
	setStatus('IO parameter removed');
	renderProperties();
}

function updateTimerDefinition(patch: Partial<FlowableTimerDefinition>): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	if (!elementState.timerDefinition) {
		elementState.timerDefinition = { type: 'timeDuration', value: '' };
	}
	Object.assign(elementState.timerDefinition, patch);
	queueMetadataSave();
	setStatus('Timer definition updated');
	renderProperties();
}

function updateErrorRef(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.errorRef = value;
	queueMetadataSave();
	setStatus('Error reference updated');
}

function updateSignalRef(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.signalRef = value;
	queueMetadataSave();
	setStatus('Signal reference updated');
}

function updateMessageRef(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.messageRef = value;
	queueMetadataSave();
	setStatus('Message reference updated');
}

function updateTerminateAll(checked: boolean): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.terminateAll = checked ? 'true' : '';
	queueMetadataSave();
	setStatus('Terminate all updated');
}

function updateCompensateActivityRef(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.compensateActivityRef = value;
	queueMetadataSave();
	setStatus('Compensate activity reference updated');
}

function updateIsForCompensation(checked: boolean): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.isForCompensation = checked ? 'true' : '';
	queueMetadataSave();
	setStatus('Is for compensation updated');
}

function updateFailedJobRetryTimeCycle(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.failedJobRetryTimeCycle = value;
	queueMetadataSave();
	setStatus('Failed job retry time cycle updated');
}

function updateDocumentation(value: string): void {
	if (!selectedElement) { return; }
	const elementState = ensureElementState(selectedElement);
	elementState.documentation = value;
	queueMetadataSave();
	setStatus('Documentation updated');
}

let signalDefCounter = 0;
function addSignalDefinition(): void {
	signalDefCounter += 1;
	flowableState.signalDefinitions.push({ id: `signal-${signalDefCounter}`, name: '', scope: '' });
	queueMetadataSave();
	renderProperties();
}
function updateSignalDefinition(index: number, patch: Partial<FlowableSignalDefinition>): void {
	const def = flowableState.signalDefinitions[index];
	if (!def) { return; }
	Object.assign(def, patch);
	queueMetadataSave();
	renderProperties();
}
function removeSignalDefinition(index: number): void {
	flowableState.signalDefinitions.splice(index, 1);
	queueMetadataSave();
	renderProperties();
}

let messageDefCounter = 0;
function addMessageDefinition(): void {
	messageDefCounter += 1;
	flowableState.messageDefinitions.push({ id: `message-${messageDefCounter}`, name: '' });
	queueMetadataSave();
	renderProperties();
}
function updateMessageDefinition(index: number, patch: Partial<FlowableMessageDefinition>): void {
	const def = flowableState.messageDefinitions[index];
	if (!def) { return; }
	Object.assign(def, patch);
	queueMetadataSave();
	renderProperties();
}
function removeMessageDefinition(index: number): void {
	flowableState.messageDefinitions.splice(index, 1);
	queueMetadataSave();
	renderProperties();
}

let eventListenerCounter = 0;
function addEventListener(): void {
	eventListenerCounter += 1;
	flowableState.eventListeners.push({
		id: `event-listener-${eventListenerCounter}`,
		events: '',
		implementationType: 'class',
		implementation: '',
		entityType: '',
	});
	queueMetadataSave();
	renderProperties();
}
function updateEventListener(index: number, patch: Partial<FlowableEventListener>): void {
	const listener = flowableState.eventListeners[index];
	if (!listener) { return; }
	Object.assign(listener, patch);
	queueMetadataSave();
	renderProperties();
}
function removeEventListener(index: number): void {
	flowableState.eventListeners.splice(index, 1);
	queueMetadataSave();
	renderProperties();
}

function updateTargetNamespace(value: string): void {
	flowableState.targetNamespace = value;
	queueMetadataSave();
	setStatus('Target namespace updated');
}

let localizationCounter = 0;
function addLocalization(): void {
	localizationCounter += 1;
	flowableState.localizations.push({ id: `localization-${localizationCounter}`, locale: '', name: '', description: '' });
	queueMetadataSave();
	renderProperties();
}
function updateLocalization(index: number, patch: Partial<FlowableLocalization>): void {
	const loc = flowableState.localizations[index];
	if (!loc) { return; }
	Object.assign(loc, patch);
	queueMetadataSave();
	renderProperties();
}
function removeLocalization(index: number): void {
	flowableState.localizations.splice(index, 1);
	queueMetadataSave();
	renderProperties();
}

function renderIOParameters(group: HTMLDivElement, params: FlowableIOParameter[], kind: 'input' | 'output'): void {
	params.forEach((param, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		makeDraggableItem(item, index, params, `io-${kind}`, () => { queueMetadataSave(); renderProperties(); });
		item.appendChild(createField('Source', createTextInput(param.source, (v) => updateIOParameter(kind, index, { source: v }))));
		item.appendChild(createField('Source Expression', createTextInput(param.sourceExpression, (v) => updateIOParameter(kind, index, { sourceExpression: v }))));
		item.appendChild(createField('Target', createTextInput(param.target, (v) => updateIOParameter(kind, index, { target: v }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = `Remove ${kind === 'input' ? 'Input' : 'Output'} Parameter`;
		removeButton.addEventListener('click', () => removeIOParameter(kind, index));
		item.appendChild(removeButton);
		group.appendChild(item);
	});

	const actions = document.createElement('div');
	actions.className = 'properties-actions';
	const addButton = document.createElement('button');
	addButton.type = 'button';
	addButton.textContent = `Add ${kind === 'input' ? 'Input' : 'Output'} Parameter`;
	addButton.addEventListener('click', () => addIOParameter(kind));
	actions.appendChild(addButton);
	group.appendChild(actions);
}

function renderMultiInstance(group: HTMLDivElement, mi: FlowableMultiInstance): void {
	group.appendChild(createField('Sequential', createCheckbox(mi.sequential, (v) => updateMultiInstance({ sequential: v })), true));
	group.appendChild(createField('Loop Cardinality', createTextInput(mi.loopCardinality, (v) => updateMultiInstance({ loopCardinality: v }))));
	group.appendChild(createField('Collection', createTextInput(mi.collection, (v) => updateMultiInstance({ collection: v }))));
	group.appendChild(createField('Element Variable', createTextInput(mi.elementVariable, (v) => updateMultiInstance({ elementVariable: v }))));
	group.appendChild(createField('Completion Condition', createTextInput(mi.completionCondition, (v) => updateMultiInstance({ completionCondition: v }))));
	const removeButton = document.createElement('button');
	removeButton.type = 'button';
	removeButton.className = 'btn-remove';
	removeButton.textContent = 'Remove Multi-Instance';
	removeButton.addEventListener('click', removeMultiInstance);
	group.appendChild(removeButton);
}

function renderFieldExtensions(group: HTMLDivElement, elementState: FlowableElementState): void {
	elementState.fieldExtensions.forEach((fieldExtension, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		makeDraggableItem(item, index, elementState.fieldExtensions, 'field-extensions', () => { queueMetadataSave(); renderProperties(); });

		item.appendChild(
			createField('Name', createTextInput(fieldExtension.name, (nextValue) => {
				updateFieldExtension(index, { name: nextValue });
			})),
		);

		const typeSelect = document.createElement('select');
		for (const valueType of ['string', 'expression'] as const) {
			const option = document.createElement('option');
			option.value = valueType;
			option.textContent = valueType === 'string' ? 'String' : 'Expression';
			option.selected = fieldExtension.valueType === valueType;
			typeSelect.appendChild(option);
		}
		typeSelect.addEventListener('change', () => {
			updateFieldExtension(index, { valueType: typeSelect.value as FlowableFieldExtension['valueType'] });
		});
		item.appendChild(createField('Value Type', typeSelect));

		item.appendChild(
			createField('Value', createTextInput(fieldExtension.value, (nextValue) => {
				updateFieldExtension(index, { value: nextValue });
			})),
		);

		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Field Extension';
		removeButton.addEventListener('click', () => {
			removeFieldExtension(index);
		});
		item.appendChild(removeButton);

		group.appendChild(item);
	});

	const actions = document.createElement('div');
	actions.className = 'properties-actions';
	const addButton = document.createElement('button');
	addButton.type = 'button';
	addButton.textContent = 'Add Field Extension';
	addButton.addEventListener('click', addFieldExtension);
	actions.appendChild(addButton);
	group.appendChild(actions);
}

function renderListeners(group: HTMLDivElement, listeners: FlowableListener[], kind: 'task' | 'execution'): void {
	const eventOptions = kind === 'task'
		? ['create', 'assignment', 'complete', 'delete']
		: ['start', 'end', 'take'];

	listeners.forEach((listener, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		makeDraggableItem(item, index, listeners, `listeners-${kind}`, () => { queueMetadataSave(); renderProperties(); });

		const eventSelect = document.createElement('select');
		for (const eventName of eventOptions) {
			const option = document.createElement('option');
			option.value = eventName;
			option.textContent = eventName;
			option.selected = listener.event === eventName;
			eventSelect.appendChild(option);
		}
		eventSelect.addEventListener('change', () => {
			updateListener(kind, index, { event: eventSelect.value as FlowableListener['event'] });
		});
		item.appendChild(createField('Event', eventSelect));

		const implementationTypeSelect = document.createElement('select');
		for (const implementationType of ['class', 'expression', 'delegateExpression'] as const) {
			const option = document.createElement('option');
			option.value = implementationType;
			option.textContent = implementationType;
			option.selected = listener.implementationType === implementationType;
			implementationTypeSelect.appendChild(option);
		}
		implementationTypeSelect.addEventListener('change', () => {
			updateListener(kind, index, { implementationType: implementationTypeSelect.value as FlowableListener['implementationType'] });
		});
		item.appendChild(createField('Implementation Type', implementationTypeSelect));

		item.appendChild(createField('Implementation', createTextInput(listener.implementation, (nextValue) => {
			updateListener(kind, index, { implementation: nextValue });
		})));

		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = kind === 'task' ? 'Remove Task Listener' : 'Remove Execution Listener';
		removeButton.addEventListener('click', () => {
			removeListener(kind, index);
		});
		item.appendChild(removeButton);

		group.appendChild(item);
	});

	const actions = document.createElement('div');
	actions.className = 'properties-actions';
	const addButton = document.createElement('button');
	addButton.type = 'button';
	addButton.textContent = kind === 'task' ? 'Add Task Listener' : 'Add Execution Listener';
	addButton.addEventListener('click', () => {
		addListener(kind);
	});
	actions.appendChild(addButton);
	group.appendChild(actions);
}

function renderFormProperties(group: HTMLDivElement, formProperties: FlowableFormProperty[]): void {
	formProperties.forEach((formProperty, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		makeDraggableItem(item, index, formProperties, 'form-properties', () => { queueMetadataSave(); renderProperties(); });

		item.appendChild(createField('ID', createTextInput(formProperty.id, (nextValue) => {
			updateFormProperty(index, { id: nextValue });
		})));
		item.appendChild(createField('Name', createTextInput(formProperty.name, (nextValue) => {
			updateFormProperty(index, { name: nextValue });
		})));

		const typeSelect = document.createElement('select');
		for (const type of ['string', 'long', 'boolean', 'date', 'enum'] as const) {
			const option = document.createElement('option');
			option.value = type;
			option.textContent = type;
			option.selected = formProperty.type === type;
			typeSelect.appendChild(option);
		}
		typeSelect.addEventListener('change', () => {
			updateFormProperty(index, { type: typeSelect.value as FlowableFormProperty['type'] });
		});
		item.appendChild(createField('Type', typeSelect));

		item.appendChild(createField('Default', createTextInput(formProperty.defaultValue, (nextValue) => {
			updateFormProperty(index, { defaultValue: nextValue });
		})));
		item.appendChild(createField('Required', createCheckbox(formProperty.required, (checked) => {
			updateFormProperty(index, { required: checked });
		}), true));
		item.appendChild(createField('Readable', createCheckbox(formProperty.readable, (checked) => {
			updateFormProperty(index, { readable: checked });
		}), true));
		item.appendChild(createField('Writable', createCheckbox(formProperty.writable, (checked) => {
			updateFormProperty(index, { writable: checked });
		}), true));

		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Form Property';
		removeButton.addEventListener('click', () => {
			removeFormProperty(index);
		});
		item.appendChild(removeButton);

		group.appendChild(item);
	});

	const actions = document.createElement('div');
	actions.className = 'properties-actions';
	const addButton = document.createElement('button');
	addButton.type = 'button';
	addButton.textContent = 'Add Form Property';
	addButton.addEventListener('click', addFormProperty);
	actions.appendChild(addButton);
	group.appendChild(actions);
}

function renderAttributeGroup(groupTitle: string, attributes: FlowableAttributeKey[], elementState: FlowableElementState): HTMLDivElement {
	const group = createGroup(groupTitle);

	for (const attribute of attributes) {
		const label = editableLabels[attribute] || attribute;
		if (attribute === 'async' || attribute === 'exclusive') {
			group.appendChild(
				createField(
					label,
					createCheckbox(elementState.activitiAttributes[attribute] === 'true', (checked) => {
						updateFlowableAttribute(attribute, checked);
					}),
					true,
				),
			);
			continue;
		}

		group.appendChild(
			createField(
				label,
				createTextInput(elementState.activitiAttributes[attribute] || '', (nextValue) => {
					updateFlowableAttribute(attribute, nextValue);
				}, attributePlaceholders[attribute]),
			),
		);
	}

	return group;
}

function renderProperties(): void {
	const scrollContainer = properties.closest('.sidebar');
	const scrollTop = scrollContainer?.scrollTop ?? 0;

	fieldIdCounter = 0;
	properties.replaceChildren();

	if (!selectedElement) {
		const message = document.createElement('p');
		message.textContent = 'Select a BPMN element to edit Flowable-specific properties.';
		properties.appendChild(message);
		return;
	}

	const generalGroup = createGroup('General');
	const businessObject = getBusinessObject(selectedElement);
	const typeInput = createTextInput(getElementType(selectedElement), () => {});
	typeInput.readOnly = true;
	generalGroup.appendChild(createField('Type', typeInput));
	generalGroup.appendChild(
		createField('ID', createTextInput(getElementId(selectedElement), (nextValue) => {
			updateGeneralProperty('id', nextValue);
		}, undefined, validateId)),
	);
	generalGroup.appendChild(
		createField('Name', createTextInput(typeof businessObject.name === 'string' ? businessObject.name : '', (nextValue) => {
			updateGeneralProperty('name', nextValue);
		})),
	);
	properties.appendChild(generalGroup);

	const elementState = ensureElementState(selectedElement);

	// Documentation (available on any element)
	const docGroup = createGroup('Documentation');
	docGroup.appendChild(createField('Documentation', createTextArea(elementState.documentation, (nextValue) => {
		updateDocumentation(nextValue);
	}, 'Enter element documentation...')));
	properties.appendChild(docGroup);

	if (isProcess(selectedElement)) {
		// Target Namespace
		const nsGroup = createGroup('Process Namespace');
		nsGroup.appendChild(createField('Target Namespace', createTextInput(flowableState.targetNamespace, (nextValue) => {
			updateTargetNamespace(nextValue);
		}, 'e.g. http://www.flowable.org/processdef')));
		properties.appendChild(nsGroup);

		properties.appendChild(renderAttributeGroup('Process', processAttributes, elementState));

		// Signal Definitions
		const signalGroup = createGroup('Signal Definitions');
		flowableState.signalDefinitions.forEach((signalDef, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			makeDraggableItem(item, index, flowableState.signalDefinitions, 'signal-defs', () => { queueMetadataSave(); renderProperties(); });
			item.appendChild(createField('ID', createTextInput(signalDef.id, (v) => updateSignalDefinition(index, { id: v }))));
			item.appendChild(createField('Name', createTextInput(signalDef.name, (v) => updateSignalDefinition(index, { name: v }))));
			item.appendChild(createField('Scope', createSelect(
				['', 'global', 'processInstance'],
				signalDef.scope || '',
				(v) => updateSignalDefinition(index, { scope: v }),
			)));
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'btn-remove';
			removeBtn.textContent = 'Remove Signal';
			removeBtn.addEventListener('click', () => removeSignalDefinition(index));
			item.appendChild(removeBtn);
			signalGroup.appendChild(item);
		});
		const signalActions = document.createElement('div');
		signalActions.className = 'properties-actions';
		const addSignalBtn = document.createElement('button');
		addSignalBtn.type = 'button';
		addSignalBtn.textContent = 'Add Signal';
		addSignalBtn.addEventListener('click', addSignalDefinition);
		signalActions.appendChild(addSignalBtn);
		signalGroup.appendChild(signalActions);
		properties.appendChild(signalGroup);

		// Message Definitions
		const messageGroup = createGroup('Message Definitions');
		flowableState.messageDefinitions.forEach((messageDef, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			makeDraggableItem(item, index, flowableState.messageDefinitions, 'message-defs', () => { queueMetadataSave(); renderProperties(); });
			item.appendChild(createField('ID', createTextInput(messageDef.id, (v) => updateMessageDefinition(index, { id: v }))));
			item.appendChild(createField('Name', createTextInput(messageDef.name, (v) => updateMessageDefinition(index, { name: v }))));
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'btn-remove';
			removeBtn.textContent = 'Remove Message';
			removeBtn.addEventListener('click', () => removeMessageDefinition(index));
			item.appendChild(removeBtn);
			messageGroup.appendChild(item);
		});
		const msgActions = document.createElement('div');
		msgActions.className = 'properties-actions';
		const addMsgBtn = document.createElement('button');
		addMsgBtn.type = 'button';
		addMsgBtn.textContent = 'Add Message';
		addMsgBtn.addEventListener('click', addMessageDefinition);
		msgActions.appendChild(addMsgBtn);
		messageGroup.appendChild(msgActions);
		properties.appendChild(messageGroup);

		// Event Listeners
		const eventListenersGroup = createGroup('Event Listeners');
		const implTypes: FlowableEventListenerImplType[] = ['class', 'delegateExpression', 'throwSignalEvent', 'throwGlobalSignalEvent', 'throwMessageEvent', 'throwErrorEvent'];
		flowableState.eventListeners.forEach((listener, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			makeDraggableItem(item, index, flowableState.eventListeners, 'event-listeners', () => { queueMetadataSave(); renderProperties(); });
			item.appendChild(createField('Events', createTextInput(listener.events, (v) => updateEventListener(index, { events: v }))));
			item.appendChild(createField('Implementation Type', createSelect(
				implTypes,
				listener.implementationType,
				(v) => updateEventListener(index, { implementationType: v as FlowableEventListenerImplType }),
			)));
			item.appendChild(createField('Implementation', createTextInput(listener.implementation, (v) => updateEventListener(index, { implementation: v }))));
			item.appendChild(createField('Entity Type', createTextInput(listener.entityType, (v) => updateEventListener(index, { entityType: v }))));
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'btn-remove';
			removeBtn.textContent = 'Remove Event Listener';
			removeBtn.addEventListener('click', () => removeEventListener(index));
			item.appendChild(removeBtn);
			eventListenersGroup.appendChild(item);
		});
		const elActions = document.createElement('div');
		elActions.className = 'properties-actions';
		const addElBtn = document.createElement('button');
		addElBtn.type = 'button';
		addElBtn.textContent = 'Add Event Listener';
		addElBtn.addEventListener('click', addEventListener);
		elActions.appendChild(addElBtn);
		eventListenersGroup.appendChild(elActions);
		properties.appendChild(eventListenersGroup);

		// Localizations (multi-language support)
		const locGroup = createGroup('Localizations');
		flowableState.localizations.forEach((loc, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			makeDraggableItem(item, index, flowableState.localizations, 'localizations', () => { queueMetadataSave(); renderProperties(); });
			item.appendChild(createField('Locale', createTextInput(loc.locale, (v) => updateLocalization(index, { locale: v }))));
			item.appendChild(createField('Name', createTextInput(loc.name, (v) => updateLocalization(index, { name: v }))));
			item.appendChild(createField('Description', createTextArea(loc.description, (v) => updateLocalization(index, { description: v }))));
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'btn-remove';
			removeBtn.textContent = 'Remove Localization';
			removeBtn.addEventListener('click', () => removeLocalization(index));
			item.appendChild(removeBtn);
			locGroup.appendChild(item);
		});
		const locActions = document.createElement('div');
		locActions.className = 'properties-actions';
		const addLocBtn = document.createElement('button');
		addLocBtn.type = 'button';
		addLocBtn.textContent = 'Add Localization';
		addLocBtn.addEventListener('click', addLocalization);
		locActions.appendChild(addLocBtn);
		locGroup.appendChild(locActions);
		properties.appendChild(locGroup);

		// Data Objects (read-only display + preservation)
		if (flowableState.dataObjects.length > 0) {
			const dataGroup = createGroup('Data Objects');
			flowableState.dataObjects.forEach((dataObj, index) => {
				const item = document.createElement('div');
				item.className = 'field-array-item';
				makeDraggableItem(item, index, flowableState.dataObjects, 'data-objects', () => { queueMetadataSave(); renderProperties(); });
				item.appendChild(createField('ID', createTextInput(dataObj.id, (v) => {
					flowableState.dataObjects[index].id = v;
					queueMetadataSave();
					renderProperties();
				})));
				item.appendChild(createField('Name', createTextInput(dataObj.name, (v) => {
					flowableState.dataObjects[index].name = v;
					queueMetadataSave();
					renderProperties();
				})));
				item.appendChild(createField('Type', createTextInput(dataObj.itemSubjectRef, (v) => {
					flowableState.dataObjects[index].itemSubjectRef = v;
					queueMetadataSave();
					renderProperties();
				})));
				item.appendChild(createField('Default Value', createTextInput(dataObj.defaultValue, (v) => {
					flowableState.dataObjects[index].defaultValue = v;
					queueMetadataSave();
					renderProperties();
				})));
				const removeBtn = document.createElement('button');
				removeBtn.type = 'button';
				removeBtn.className = 'btn-remove';
				removeBtn.textContent = 'Remove Data Object';
				removeBtn.addEventListener('click', () => {
					flowableState.dataObjects.splice(index, 1);
					queueMetadataSave();
					renderProperties();
				});
				item.appendChild(removeBtn);
				dataGroup.appendChild(item);
			});
			const dataActions = document.createElement('div');
			dataActions.className = 'properties-actions';
			const addDataBtn = document.createElement('button');
			addDataBtn.type = 'button';
			addDataBtn.textContent = 'Add Data Object';
			addDataBtn.addEventListener('click', () => {
				flowableState.dataObjects.push({ id: `dataObj-${Date.now()}`, name: '', itemSubjectRef: 'xsd:string', defaultValue: '' });
				queueMetadataSave();
				renderProperties();
			});
			dataActions.appendChild(addDataBtn);
			dataGroup.appendChild(dataActions);
			properties.appendChild(dataGroup);
		}
	}

	if (isUserTask(selectedElement)) {
		properties.appendChild(renderAttributeGroup('User Task', userTaskAttributes, elementState));
		const formPropertiesGroup = createGroup('Form Properties');
		renderFormProperties(formPropertiesGroup, elementState.formProperties);
		properties.appendChild(formPropertiesGroup);
		const taskListenersGroup = createGroup('Task Listeners');
		renderListeners(taskListenersGroup, elementState.taskListeners, 'task');
		properties.appendChild(taskListenersGroup);
	}

	if (isGenericServiceTask(selectedElement)) {
		properties.appendChild(renderAttributeGroup('Service Task', serviceTaskAttributes, elementState));
		const fieldExtensionsGroup = createGroup('Field Extensions');
		renderFieldExtensions(fieldExtensionsGroup, elementState);
		properties.appendChild(fieldExtensionsGroup);

		// Exception Mapping
		const exceptionGroup = createGroup('Exception Mapping');
		elementState.exceptionMaps.forEach((em, idx) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			makeDraggableItem(item, idx, elementState.exceptionMaps, 'exception-maps', () => { queueMetadataSave(); renderProperties(); });
			item.appendChild(createField('Error Code', createTextInput(em.errorCode, (v) => {
				elementState.exceptionMaps[idx].errorCode = v;
				queueMetadataSave();
				renderProperties();
			})));
			item.appendChild(createField('Class Name', createTextInput(em.className, (v) => {
				elementState.exceptionMaps[idx].className = v;
				queueMetadataSave();
				renderProperties();
			})));
			item.appendChild(createField('Include Child Exceptions', createCheckbox(em.includeChildExceptions, (checked) => {
				elementState.exceptionMaps[idx].includeChildExceptions = checked;
				queueMetadataSave();
				renderProperties();
			}), true));
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'btn-remove';
			removeBtn.textContent = 'Remove';
			removeBtn.addEventListener('click', () => {
				elementState.exceptionMaps.splice(idx, 1);
				queueMetadataSave();
				renderProperties();
			});
			item.appendChild(removeBtn);
			exceptionGroup.appendChild(item);
		});
		const exActions = document.createElement('div');
		exActions.className = 'properties-actions';
		const addExBtn = document.createElement('button');
		addExBtn.type = 'button';
		addExBtn.textContent = 'Add Exception Mapping';
		addExBtn.addEventListener('click', () => {
			elementState.exceptionMaps.push({
				id: `exception-${Date.now()}`,
				errorCode: '',
				className: '',
				includeChildExceptions: false,
			});
			queueMetadataSave();
			renderProperties();
		});
		exActions.appendChild(addExBtn);
		exceptionGroup.appendChild(exActions);
		properties.appendChild(exceptionGroup);
	}

	if (isMailTask(selectedElement)) {
		const mailGroup = createGroup('Mail Task');
		const mailFields = ['to', 'from', 'subject', 'cc', 'bcc', 'charset'] as const;
		for (const fieldName of mailFields) {
			const existing = elementState.fieldExtensions.find((f) => f.name === fieldName);
			mailGroup.appendChild(createField(
				fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
				createTextInput(existing?.value || '', (nextValue) => {
					const idx = elementState.fieldExtensions.findIndex((f) => f.name === fieldName);
					if (idx >= 0) {
						updateFieldExtension(idx, { value: nextValue });
					} else {
						if (!selectedElement) { return; }
						const es = ensureElementState(selectedElement);
						fieldCounter += 1;
						es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: fieldName, valueType: 'string', value: nextValue });
						queueMetadataSave();
						renderProperties();
					}
				}),
			));
		}
		mailGroup.appendChild(createField('Html', createTextArea(
			elementState.fieldExtensions.find((f) => f.name === 'html')?.value || '',
			(nextValue) => {
				const idx = elementState.fieldExtensions.findIndex((f) => f.name === 'html');
				if (idx >= 0) {
					updateFieldExtension(idx, { value: nextValue });
				} else {
					if (!selectedElement) { return; }
					const es = ensureElementState(selectedElement);
					fieldCounter += 1;
					es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: 'html', valueType: 'string', value: nextValue });
					queueMetadataSave();
					renderProperties();
				}
			},
		)));
		mailGroup.appendChild(createField('Non-html text', createTextArea(
			elementState.fieldExtensions.find((f) => f.name === 'text')?.value || '',
			(nextValue) => {
				const idx = elementState.fieldExtensions.findIndex((f) => f.name === 'text');
				if (idx >= 0) {
					updateFieldExtension(idx, { value: nextValue });
				} else {
					if (!selectedElement) { return; }
					const es = ensureElementState(selectedElement);
					fieldCounter += 1;
					es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: 'text', valueType: 'string', value: nextValue });
					queueMetadataSave();
					renderProperties();
				}
			},
		)));
		properties.appendChild(mailGroup);
	}

	if (isHttpTask(selectedElement)) {
		const httpGroup = createGroup('Http Task');
		const httpTextFields = ['requestMethod', 'requestUrl', 'requestHeaders', 'requestTimeout', 'failStatusCodes', 'handleStatusCodes', 'resultVariablePrefix'] as const;
		for (const fieldName of httpTextFields) {
			const existing = elementState.fieldExtensions.find((f) => f.name === fieldName);
			httpGroup.appendChild(createField(
				fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
				createTextInput(existing?.value || '', (nextValue) => {
					const idx = elementState.fieldExtensions.findIndex((f) => f.name === fieldName);
					if (idx >= 0) {
						updateFieldExtension(idx, { value: nextValue });
					} else {
						if (!selectedElement) { return; }
						const es = ensureElementState(selectedElement);
						fieldCounter += 1;
						es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: fieldName, valueType: 'string', value: nextValue });
						queueMetadataSave();
						renderProperties();
					}
				}),
			));
		}
		httpGroup.appendChild(createField('Request Body', createTextArea(
			elementState.fieldExtensions.find((f) => f.name === 'requestBody')?.value || '',
			(nextValue) => {
				const idx = elementState.fieldExtensions.findIndex((f) => f.name === 'requestBody');
				if (idx >= 0) {
					updateFieldExtension(idx, { value: nextValue });
				} else {
					if (!selectedElement) { return; }
					const es = ensureElementState(selectedElement);
					fieldCounter += 1;
					es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: 'requestBody', valueType: 'string', value: nextValue });
					queueMetadataSave();
					renderProperties();
				}
			},
		)));
		const httpCheckboxFields = ['disallowRedirects', 'ignoreException', 'saveRequestVariables', 'saveResponseParameters'] as const;
		for (const fieldName of httpCheckboxFields) {
			const existing = elementState.fieldExtensions.find((f) => f.name === fieldName);
			httpGroup.appendChild(createField(
				fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
				createCheckbox(existing?.value === 'true', (checked) => {
					const idx = elementState.fieldExtensions.findIndex((f) => f.name === fieldName);
					if (idx >= 0) {
						updateFieldExtension(idx, { value: checked ? 'true' : 'false' });
					} else {
						if (!selectedElement) { return; }
						const es = ensureElementState(selectedElement);
						fieldCounter += 1;
						es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: fieldName, valueType: 'string', value: checked ? 'true' : 'false' });
						queueMetadataSave();
						renderProperties();
					}
				}),
				true,
			));
		}
		properties.appendChild(httpGroup);
	}

	if (isShellTask(selectedElement)) {
		const shellGroup = createGroup('Shell Task');
		const shellTextFields = ['command', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5', 'outputVariable', 'errorCodeVariable', 'directory'] as const;
		for (const fieldName of shellTextFields) {
			const existing = elementState.fieldExtensions.find((f) => f.name === fieldName);
			shellGroup.appendChild(createField(
				fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
				createTextInput(existing?.value || '', (nextValue) => {
					const idx = elementState.fieldExtensions.findIndex((f) => f.name === fieldName);
					if (idx >= 0) {
						updateFieldExtension(idx, { value: nextValue });
					} else {
						if (!selectedElement) { return; }
						const es = ensureElementState(selectedElement);
						fieldCounter += 1;
						es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: fieldName, valueType: 'string', value: nextValue });
						queueMetadataSave();
						renderProperties();
					}
				}),
			));
		}
		const shellCheckboxFields = ['wait', 'redirectError', 'cleanEnv'] as const;
		for (const fieldName of shellCheckboxFields) {
			const existing = elementState.fieldExtensions.find((f) => f.name === fieldName);
			shellGroup.appendChild(createField(
				fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
				createCheckbox(existing?.value === 'true', (checked) => {
					const idx = elementState.fieldExtensions.findIndex((f) => f.name === fieldName);
					if (idx >= 0) {
						updateFieldExtension(idx, { value: checked ? 'true' : 'false' });
					} else {
						if (!selectedElement) { return; }
						const es = ensureElementState(selectedElement);
						fieldCounter += 1;
						es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: fieldName, valueType: 'string', value: checked ? 'true' : 'false' });
						queueMetadataSave();
						renderProperties();
					}
				}),
				true,
			));
		}
		properties.appendChild(shellGroup);
	}

	if (isExternalWorkerTask(selectedElement)) {
		const ewGroup = createGroup('External Worker Task');
		const topicField = elementState.fieldExtensions.find((f) => f.name === 'topic');
		ewGroup.appendChild(createField('Topic', createTextInput(topicField?.value || '', (nextValue) => {
			const idx = elementState.fieldExtensions.findIndex((f) => f.name === 'topic');
			if (idx >= 0) {
				updateFieldExtension(idx, { value: nextValue });
			} else {
				if (!selectedElement) { return; }
				const es = ensureElementState(selectedElement);
				fieldCounter += 1;
				es.fieldExtensions.push({ id: `field-${fieldCounter}`, name: 'topic', valueType: 'string', value: nextValue });
				queueMetadataSave();
				renderProperties();
			}
		})));
		properties.appendChild(ewGroup);
	}

	if (isSendTask(selectedElement)) {
		properties.appendChild(renderAttributeGroup('Send Task', sendTaskAttributes, elementState));
		const fieldExtensionsGroup = createGroup('Field Extensions');
		renderFieldExtensions(fieldExtensionsGroup, elementState);
		properties.appendChild(fieldExtensionsGroup);
	}

	if (isReceiveTask(selectedElement)) {
		properties.appendChild(renderAttributeGroup('Receive Task', receiveTaskAttributes, elementState));
	}

	if (isManualTask(selectedElement)) {
		properties.appendChild(renderAttributeGroup('Manual Task', manualTaskAttributes, elementState));
	}

	// Pool (Participant)
	if (isParticipant(selectedElement)) {
		const poolGroup = createGroup('Pool');
		const bo = getBusinessObject(selectedElement);
		const processRef = bo.processRef as { id?: string } | undefined;
		poolGroup.appendChild(createField('Process Reference', createTextInput(
			processRef?.id || '',
			() => {}, // Read-only info
		)));
		properties.appendChild(poolGroup);
	}

	// Lane
	if (isLane(selectedElement)) {
		const laneGroup = createGroup('Lane');
		laneGroup.appendChild(createField('Name', createTextInput(
			typeof getBusinessObject(selectedElement).name === 'string' ? getBusinessObject(selectedElement).name as string : '',
			(nextValue) => {
				if (!selectedElement) { return; }
				modeling.updateProperties(selectedElement, { name: nextValue });
				queueMetadataSave();
			},
		)));
		properties.appendChild(laneGroup);
	}

	// Subprocess (embedded, event, transaction)
	if (isSubProcessType(selectedElement)) {
		const subGroup = createGroup('Sub Process');
		if (isEventSubProcess(selectedElement)) {
			const triggeredByEvent = getBusinessObject(selectedElement).triggeredByEvent === true;
			subGroup.appendChild(createField('Event Sub Process', createCheckbox(triggeredByEvent, () => {}), true));
		}
		subGroup.appendChild(createField('Async', createCheckbox(
			elementState.activitiAttributes.async === 'true',
			(checked) => updateFlowableAttribute('async', checked),
		), true));
		subGroup.appendChild(createField('Exclusive', createCheckbox(
			elementState.activitiAttributes.exclusive === 'true',
			(checked) => updateFlowableAttribute('exclusive', checked),
		), true));
		properties.appendChild(subGroup);
	}

	if (isStartEvent(selectedElement)) {
		properties.appendChild(renderAttributeGroup('Start Event', startEventAttributes, elementState));
		const formPropertiesGroup = createGroup('Form Properties');
		renderFormProperties(formPropertiesGroup, elementState.formProperties);
		properties.appendChild(formPropertiesGroup);
	}

	// Event definition properties (timer, error, signal, message)
	if (isEventElement(selectedElement)) {
		const eventDefType = getEventDefinitionType(selectedElement);

		if (eventDefType === 'bpmn:TimerEventDefinition') {
			const timerGroup = createGroup('Timer Definition');
			const timerDef = elementState.timerDefinition || { type: 'timeDuration' as TimerDefinitionType, value: '' };
			timerGroup.appendChild(createField('Timer Type', createSelect(
				['timeDuration', 'timeDate', 'timeCycle'],
				timerDef.type,
				(nextValue) => updateTimerDefinition({ type: nextValue as TimerDefinitionType }),
			)));
			timerGroup.appendChild(createField('Value', createTextInput(timerDef.value, (nextValue) => {
				updateTimerDefinition({ value: nextValue });
			}, 'e.g. PT5M, 2026-12-31T23:59, R3/PT10M', validateTimerValue)));
			properties.appendChild(timerGroup);
		}

		if (eventDefType === 'bpmn:ErrorEventDefinition') {
			const errorGroup = createGroup('Error Definition');
			errorGroup.appendChild(createField('Error Reference', createTextInput(elementState.errorRef, (nextValue) => {
				updateErrorRef(nextValue);
			})));
			properties.appendChild(errorGroup);
		}

		if (eventDefType === 'bpmn:SignalEventDefinition') {
			const signalGroup = createGroup('Signal Definition');
			const signalOptions = flowableState.signalDefinitions.map((s) => ({ value: s.name || s.id, label: s.name || s.id }));
			signalGroup.appendChild(createField('Signal Reference', createReferenceSelect(signalOptions, elementState.signalRef, (nextValue) => {
				updateSignalRef(nextValue);
			}, 'Select a signal...')));
			properties.appendChild(signalGroup);
		}

		if (eventDefType === 'bpmn:MessageEventDefinition') {
			const messageGroup = createGroup('Message Definition');
			const messageOptions = flowableState.messageDefinitions.map((m) => ({ value: m.name || m.id, label: m.name || m.id }));
			messageGroup.appendChild(createField('Message Reference', createReferenceSelect(messageOptions, elementState.messageRef, (nextValue) => {
				updateMessageRef(nextValue);
			}, 'Select a message...')));
			properties.appendChild(messageGroup);
		}

		if (eventDefType === 'bpmn:TerminateEventDefinition') {
			const terminateGroup = createGroup('Terminate End Event');
			terminateGroup.appendChild(createField('Terminate All', createCheckbox(
				elementState.terminateAll === 'true',
				(checked) => updateTerminateAll(checked),
			), true));
			properties.appendChild(terminateGroup);
		}

		if (eventDefType === 'bpmn:CompensateEventDefinition') {
			const compensateGroup = createGroup('Compensate Event');
			compensateGroup.appendChild(createField('Activity Reference', createTextInput(elementState.compensateActivityRef, (nextValue) => {
				updateCompensateActivityRef(nextValue);
			})));
			properties.appendChild(compensateGroup);
		}

		if (eventDefType === 'bpmn:CancelEventDefinition') {
			const cancelGroup = createGroup('Cancel Event');
			const cancelInfo = createTextInput('Cancel Event Definition', () => {});
			cancelInfo.readOnly = true;
			cancelGroup.appendChild(createField('Type', cancelInfo));
			properties.appendChild(cancelGroup);
		}

		if (isBoundaryEvent(selectedElement)) {
			const boundaryGroup = createGroup('Boundary Event');
			const cancelActivity = businessObject.cancelActivity !== false;
			const currentElement = selectedElement;
			boundaryGroup.appendChild(createField('Cancel Activity', createCheckbox(cancelActivity, (checked) => {
				modeling.updateProperties(currentElement, { cancelActivity: checked });
				queueMetadataSave();
			}), true));
			properties.appendChild(boundaryGroup);
		}
	}

	if (isSequenceFlow(selectedElement)) {
		const flowGroup = createGroup('Sequence Flow');
		flowGroup.appendChild(createField('Condition Expression', createTextArea(elementState.conditionExpression, (nextValue) => {
			updateConditionExpression(nextValue);
		}, 'e.g. ${approved == true}')));
		flowGroup.appendChild(createField('Skip Expression', createTextInput(
			elementState.activitiAttributes.skipExpression || '',
			(nextValue) => updateFlowableAttribute('skipExpression', nextValue),
			'e.g. ${skip}',
		)));
		properties.appendChild(flowGroup);
	}

	if (isScriptTask(selectedElement)) {
		const bo = getBusinessObject(selectedElement);
		const scriptGroup = createGroup('Script Task');
		const currentElement = selectedElement;
		scriptGroup.appendChild(createField('Script Format', createSelect(
			['javascript', 'groovy'],
			(typeof bo.scriptFormat === 'string' ? bo.scriptFormat : '') || 'javascript',
			(nextValue) => {
				modeling.updateProperties(currentElement, { scriptFormat: nextValue });
				queueMetadataSave();
			},
		)));

		const scriptTextArea = createTextArea(elementState.script, (nextValue) => {
			updateScript(nextValue);
			// Re-render file references when script changes
			const refs = parseFileReferences(nextValue);
			fileRefsContainer.innerHTML = '';
			if (refs.length > 0) {
				fileRefsContainer.appendChild(renderFileReferences(refs));
			}
		}, 'Enter script code...');
		scriptGroup.appendChild(createField('Script', scriptTextArea));

		// Browse button for inserting file references
		const browseBtn = document.createElement('button');
		browseBtn.type = 'button';
		browseBtn.className = 'file-browse-btn';
		browseBtn.textContent = 'Insert File Reference\u2026';
		browseBtn.title = 'Select a file to insert as @path@ reference';
		browseBtn.addEventListener('click', () => {
			postMessage({ type: 'pick-file' });
			// Store reference to textarea and element ID so file-picked handler can validate
			pendingFilePickTextArea = { textarea: scriptTextArea, elementId: getElementId(currentElement) };
		});
		scriptGroup.appendChild(browseBtn);

		// File references list
		const fileRefsContainer = document.createElement('div');
		const initialRefs = parseFileReferences(elementState.script);
		if (initialRefs.length > 0) {
			fileRefsContainer.appendChild(renderFileReferences(initialRefs));
		}
		scriptGroup.appendChild(fileRefsContainer);

		properties.appendChild(scriptGroup);
	}

	if (isBusinessRuleTask(selectedElement)) {
		const businessRuleGroup = createGroup('Business Rule Task');
		businessRuleGroup.appendChild(createField('Rule Names', createTextInput(
			elementState.activitiAttributes['class'] || '', // Eclipse stores ruleNames in extension; we expose via custom fields
			() => {},
		)));
		// Business Rule Task uses standard activiti attributes for async/exclusive + custom fields
		const brAttributes: FlowableAttributeKey[] = ['skipExpression', 'async', 'exclusive'];
		for (const attribute of brAttributes) {
			const label = editableLabels[attribute] || attribute;
			if (attribute === 'async' || attribute === 'exclusive') {
				businessRuleGroup.appendChild(createField(label, createCheckbox(
					elementState.activitiAttributes[attribute] === 'true',
					(checked) => updateFlowableAttribute(attribute, checked),
				), true));
			} else {
				businessRuleGroup.appendChild(createField(label, createTextInput(
					elementState.activitiAttributes[attribute] || '',
					(nextValue) => updateFlowableAttribute(attribute, nextValue),
				)));
			}
		}
		properties.appendChild(businessRuleGroup);
	}

	if (isCallActivity(selectedElement)) {
		const bo = getBusinessObject(selectedElement);
		const callGroup = createGroup('Call Activity');
		const currentElement = selectedElement;
		callGroup.appendChild(createField('Called Element', createTextInput(
			typeof bo.calledElement === 'string' ? bo.calledElement : '',
			(nextValue) => {
				modeling.updateProperties(currentElement, { calledElement: nextValue });
				queueMetadataSave();
			},
			'e.g. mySubProcess',
		)));
		properties.appendChild(callGroup);

		const inGroup = createGroup('Input Parameters');
		renderIOParameters(inGroup, elementState.inputParameters, 'input');
		properties.appendChild(inGroup);

		const outGroup = createGroup('Output Parameters');
		renderIOParameters(outGroup, elementState.outputParameters, 'output');
		properties.appendChild(outGroup);
	}

	// Multi-Instance section for activities
	if (isActivity(selectedElement)) {
		const miGroup = createGroup('Multi-Instance');
		if (elementState.multiInstance) {
			renderMultiInstance(miGroup, elementState.multiInstance);
		} else {
			const miActions = document.createElement('div');
			miActions.className = 'properties-actions';
			const addMiButton = document.createElement('button');
			addMiButton.type = 'button';
			addMiButton.textContent = 'Add Multi-Instance';
			addMiButton.addEventListener('click', () => {
				updateMultiInstance({});
			});
			miActions.appendChild(addMiButton);
			miGroup.appendChild(miActions);
		}
		properties.appendChild(miGroup);

		// Is For Compensation checkbox
		const compGroup = createGroup('Compensation');
		compGroup.appendChild(createField('Is Compensation Handler', createCheckbox(
			elementState.isForCompensation === 'true',
			(checked) => updateIsForCompensation(checked),
		), true));
		properties.appendChild(compGroup);
	}

	// Gateway default flow
	if (isGateway(selectedElement)) {
		const gatewayGroup = createGroup('Gateway');
		const currentDefault = typeof businessObject.default === 'object' && businessObject.default !== null
			? (businessObject.default as { id?: string }).id || ''
			: (typeof businessObject.default === 'string' ? businessObject.default : '');
		const outgoingFlows = (businessObject.outgoing as Array<{ id: string; name?: string }> || []);
		const flowOptions = outgoingFlows.map((f) => ({ value: f.id, label: f.name ? `${f.name} (${f.id})` : f.id }));
		gatewayGroup.appendChild(createField('Default Flow', createReferenceSelect(flowOptions, currentDefault, (nextValue) => {
			if (!selectedElement) { return; }
			const targetFlow = nextValue.trim();
			if (targetFlow) {
				const flowElement = elementRegistry.get(targetFlow);
				if (flowElement) {
					modeling.updateProperties(selectedElement, { default: flowElement.businessObject });
				}
			} else {
				modeling.updateProperties(selectedElement, { default: undefined });
			}
			queueMetadataSave();
		}, 'Select a sequence flow...')));
		properties.appendChild(gatewayGroup);
	}

	// Async/exclusive for all flow nodes
	if (isFlowNode(selectedElement) && !isUserTask(selectedElement) && !isServiceTask(selectedElement) && !isSendTask(selectedElement) && !isReceiveTask(selectedElement) && !isManualTask(selectedElement)) {
		const asyncGroup = createGroup('Async');
		asyncGroup.appendChild(createField('Async', createCheckbox(
			elementState.activitiAttributes.async === 'true',
			(checked) => updateFlowableAttribute('async', checked),
		), true));
		asyncGroup.appendChild(createField('Exclusive', createCheckbox(
			elementState.activitiAttributes.exclusive === 'true',
			(checked) => updateFlowableAttribute('exclusive', checked),
		), true));
		asyncGroup.appendChild(createField('Failed Job Retry', createTextInput(
			elementState.failedJobRetryTimeCycle,
			(nextValue) => updateFailedJobRetryTimeCycle(nextValue),
			'e.g. R3/PT10M',
			validateRetryCycle,
		)));
		properties.appendChild(asyncGroup);
	}

	// Failed Job Retry for service tasks (async section is in attribute group)
	if (isServiceTask(selectedElement) || isSendTask(selectedElement) || isReceiveTask(selectedElement) || isManualTask(selectedElement) || isUserTask(selectedElement)) {
		const retryGroup = createGroup('Failed Job Retry');
		retryGroup.appendChild(createField('Retry Time Cycle', createTextInput(
			elementState.failedJobRetryTimeCycle,
			(nextValue) => updateFailedJobRetryTimeCycle(nextValue),
			'e.g. R3/PT10M',
			validateRetryCycle,
		)));
		properties.appendChild(retryGroup);
	}

	// Text Annotation
	if (isTextAnnotation(selectedElement)) {
		const annotationGroup = createGroup('Text Annotation');
		const currentText = typeof businessObject.text === 'string' ? businessObject.text : '';
		annotationGroup.appendChild(createField('Text', createTextArea(currentText, (nextValue) => {
			if (!selectedElement) { return; }
			modeling.updateProperties(selectedElement, { text: nextValue });
			queueMetadataSave();
		})));
		properties.appendChild(annotationGroup);
	}

	const executionListenersGroup = createGroup('Execution Listeners');
	renderListeners(executionListenersGroup, elementState.executionListeners, 'execution');
	properties.appendChild(executionListenersGroup);

	if (scrollContainer) {
		const restoreTarget = scrollTop;
		requestAnimationFrame(() => {
			scrollContainer.scrollTop = restoreTarget;
		});
	}

	// Reapply search filter if active
	applyPropertyFilter(propertySearch.value);
}

async function loadXml(xml: string): Promise<void> {
	applyingRemoteUpdate = true;
	setStatus('Loading BPMN diagram...');

	// Save viewport and current root before re-import so we can restore them
	const savedViewbox = initialLoadDone ? canvasService.viewbox() : null;
	const savedRootId = currentRootId;

	try {
		const previousSelectionId = selectedElement ? getElementId(selectedElement) : undefined;
		const result = await modeler.importXML(xml);

		// Restore subprocess drill-down plane if we were inside one
		if (savedRootId) {
			const previousRoot = canvasService.findRoot(savedRootId);
			if (previousRoot) {
				canvasService.setRootElement(previousRoot);
			}
		}

		if (savedViewbox) {
			// Re-sync: restore previous viewport position
			canvasService.viewbox(savedViewbox);
		} else {
			// Initial load: fit entire diagram into view
			canvasService.zoom('fit-viewport');
		}
		initialLoadDone = true;

		currentXml = xml;
		renderIssues(result.warnings.map(toIssueMessage));
		setStatus('Diagram synchronized');
		vscode.setState({ xml, flowableState, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
		selectedElement = previousSelectionId ? elementRegistry.get(previousSelectionId) || null : null;
		renderProperties();
		updateUndoRedoState();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setStatus('Unable to render BPMN XML', 'error');
		renderIssues([message]);
		postMessage({ type: 'show-error', message });
		showToast('Failed to load diagram', 'error');
	} finally {
		applyingRemoteUpdate = false;
	}
}

async function saveXml(): Promise<void> {
	if (applyingRemoteUpdate) {
		return;
	}

	try {
		const result = await modeler.saveXML({ format: true });
		if (!result.xml || result.xml === currentXml) {
			return;
		}

		currentXml = result.xml;
		const clonedState = cloneFlowableState(flowableState);
		vscode.setState({ xml: result.xml, flowableState: clonedState, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
		postMessage({ type: 'save-document', xml: result.xml, flowableState: clonedState });
		setStatus('Diagram updated');
		updateDirtyIndicator(false);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setStatus('Unable to serialize BPMN XML', 'error');
		renderIssues([message]);
		postMessage({ type: 'show-error', message });
		showToast('Failed to save diagram', 'error');
	}
}

async function exportSvg(): Promise<void> {
	try {
		const result = await (modeler as unknown as { saveSVG(): Promise<{ svg: string }> }).saveSVG();
		postMessage({ type: 'svg-export', svg: result.svg });
		showToast('SVG exported successfully', 'success');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		postMessage({ type: 'show-error', message: `SVG export failed: ${message}` });
		showToast(`Export failed: ${message}`, 'error');
	}
}

eventBus.on('selection.changed', (event) => {
	const selectionEvent = event as { newSelection?: BpmnElement[] };
	selectedElement = selectionEvent.newSelection?.[0] || null;
	renderProperties();
});

// Copy/paste: preserve Flowable metadata for pasted elements
eventBus.on('copyPaste.pasteElement', (event) => {
	const descriptor = (event as { descriptor?: { id?: string; oldIds?: string[] } }).descriptor;
	if (!descriptor) { return; }
	const oldId = descriptor.oldIds?.[0];
	const newId = descriptor.id;
	if (oldId && newId && oldId !== newId && flowableState.elements[oldId]) {
		const original = flowableState.elements[oldId];
		const cloned = createElementState(newId, original.type);
		cloned.activitiAttributes = { ...original.activitiAttributes };
		cloned.fieldExtensions = original.fieldExtensions.map((f) => ({ ...f, id: `copy-${f.id}` }));
		cloned.taskListeners = original.taskListeners.map((l) => ({ ...l, id: `copy-${l.id}` }));
		cloned.executionListeners = original.executionListeners.map((l) => ({ ...l, id: `copy-${l.id}` }));
		cloned.formProperties = original.formProperties.map((p) => ({ ...p }));
		cloned.inputParameters = original.inputParameters.map((p) => ({ ...p, id: `copy-${p.id}` }));
		cloned.outputParameters = original.outputParameters.map((p) => ({ ...p, id: `copy-${p.id}` }));
		cloned.multiInstance = original.multiInstance ? { ...original.multiInstance } : null;
		cloned.conditionExpression = original.conditionExpression;
		cloned.script = original.script;
		cloned.documentation = original.documentation;
		cloned.terminateAll = original.terminateAll;
		cloned.compensateActivityRef = original.compensateActivityRef;
		cloned.isForCompensation = original.isForCompensation;
		cloned.failedJobRetryTimeCycle = original.failedJobRetryTimeCycle;
		cloned.exceptionMaps = original.exceptionMaps.map((e) => ({ ...e }));
		flowableState.elements[newId] = cloned;
	}
});

modeler.on('commandStack.changed', () => {
	updateDirtyIndicator(true);
	void saveXml();
	renderProperties();
	updateUndoRedoState();
});

// Track current root element for subprocess drill-down persistence
eventBus.on('root.set', (event: Record<string, unknown>) => {
	const element = event.element as BpmnElement | undefined;
	if (element) {
		currentRootId = element.id || null;
	}
});

window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
	switch (event.data.type) {
		case 'load-document': {
			flowableState = cloneFlowableState(event.data.flowableState);
			if (!initialLoadDone) {
				if (event.data.minimapEnabled) {
					minimap.open();
				} else {
					minimap.close();
				}
			}
			void loadXml(event.data.xml);
			break;
		}
		case 'request-svg': {
			void exportSvg();
			break;
		}
		case 'request-validation': {
			// Validation is handled on the extension host side via XML
			break;
		}
		case 'file-picked': {
			if (pendingFilePickTextArea && selectedElement && getElementId(selectedElement) === pendingFilePickTextArea.elementId) {
				const textarea = pendingFilePickTextArea.textarea;
				const insertion = `@${event.data.path}@`;
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				const before = textarea.value.substring(0, start);
				const after = textarea.value.substring(end);
				textarea.value = before + insertion + after;
				textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
				textarea.dispatchEvent(new Event('change'));
				textarea.dispatchEvent(new Event('input'));
				pendingFilePickTextArea = null;
			}
			break;
		}
		case 'source-visible': {
			btnViewSource.classList.toggle('active', event.data.visible);
			break;
		}
	}
});

btnViewSource.addEventListener('click', () => {
	postMessage({ type: 'open-source' });
});

btnUndo.addEventListener('click', () => commandStack.undo());
btnRedo.addEventListener('click', () => commandStack.redo());

// Property search/filter
function applyPropertyFilter(query: string): void {
	const normalizedQuery = query.toLowerCase().trim();
	const groups = Array.from(properties.querySelectorAll('.property-group'));
	for (const group of groups) {
		if (!normalizedQuery) {
			group.classList.remove('search-hidden');
			continue;
		}
		const text = group.textContent?.toLowerCase() || '';
		group.classList.toggle('search-hidden', !text.includes(normalizedQuery));
	}
}

propertySearch.addEventListener('input', () => {
	applyPropertyFilter(propertySearch.value);
});

// Resize handle
let isResizing = false;

function stopResizing(): void {
	if (!isResizing) { return; }
	isResizing = false;
	resizeHandle.classList.remove('active');
	document.body.style.cursor = '';
	document.body.style.userSelect = '';
	persistUiState();
}

resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
	e.preventDefault();
	isResizing = true;
	resizeHandle.classList.add('active');
	resizeHandle.setPointerCapture(e.pointerId);
	document.body.style.cursor = 'col-resize';
	document.body.style.userSelect = 'none';
});

window.addEventListener('pointermove', (e: PointerEvent) => {
	if (!isResizing) { return; }
	const layoutRect = layoutEl.getBoundingClientRect();
	const newWidth = Math.max(200, Math.min(600, layoutRect.right - e.clientX));
	sidebarWidth = newWidth;
	layoutEl.style.setProperty('--sidebar-width', `${newWidth}px`);
});

window.addEventListener('pointerup', stopResizing);
window.addEventListener('pointercancel', stopResizing);

// Restore persisted sidebar width
if (sidebarWidth !== 320) {
	layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
}

// Keyboard: Escape deselects element and returns focus to canvas
window.addEventListener('keydown', (e: KeyboardEvent) => {
	if (e.key === 'Escape' && selectedElement) {
		const selectionService = modeler.get('selection') as { select(elements: BpmnElement[]): void };
		selectionService.select([]);
		canvas.focus();
	}
});

// Keyboard support for resize handle
resizeHandle.addEventListener('keydown', (e: KeyboardEvent) => {
	const step = e.shiftKey ? 50 : 10;
	if (e.key === 'ArrowLeft') {
		e.preventDefault();
		sidebarWidth = Math.min(600, sidebarWidth + step);
		layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
		persistUiState();
	} else if (e.key === 'ArrowRight') {
		e.preventDefault();
		sidebarWidth = Math.max(200, sidebarWidth - step);
		layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
		persistUiState();
	}
});

postMessage({ type: 'ready' });
