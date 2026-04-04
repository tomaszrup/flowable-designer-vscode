import { describe, expect, it, vi } from 'vitest';
import { createEmptyFlowableState } from '../../flowable/types';
import { createDocumentActions } from '../../webview/documentActions';

function createTestContext(knownProcessIds: string[] = ['Process_1', 'Process_2']) {
	const state = createEmptyFlowableState();
	const counters = {
		signalDefinition: 0,
		messageDefinition: 0,
		eventListener: 0,
		localization: 0,
		dataObject: 0,
	};
	const queueMetadataSave = vi.fn();
	const renderProperties = vi.fn();
	const setStatus = vi.fn();
	const actions = createDocumentActions({
		getFlowableState: () => state,
		getKnownProcessIds: () => knownProcessIds,
		queueMetadataSave,
		renderProperties,
		setStatus,
		counters,
	});

	return {
		actions,
		state,
		counters,
		queueMetadataSave,
		renderProperties,
		setStatus,
	};
}

describe('document actions', () => {

	it('updates the target namespace without forcing a rerender', () => {
		const { actions, state, queueMetadataSave, renderProperties, setStatus } = createTestContext();

		actions.updateTargetNamespace('http://flowable.test/process');

		expect(state.targetNamespace).toBe('http://flowable.test/process');
		expect(queueMetadataSave).toHaveBeenCalledTimes(1);
		expect(setStatus).toHaveBeenCalledWith('Target namespace updated');
		expect(renderProperties).not.toHaveBeenCalled();
	});

	it('adds, updates, and removes signal and message definitions', () => {
		const { actions, state, counters, queueMetadataSave, renderProperties } = createTestContext();

		actions.addSignalDefinition();
		actions.addMessageDefinition();
		actions.updateSignalDefinition(0, { name: 'Signal A', scope: 'global' });
		actions.updateMessageDefinition(0, { name: 'Message A' });
		actions.updateSignalDefinition(9, { name: 'ignored' });
		actions.updateMessageDefinition(9, { name: 'ignored' });
		actions.removeSignalDefinition(0);
		actions.removeMessageDefinition(0);

		expect(counters.signalDefinition).toBe(1);
		expect(counters.messageDefinition).toBe(1);
		expect(state.signalDefinitions).toEqual([]);
		expect(state.messageDefinitions).toEqual([]);
		expect(queueMetadataSave).toHaveBeenCalledTimes(6);
		expect(renderProperties).toHaveBeenCalledTimes(6);
	});

	it('manages process-scoped event listeners and ignores invalid scoped indexes', () => {
		const { actions, state, counters, queueMetadataSave, renderProperties } = createTestContext();

		state.eventListeners.push(
			{
				id: 'existing-process-1',
				processId: 'Process_1',
				events: 'start',
				implementationType: 'class',
				implementation: 'com.example.StartListener',
				entityType: '',
			},
			{
				id: 'existing-process-2',
				processId: 'Process_2',
				events: 'end',
				implementationType: 'delegateExpression',
				implementation: '${listener}',
				entityType: 'task',
			},
		);

		actions.addEventListener('Process_1');
		actions.updateEventListener('Process_1', 1, {
			events: 'complete',
			implementation: 'com.example.CompleteListener',
		});
		actions.updateEventListener('Process_1', 9, { events: 'ignored' });
		actions.removeEventListener('Process_1', 0);
		actions.removeEventListener('Process_1', 9);

		expect(counters.eventListener).toBe(1);
		expect(state.eventListeners).toEqual([
			{
				id: 'existing-process-2',
				processId: 'Process_2',
				events: 'end',
				implementationType: 'delegateExpression',
				implementation: '${listener}',
				entityType: 'task',
			},
			{
				id: 'event-listener-1',
				processId: 'Process_1',
				events: 'complete',
				implementationType: 'class',
				implementation: 'com.example.CompleteListener',
				entityType: '',
			},
		]);
		expect(queueMetadataSave).toHaveBeenCalledTimes(3);
		expect(renderProperties).toHaveBeenCalledTimes(3);
	});

	it('updates unscoped localizations when only one process is known', () => {
		const { actions, state, counters, queueMetadataSave, renderProperties } = createTestContext(['Process_1']);

		state.localizations.push({
			id: 'localization-existing',
			locale: 'en',
			name: 'Old name',
			description: 'Old description',
		});

		actions.addLocalization('Process_1');
		actions.updateLocalization('Process_1', 0, { name: 'New name' });
		actions.removeLocalization('Process_1', 1);
		actions.updateLocalization('Process_1', 9, { name: 'ignored' });
		actions.removeLocalization('Process_1', 9);

		expect(counters.localization).toBe(1);
		expect(state.localizations).toEqual([
			{
				id: 'localization-existing',
				locale: 'en',
				name: 'New name',
				description: 'Old description',
			},
		]);
		expect(queueMetadataSave).toHaveBeenCalledTimes(3);
		expect(renderProperties).toHaveBeenCalledTimes(3);
	});

	it('assigns stable incrementing ids to new data objects and updates by scoped index', () => {
		const { actions, state, counters, queueMetadataSave, renderProperties } = createTestContext();

		state.dataObjects.push({
			id: 'process-2-object',
			processId: 'Process_2',
			name: 'Foreign object',
			itemSubjectRef: 'xsd:int',
			defaultValue: '1',
		});

		actions.addDataObject('Process_1');
		actions.addDataObject('Process_1');
		actions.updateDataObject('Process_1', 1, { name: 'Second object', defaultValue: '42' });
		actions.updateDataObject('Process_1', 9, { name: 'ignored' });
		actions.removeDataObject('Process_1', 0);
		actions.removeDataObject('Process_1', 9);

		expect(counters.dataObject).toBe(2);
		expect(state.dataObjects).toEqual([
			{
				id: 'process-2-object',
				processId: 'Process_2',
				name: 'Foreign object',
				itemSubjectRef: 'xsd:int',
				defaultValue: '1',
			},
			{
				id: 'data-object-2',
				processId: 'Process_1',
				name: 'Second object',
				itemSubjectRef: 'xsd:string',
				defaultValue: '42',
			},
		]);
		expect(queueMetadataSave).toHaveBeenCalledTimes(4);
		expect(renderProperties).toHaveBeenCalledTimes(4);
	});
});