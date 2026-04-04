import type {
	FlowableDataObject,
	FlowableDocumentState,
	FlowableElementState,
	FlowableEventListenerImplType,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableMultiInstance,
	TimerDefinitionType,
} from '../flowable/types';
import type { WebviewToHostMessage } from '../shared/messages';
import type { PropertyUi } from './propertyUi';
import type { BpmnElement } from './bpmnTypeGuards';
import type { DocumentActions } from './documentActions';
import type { ElementActions } from './elementActions';

export interface ModelingService {
	updateProperties(element: BpmnElement, properties: Record<string, unknown>): void;
}

export interface ElementRegistryService {
	get(id: string): BpmnElement | undefined;
}

export interface PropertyRenderDeps {
	ui: PropertyUi;
	actions: ElementActions & DocumentActions;
	getSelectedElement: () => BpmnElement | null;
	getFlowableState: () => FlowableDocumentState;
	ensureElementState: (element: BpmnElement) => FlowableElementState;
	getKnownProcessIds: () => string[];
	makeDraggableItem: <T>(item: HTMLDivElement, index: number, array: T[], collectionId: string, onReorder: () => void) => void;
	makeProcessScopedDraggableItem: <T extends { processId?: string }>(item: HTMLDivElement, index: number, array: T[], processId: string, knownProcessIds: string[], collectionId: string, onReorder: () => void) => void;
	queueMetadataSave: () => void;
	renderProperties: () => void;
	modeling: ModelingService;
	elementRegistry: ElementRegistryService;
	postMessage: (message: WebviewToHostMessage) => void;
	setPendingFilePick: (textarea: HTMLTextAreaElement, elementId: string) => void;
}

export interface SharedCollectionRenderers {
	renderIOParameters: (group: HTMLDivElement, params: FlowableIOParameter[], kind: 'input' | 'output') => void;
	renderMultiInstance: (group: HTMLDivElement, mi: FlowableMultiInstance) => void;
	renderFieldExtensions: (group: HTMLDivElement, elementState: FlowableElementState) => void;
	renderListeners: (group: HTMLDivElement, listeners: FlowableListener[], kind: 'task' | 'execution') => void;
	renderFormProperties: (group: HTMLDivElement, formProperties: FlowableFormProperty[]) => void;
	renderAttributeGroup: (groupTitle: string, attributes: Array<keyof FlowableElementState['activitiAttributes']>, elementState: FlowableElementState) => HTMLDivElement;
	renderExceptionMaps: (group: HTMLDivElement, elementState: FlowableElementState) => void;
	renderMailField: (group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string, multiline?: boolean) => void;
	renderBooleanFieldExtension: (group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string) => void;
	renderTextFieldExtension: (group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string, multiline?: boolean) => void;
	renderProcessEventListenerTypeOptions: () => FlowableEventListenerImplType[];
	renderTimerTypeOptions: () => TimerDefinitionType[];
	renderProcessDataObject: (group: HTMLDivElement, processId: string, dataObject: FlowableDataObject, index: number) => void;
}