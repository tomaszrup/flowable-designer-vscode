import { describe, expect, test, vi } from 'vitest';
import { createElementActions } from '../../webview/elementActions';
import type { FlowableElementState } from '../../flowable/types';
import type { BpmnElement } from '../../webview/bpmnTypeGuards';

function createBaseState(id: string, type = 'bpmn:ServiceTask'): FlowableElementState {
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

function createSelectedElement(id: string, type = 'bpmn:ServiceTask'): BpmnElement {
	return {
		id,
		type,
		businessObject: {
			id,
			$type: type,
		},
	};
}

describe('element actions', () => {
	test('does not rename local metadata when modeling rejects an id change', () => {
		const selectedElement = createSelectedElement('task1');
		const elementStateById: Record<string, FlowableElementState> = {
			task1: createBaseState('task1'),
		};
		const renameElementState = vi.fn((oldId: string, newId: string, type: string) => {
			elementStateById[newId] = { ...elementStateById[oldId], id: newId, type };
			delete elementStateById[oldId];
		});
		const queueMetadataSave = vi.fn();

		const actions = createElementActions({
			getSelectedElement: () => selectedElement,
			ensureElementState: () => elementStateById.task1,
			renameElementState,
			modeling: {
				updateProperties: () => {
					throw new Error('duplicate id');
				},
			},
			queueMetadataSave,
			setStatus: vi.fn(),
			renderProperties: vi.fn(),
			counters: { field: 0, listener: 0, formProperty: 0, ioParameter: 0 },
		});

		actions.updateGeneralProperty('id', 'task2');

		expect(renameElementState).not.toHaveBeenCalled();
		expect(queueMetadataSave).not.toHaveBeenCalled();
		expect(elementStateById.task1.id).toBe('task1');
		expect(elementStateById.task2).toBeUndefined();
	});

	test('stores explicit false for exclusive flowable attributes', () => {
		const selectedElement = createSelectedElement('task1');
		const elementState = createBaseState('task1');

		const actions = createElementActions({
			getSelectedElement: () => selectedElement,
			ensureElementState: () => elementState,
			renameElementState: vi.fn(),
			modeling: { updateProperties: vi.fn() },
			queueMetadataSave: vi.fn(),
			setStatus: vi.fn(),
			renderProperties: vi.fn(),
			counters: { field: 0, listener: 0, formProperty: 0, ioParameter: 0 },
		});

		actions.updateFlowableAttribute('exclusive', false);

		expect(elementState.activitiAttributes.exclusive).toBe('false');
	});
});