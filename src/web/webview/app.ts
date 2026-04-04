import Modeler from 'bpmn-js/lib/Modeler';
import minimapModule from 'diagram-js-minimap';
import { cloneFlowableState, createEmptyFlowableState, type FlowableDocumentState, type FlowableElementState } from '../flowable/types';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../shared/messages';
import { type BpmnElement, getElementId, getElementType } from './bpmnTypeGuards';
import { createDocumentActions } from './documentActions';
import { makeDraggableItem, makeProcessScopedDraggableItem } from './dragDrop';
import { createElementActions } from './elementActions';
import { createElementState } from './elementState';
import { syncActionCountersFromState, type ActionCounters } from './counterSync';
import { createAnimationFrameScheduler, replacePendingAnimationFrame } from './frameScheduling';
import { createPropertyUi } from './propertyUi';
import { getKnownProcessIds, remapProcessScopedIds } from './processScoped';
import { renderPropertiesPanel } from './renderProperties';

declare function acquireVsCodeApi(): {
	postMessage(message: WebviewToHostMessage): void;
	setState(state: unknown): void;
	getState(): unknown;
};

interface EventBusService { on(eventName: string, listener: (event: Record<string, unknown>) => void): void; }
interface ModelingService { updateProperties(element: BpmnElement, properties: Record<string, unknown>): void; }
interface CanvasService {
	zoom(level: 'fit-viewport'): void;
	viewbox(): { x: number; y: number; width: number; height: number };
	viewbox(box: { x: number; y: number; width: number; height: number }): void;
	setRootElement(rootElement: BpmnElement): void;
	findRoot(id: string): BpmnElement | undefined;
}
interface ElementRegistryService { get(id: string): BpmnElement | undefined; }
interface CommandStackService { undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean; }
interface MinimapService { open(): void; close(): void; }
interface SelectionService { select(elements: BpmnElement[]): void; }

declare global {
	interface Window {
		__flowableTestApi?: {
			selectElementById: (elementId: string) => boolean;
		};
	}
}

const vscode = acquireVsCodeApi();

function requireElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Flowable BPMN webview failed to initialize required element: ${id}.`);
	}
	return element;
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
const sidebarEl = properties.closest('.sidebar') as HTMLElement | null;

const style = getComputedStyle(document.documentElement);
const vscodeText = style.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc';
const vscodeBackground = style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
const modeler = new Modeler({
	container: canvas,
	additionalModules: [minimapModule],
	bpmnRenderer: { defaultFillColor: vscodeBackground, defaultStrokeColor: vscodeText, defaultLabelColor: vscodeText },
});
const eventBus = modeler.get('eventBus') as EventBusService;
const modeling = modeler.get('modeling') as ModelingService;
const canvasService = modeler.get('canvas') as CanvasService;
const elementRegistry = modeler.get('elementRegistry') as ElementRegistryService;
const commandStack = modeler.get('commandStack') as CommandStackService;
const minimap = modeler.get('minimap') as MinimapService;
const selectionService = modeler.get('selection') as SelectionService;
minimap.close();

((globalThis as unknown) as Window).__flowableTestApi = {
	selectElementById: (elementId: string): boolean => {
		const element = elementRegistry.get(elementId) || canvasService.findRoot(elementId);
		if (!element) {
			return false;
		}
		if (canvasService.findRoot(elementId) === element) {
			canvasService.setRootElement(element);
		}
		selectionService.select([element]);
		return true;
	},
};

let currentXml = '';
let applyingRemoteUpdate = false;
let initialLoadDone = false;
let selectedElement: BpmnElement | null = null;
let currentRootId: string | null = null;
let flowableState: FlowableDocumentState = createEmptyFlowableState();
let metadataSaveTimer: number | undefined;
let pendingFilePickTextArea: { textarea: HTMLTextAreaElement; elementId: string } | null = null;
let fieldIdCounter = 0;
let savedSidebarScroll = 0;
let pendingScrollRestore: number | null = null;
let lastPersistedStateSignature = JSON.stringify(flowableState);
let saveRequestId = 0;
const counters: ActionCounters = { field: 0, listener: 0, formProperty: 0, ioParameter: 0, dataObject: 0, signalDefinition: 0, messageDefinition: 0, eventListener: 0, localization: 0 };
const uiStateStorageKey = 'flowableBpmnDesigner.uiState';
function readSavedUiState(): { collapsedGroups?: string[]; sidebarWidth?: number } {
	const fromVsCode = (vscode.getState() || {}) as { collapsedGroups?: string[]; sidebarWidth?: number };
	if (fromVsCode.collapsedGroups || fromVsCode.sidebarWidth) {
		return fromVsCode;
	}
	try {
		const fromStorage = globalThis.localStorage.getItem(uiStateStorageKey);
		return fromStorage ? JSON.parse(fromStorage) as { collapsedGroups?: string[]; sidebarWidth?: number } : {};
	} catch {
		return {};
	}
}
const savedUiState = readSavedUiState();
const collapsedGroups = new Set<string>(savedUiState.collapsedGroups || []);
let sidebarWidth = savedUiState.sidebarWidth ?? 320;

if (sidebarEl) {
	sidebarEl.addEventListener('scroll', () => {
		if (pendingScrollRestore === null) {
			savedSidebarScroll = sidebarEl.scrollTop;
		}
	}, { passive: true });
}

function nextFieldId(prefix: string): string { fieldIdCounter += 1; return `fld-${prefix}-${fieldIdCounter}`; }
function persistUiState(): void {
	const nextState = { ...((vscode.getState() || {}) as Record<string, unknown>), collapsedGroups: Array.from(collapsedGroups), sidebarWidth };
	vscode.setState(nextState);
	try {
		globalThis.localStorage.setItem(uiStateStorageKey, JSON.stringify({ collapsedGroups: Array.from(collapsedGroups), sidebarWidth }));
	} catch {
		// Ignore browsers where localStorage is unavailable inside the webview sandbox.
	}
}
function updateDirtyIndicator(dirty: boolean): void { unsavedDot.classList.toggle('visible', dirty); }
function updateUndoRedoState(): void { btnUndo.disabled = !commandStack.canUndo(); btnRedo.disabled = !commandStack.canRedo(); }
function postMessage(message: WebviewToHostMessage): void { vscode.postMessage(message); }
function getSelectedElement(): BpmnElement | null { return selectedElement; }
function getFlowableState(): FlowableDocumentState { return flowableState; }
function getKnownProcessIdsForState(): string[] { return getKnownProcessIds(flowableState); }
function ensureElementState(element: BpmnElement): FlowableElementState {
	const id = getElementId(element);
	const type = getElementType(element);
	const existing = flowableState.elements[id];
	if (existing) { existing.type = type; return existing; }
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
	flowableState.elements[newId] = { ...current, id: newId, type };
	if (type === 'bpmn:Process') {
		remapProcessScopedIds(flowableState.eventListeners, oldId, newId);
		remapProcessScopedIds(flowableState.localizations, oldId, newId);
		remapProcessScopedIds(flowableState.dataObjects, oldId, newId);
	}
	selectedElement = elementRegistry.get(newId) || selectedElement;
	schedulePropertiesRender();
}

const ui = createPropertyUi({ collapsedGroups, persistUiState, nextFieldId, postMessage, status, issues, toastContainer });
const schedulePropertiesRender = createAnimationFrameScheduler(
	(callback) => requestAnimationFrame(callback),
	(id) => cancelAnimationFrame(id),
	() => {
		renderProperties();
	},
);

function queueMetadataSave(): void {
	if (metadataSaveTimer) {
		globalThis.clearTimeout(metadataSaveTimer);
	}
	updateDirtyIndicator(true);
	metadataSaveTimer = globalThis.setTimeout(() => { void saveXml(); }, 120);
}
const actions = {
	...createElementActions({ getSelectedElement, ensureElementState, renameElementState, modeling, queueMetadataSave, setStatus: ui.setStatus, renderProperties: schedulePropertiesRender, counters }),
	...createDocumentActions({ getFlowableState, getKnownProcessIds: getKnownProcessIdsForState, queueMetadataSave, renderProperties: schedulePropertiesRender, setStatus: ui.setStatus, counters }),
};

function applyPropertyFilter(query: string): void {
	const normalizedQuery = query.toLowerCase().trim();
	for (const group of Array.from(properties.querySelectorAll('.property-group'))) {
		if (!normalizedQuery) {
			group.classList.remove('search-hidden');
			continue;
		}
		const text = group.textContent?.toLowerCase() || '';
		group.classList.toggle('search-hidden', !text.includes(normalizedQuery));
	}
}

function renderProperties(): void {
	fieldIdCounter = 0;
	renderPropertiesPanel(
		{ ui, actions, getSelectedElement, getFlowableState, ensureElementState, getKnownProcessIds: getKnownProcessIdsForState, makeDraggableItem, makeProcessScopedDraggableItem, queueMetadataSave, renderProperties: schedulePropertiesRender, modeling, elementRegistry, postMessage, setPendingFilePick: (textarea, elementId) => { pendingFilePickTextArea = { textarea, elementId }; } },
		properties,
		propertySearch,
		sidebarEl,
		savedSidebarScroll,
		selectedElement,
	);
	applyPropertyFilter(propertySearch.value);
	if (sidebarEl) {
		const targetScrollTop = savedSidebarScroll;
		pendingScrollRestore = replacePendingAnimationFrame(
			pendingScrollRestore,
			(callback) => requestAnimationFrame(callback),
			(id) => cancelAnimationFrame(id),
			() => {
				sidebarEl.scrollTop = targetScrollTop;
				pendingScrollRestore = null;
				return 0;
			},
		);
	}
}

async function loadXml(xml: string, nextFlowableState: FlowableDocumentState): Promise<void> {
	applyingRemoteUpdate = true;
	ui.setStatus('Loading BPMN diagram...');
	const savedViewbox = initialLoadDone ? canvasService.viewbox() : null;
	const savedRoot = currentRootId;
	try {
		const previousSelectionId = selectedElement ? getElementId(selectedElement) : undefined;
		const result = await modeler.importXML(xml);
		if (savedRoot) {
			const previousRoot = canvasService.findRoot(savedRoot);
			if (previousRoot) { canvasService.setRootElement(previousRoot); }
		}
		if (savedViewbox) { canvasService.viewbox(savedViewbox); } else { canvasService.zoom('fit-viewport'); }
		initialLoadDone = true;
		currentXml = xml;
		flowableState = cloneFlowableState(nextFlowableState);
		syncActionCountersFromState(flowableState, counters);
		lastPersistedStateSignature = JSON.stringify(flowableState);
		ui.renderIssues(result.warnings.map(ui.toIssueMessage));
		ui.setStatus('Diagram synchronized');
		vscode.setState({ xml, flowableState, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
		selectedElement = previousSelectionId ? elementRegistry.get(previousSelectionId) || null : null;
		schedulePropertiesRender();
		updateUndoRedoState();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ui.setStatus('Unable to render BPMN XML', 'error');
		ui.renderIssues([message]);
		postMessage({ type: 'show-error', message });
		ui.showToast('Failed to load diagram', 'error');
	} finally {
		applyingRemoteUpdate = false;
	}
}

async function saveXml(): Promise<void> {
	if (applyingRemoteUpdate) {
		return;
	}
	ui.flushPendingTextEdits();
	const requestId = ++saveRequestId;
	try {
		const result = await modeler.saveXML({ format: true });
		if (!result.xml || requestId !== saveRequestId) {
			return;
		}
		const clonedState = cloneFlowableState(flowableState);
		const stateSignature = JSON.stringify(clonedState);
		const xmlChanged = result.xml !== currentXml;
		const metadataChanged = stateSignature !== lastPersistedStateSignature;
		if (!xmlChanged && !metadataChanged) {
			return;
		}
		currentXml = result.xml;
		lastPersistedStateSignature = stateSignature;
		vscode.setState({ xml: result.xml, flowableState: clonedState, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
		postMessage({ type: 'save-document', xml: result.xml, flowableState: clonedState });
		ui.setStatus('Diagram updated');
		updateDirtyIndicator(false);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ui.setStatus('Unable to serialize BPMN XML', 'error');
		ui.renderIssues([message]);
		postMessage({ type: 'show-error', message });
		ui.showToast('Failed to save diagram', 'error');
	}
}

async function runValidation(): Promise<void> {
	if (applyingRemoteUpdate) {
		return;
	}
	ui.flushPendingTextEdits();
	try {
		const result = await modeler.saveXML({ format: true });
		if (!result.xml) {
			return;
		}
		currentXml = result.xml;
		const clonedState = cloneFlowableState(flowableState);
		vscode.setState({ xml: result.xml, flowableState: clonedState, collapsedGroups: Array.from(collapsedGroups), sidebarWidth });
		postMessage({ type: 'run-validation', xml: result.xml, flowableState: clonedState });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ui.setStatus('Unable to serialize BPMN XML', 'error');
		ui.renderIssues([message]);
		postMessage({ type: 'show-error', message });
		ui.showToast('Validation failed', 'error');
	}
}

async function exportSvg(): Promise<void> {
	try {
		const result = await (modeler as unknown as { saveSVG(): Promise<{ svg: string }> }).saveSVG();
		postMessage({ type: 'svg-export', svg: result.svg });
		ui.showToast('SVG exported successfully', 'success');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		postMessage({ type: 'show-error', message: `SVG export failed: ${message}` });
		ui.showToast(`Export failed: ${message}`, 'error');
	}
}

eventBus.on('selection.changed', (event) => {
	selectedElement = (event as { newSelection?: BpmnElement[] }).newSelection?.[0] || null;
	if (!applyingRemoteUpdate) { savedSidebarScroll = 0; }
	schedulePropertiesRender();
});
eventBus.on('copyPaste.pasteElement', (event) => {
	const descriptor = (event as { descriptor?: { id?: string; oldIds?: string[] } }).descriptor;
	if (!descriptor?.oldIds?.[0] || !descriptor.id || descriptor.oldIds[0] === descriptor.id || !flowableState.elements[descriptor.oldIds[0]]) { return; }
	const original = flowableState.elements[descriptor.oldIds[0]];
	const cloned = createElementState(descriptor.id, original.type);
	Object.assign(cloned, { ...original, id: descriptor.id, activitiAttributes: { ...original.activitiAttributes }, fieldExtensions: original.fieldExtensions.map((item) => ({ ...item, id: `copy-${item.id}` })), taskListeners: original.taskListeners.map((item) => ({ ...item, id: `copy-${item.id}` })), executionListeners: original.executionListeners.map((item) => ({ ...item, id: `copy-${item.id}` })), formProperties: original.formProperties.map((item) => ({ ...item })), inputParameters: original.inputParameters.map((item) => ({ ...item, id: `copy-${item.id}` })), outputParameters: original.outputParameters.map((item) => ({ ...item, id: `copy-${item.id}` })), multiInstance: original.multiInstance ? { ...original.multiInstance } : null, exceptionMaps: original.exceptionMaps.map((item) => ({ ...item })), preservedAttributes: { ...original.preservedAttributes }, preservedExtensionElements: [...original.preservedExtensionElements] });
	flowableState.elements[descriptor.id] = cloned;
});
modeler.on('commandStack.changed', () => { updateDirtyIndicator(true); void saveXml(); schedulePropertiesRender(); updateUndoRedoState(); });
eventBus.on('root.set', (event) => { const element = event.element as BpmnElement | undefined; if (element) { currentRootId = element.id || null; } });

globalThis.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => { // NOSONAR: origin is validated against the current webview origin below.
	if (event.origin !== globalThis.location.origin) {
		return;
	}

	switch (event.data.type) {
		case 'load-document':
			if (!initialLoadDone) { event.data.minimapEnabled ? minimap.open() : minimap.close(); }
			void loadXml(event.data.xml, event.data.flowableState);
			break;
		case 'request-svg':
			void exportSvg();
			break;
		case 'request-validation':
			void runValidation();
			break;
		case 'file-picked':
			if (pendingFilePickTextArea && selectedElement && getElementId(selectedElement) === pendingFilePickTextArea.elementId) {
				const { textarea } = pendingFilePickTextArea;
				const insertion = `@${event.data.path}@`;
				const before = textarea.value.substring(0, textarea.selectionStart);
				const after = textarea.value.substring(textarea.selectionEnd);
				textarea.value = before + insertion + after;
				textarea.selectionStart = textarea.selectionEnd = before.length + insertion.length;
				textarea.dispatchEvent(new Event('change'));
				textarea.dispatchEvent(new Event('input'));
				pendingFilePickTextArea = null;
			}
			break;
		case 'source-visible':
			btnViewSource.classList.toggle('active', event.data.visible);
			break;
		default:
			break;
	}
});

btnViewSource.addEventListener('click', () => postMessage({ type: 'open-source' }));
btnUndo.addEventListener('click', () => commandStack.undo());
btnRedo.addEventListener('click', () => commandStack.redo());
propertySearch.addEventListener('input', () => applyPropertyFilter(propertySearch.value));

let isResizing = false;
function stopResizing(): void {
	if (!isResizing) { return; }
	isResizing = false;
	resizeHandle.classList.remove('active');
	document.body.style.cursor = '';
	document.body.style.userSelect = '';
	persistUiState();
}
resizeHandle.addEventListener('pointerdown', (event: PointerEvent) => {
	event.preventDefault();
	isResizing = true;
	resizeHandle.classList.add('active');
	resizeHandle.setPointerCapture(event.pointerId);
	document.body.style.cursor = 'col-resize';
	document.body.style.userSelect = 'none';
});
globalThis.addEventListener('pointermove', (event: PointerEvent) => {
	if (!isResizing) { return; }
	const layoutRect = layoutEl.getBoundingClientRect();
	sidebarWidth = Math.max(200, Math.min(600, layoutRect.right - event.clientX));
	layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
});
globalThis.addEventListener('pointerup', stopResizing);
globalThis.addEventListener('pointercancel', stopResizing);
if (sidebarWidth !== 320) { layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`); }
globalThis.addEventListener('keydown', (event: KeyboardEvent) => {
	if (event.key === 'Escape' && selectedElement) {
		selectionService.select([]);
		canvas.focus();
	}
});
resizeHandle.addEventListener('keydown', (event: KeyboardEvent) => {
	const step = event.shiftKey ? 50 : 10;
	if (event.key === 'ArrowLeft') { event.preventDefault(); sidebarWidth = Math.min(600, sidebarWidth + step); }
	if (event.key === 'ArrowRight') { event.preventDefault(); sidebarWidth = Math.max(200, sidebarWidth - step); }
	layoutEl.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
	persistUiState();
});

postMessage({ type: 'ready' });
