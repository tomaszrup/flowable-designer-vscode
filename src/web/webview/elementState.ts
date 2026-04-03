import type {
	FlowableElementState,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
} from '../flowable/types';

export function createElementState(id: string, type: string): FlowableElementState {
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

export function createFieldExtension(nextId: number): FlowableFieldExtension {
	return {
		id: `field-${nextId}`,
		name: '',
		valueType: 'string',
		value: '',
	};
}

export function createListener(kind: 'task' | 'execution', nextId: number): FlowableListener {
	return {
		id: `${kind}-listener-${nextId}`,
		event: kind === 'task' ? 'create' : 'start',
		implementationType: 'class',
		implementation: '',
	};
}

export function createFormProperty(nextId: number): FlowableFormProperty {
	return {
		id: `form-property-${nextId}`,
		name: '',
		type: 'string',
		required: false,
		readable: true,
		writable: true,
		defaultValue: '',
	};
}

export function createIOParameter(nextId: number): FlowableIOParameter {
	return {
		id: `io-param-${nextId}`,
		source: '',
		sourceExpression: '',
		target: '',
	};
}