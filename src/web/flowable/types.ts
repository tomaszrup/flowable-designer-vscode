export type FlowableAttributeKey =
	| 'candidateStarterUsers'
	| 'candidateStarterGroups'
	| 'initiator'
	| 'assignee'
	| 'candidateUsers'
	| 'candidateGroups'
	| 'formKey'
	| 'dueDate'
	| 'priority'
	| 'category'
	| 'skipExpression'
	| 'class'
	| 'expression'
	| 'delegateExpression'
	| 'resultVariableName'
	| 'async'
	| 'exclusive'
	| 'triggerable';

export type FlowableFieldValueType = 'string' | 'expression';
export type FlowableListenerEvent = 'start' | 'end' | 'take' | 'create' | 'assignment' | 'complete' | 'delete';
export type FlowableListenerImplementationType = 'class' | 'expression' | 'delegateExpression';
export type FlowableFormPropertyType = 'string' | 'long' | 'boolean' | 'date' | 'enum';
export type FlowableEventListenerImplType = 'class' | 'delegateExpression' | 'throwSignalEvent' | 'throwGlobalSignalEvent' | 'throwMessageEvent' | 'throwErrorEvent';

export interface XmlIdentified {
	xmlIdentity?: string;
}

export interface FlowableFieldExtension extends XmlIdentified {
	id: string;
	name: string;
	valueType: FlowableFieldValueType;
	value: string;
}

export interface FlowableListener extends XmlIdentified {
	id: string;
	event: FlowableListenerEvent;
	implementationType: FlowableListenerImplementationType;
	implementation: string;
}

export interface FlowableFormProperty extends XmlIdentified {
	id: string;
	name: string;
	type: FlowableFormPropertyType;
	required: boolean;
	readable: boolean;
	writable: boolean;
	defaultValue: string;
}

export interface FlowableIOParameter extends XmlIdentified {
	id: string;
	source: string;
	sourceExpression: string;
	target: string;
}

export interface FlowableMultiInstance {
	sequential: boolean;
	loopCardinality: string;
	collection: string;
	elementVariable: string;
	completionCondition: string;
}

export type TimerDefinitionType = 'timeDuration' | 'timeDate' | 'timeCycle';

export interface FlowableTimerDefinition {
	type: TimerDefinitionType;
	value: string;
}

export interface FlowableSignalDefinition extends XmlIdentified {
	id: string;
	name: string;
	scope: string;
}

export interface FlowableMessageDefinition extends XmlIdentified {
	id: string;
	name: string;
}

export interface FlowableEventListener extends XmlIdentified {
	id: string;
	events: string;
	implementationType: FlowableEventListenerImplType;
	implementation: string;
	entityType: string;
}

export interface FlowableLocalization extends XmlIdentified {
	id: string;
	locale: string;
	name: string;
	description: string;
}

export interface FlowableExceptionMap extends XmlIdentified {
	id: string;
	errorCode: string;
	className: string;
	includeChildExceptions: boolean;
}

export interface FlowableDataObject extends XmlIdentified {
	id: string;
	name: string;
	itemSubjectRef: string;
	defaultValue: string;
}

export interface FlowableElementState {
	id: string;
	type: string;
	activitiAttributes: Partial<Record<FlowableAttributeKey, string>>;
	fieldExtensions: FlowableFieldExtension[];
	taskListeners: FlowableListener[];
	executionListeners: FlowableListener[];
	formProperties: FlowableFormProperty[];
	inputParameters: FlowableIOParameter[];
	outputParameters: FlowableIOParameter[];
	multiInstance: FlowableMultiInstance | null;
	conditionExpression: string;
	script: string;
	timerDefinition: FlowableTimerDefinition | null;
	errorRef: string;
	signalRef: string;
	messageRef: string;
	terminateAll: string;
	compensateActivityRef: string;
	isForCompensation: string;
	failedJobRetryTimeCycle: string;
	exceptionMaps: FlowableExceptionMap[];
	documentation: string;
	preservedAttributes: Record<string, string>;
	preservedExtensionElements: string[];
}

export interface FlowableDocumentState {
	namespaces: Record<string, string>;
	targetNamespace: string;
	elements: Record<string, FlowableElementState>;
	signalDefinitions: FlowableSignalDefinition[];
	messageDefinitions: FlowableMessageDefinition[];
	eventListeners: FlowableEventListener[];
	localizations: FlowableLocalization[];
	dataObjects: FlowableDataObject[];
}

export const FLOWABLE_ATTRIBUTE_KEYS: FlowableAttributeKey[] = [
	'candidateStarterUsers',
	'candidateStarterGroups',
	'initiator',
	'assignee',
	'candidateUsers',
	'candidateGroups',
	'formKey',
	'dueDate',
	'priority',
	'category',
	'skipExpression',
	'class',
	'expression',
	'delegateExpression',
	'resultVariableName',
	'async',
	'exclusive',
	'triggerable',
];

export function createEmptyFlowableState(): FlowableDocumentState {
	return {
		namespaces: {},
		targetNamespace: '',
		elements: {},
		signalDefinitions: [],
		messageDefinitions: [],
		eventListeners: [],
		localizations: [],
		dataObjects: [],
	};
}

export function cloneFlowableState(state: FlowableDocumentState): FlowableDocumentState {
	return {
		namespaces: { ...state.namespaces },
		targetNamespace: state.targetNamespace,
		signalDefinitions: state.signalDefinitions.map((s) => ({ ...s })),
		messageDefinitions: state.messageDefinitions.map((m) => ({ ...m })),
		eventListeners: state.eventListeners.map((e) => ({ ...e })),
		localizations: state.localizations.map((l) => ({ ...l })),
		dataObjects: state.dataObjects.map((d) => ({ ...d })),
		elements: Object.fromEntries(
			Object.entries(state.elements).map(([id, elementState]) => [
				id,
				{
					id: elementState.id,
					type: elementState.type,
					activitiAttributes: { ...elementState.activitiAttributes },
					fieldExtensions: elementState.fieldExtensions.map((field) => ({ ...field })),
					taskListeners: elementState.taskListeners.map((listener) => ({ ...listener })),
					executionListeners: elementState.executionListeners.map((listener) => ({ ...listener })),
					formProperties: elementState.formProperties.map((property) => ({ ...property })),
					inputParameters: elementState.inputParameters.map((param) => ({ ...param })),
					outputParameters: elementState.outputParameters.map((param) => ({ ...param })),
					multiInstance: elementState.multiInstance ? { ...elementState.multiInstance } : null,
					conditionExpression: elementState.conditionExpression,
					script: elementState.script,
					timerDefinition: elementState.timerDefinition ? { ...elementState.timerDefinition } : null,
					errorRef: elementState.errorRef,
					signalRef: elementState.signalRef,
					messageRef: elementState.messageRef,
					terminateAll: elementState.terminateAll,
					compensateActivityRef: elementState.compensateActivityRef,
					isForCompensation: elementState.isForCompensation,
					failedJobRetryTimeCycle: elementState.failedJobRetryTimeCycle,
					exceptionMaps: elementState.exceptionMaps.map((e) => ({ ...e })),
					documentation: elementState.documentation,
					preservedAttributes: { ...elementState.preservedAttributes },
					preservedExtensionElements: [...elementState.preservedExtensionElements],
				},
			]),
		),
	};
}
