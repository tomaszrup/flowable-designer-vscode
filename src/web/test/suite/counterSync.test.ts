import { describe, expect, it } from 'vitest';
import { createEmptyFlowableState } from '../../flowable/types';
import { syncActionCountersFromState, type ActionCounters } from '../../webview/counterSync';

function createCounters(): ActionCounters {
	return {
		field: 0,
		listener: 0,
		formProperty: 0,
		ioParameter: 0,
		signalDefinition: 0,
		messageDefinition: 0,
		eventListener: 0,
		localization: 0,
		dataObject: 0,
	};
}

describe('counter sync helpers', () => {
	it('seeds generated counters from loaded Flowable state', () => {
		const state = createEmptyFlowableState();
		state.signalDefinitions.push({ id: 'signal-4', name: '', scope: '' });
		state.messageDefinitions.push({ id: 'message-3', name: '' });
		state.eventListeners.push({ id: 'event-listener-6', processId: 'Process_1', events: '', implementationType: 'class', implementation: '', entityType: '' });
		state.localizations.push({ id: 'localization-8', processId: 'Process_1', locale: '', name: '', description: '' });
		state.elements.task1 = {
			id: 'task1',
			type: 'bpmn:ServiceTask',
			activitiAttributes: {},
			fieldExtensions: [{ id: 'field-5', name: '', valueType: 'string', value: '' }],
			taskListeners: [{ id: 'task-listener-9', event: 'create', implementationType: 'class', implementation: '' }],
			executionListeners: [{ id: 'execution-listener-7', event: 'start', implementationType: 'class', implementation: '' }],
			formProperties: [{ id: 'form-property-2', name: '', type: 'string', required: false, readable: true, writable: true, defaultValue: '' }],
			inputParameters: [{ id: 'io-param-10', source: '', sourceExpression: '', target: '' }],
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
		const counters = createCounters();
		state.dataObjects.push({ id: 'data-object-11', processId: 'Process_1', name: '', itemSubjectRef: 'xsd:string', defaultValue: '' });

		syncActionCountersFromState(state, counters);

		expect(counters).toEqual({
			field: 5,
			listener: 9,
			formProperty: 2,
			ioParameter: 10,
			signalDefinition: 4,
			messageDefinition: 3,
			eventListener: 6,
			localization: 8,
			dataObject: 11,
		});
	});
});