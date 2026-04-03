import type {
	FlowableAttributeKey,
	FlowableElementState,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableMultiInstance,
	FlowableTimerDefinition,
} from '../flowable/types';
import { getElementId, getElementType, type BpmnElement } from './bpmnTypeGuards';
import { createFieldExtension, createFormProperty, createIOParameter, createListener } from './elementState';

interface ActionCounters {
	field: number;
	listener: number;
	formProperty: number;
	ioParameter: number;
}

interface ModelingService {
	updateProperties(element: BpmnElement, properties: Record<string, unknown>): void;
}

interface ElementActionDeps {
	getSelectedElement: () => BpmnElement | null;
	ensureElementState: (element: BpmnElement) => FlowableElementState;
	renameElementState: (oldId: string, newId: string, type: string) => void;
	modeling: ModelingService;
	queueMetadataSave: () => void;
	setStatus: (message: string, state?: 'idle' | 'error') => void;
	renderProperties: () => void;
	counters: ActionCounters;
}

type ListenerCollectionKey = 'taskListeners' | 'executionListeners';
type ParameterCollectionKey = 'inputParameters' | 'outputParameters';
type SavedStringPropertyKey =
	| 'conditionExpression'
	| 'script'
	| 'errorRef'
	| 'signalRef'
	| 'messageRef'
	| 'terminateAll'
	| 'compensateActivityRef'
	| 'isForCompensation'
	| 'failedJobRetryTimeCycle'
	| 'documentation';

function getListenerKey(kind: 'task' | 'execution'): ListenerCollectionKey {
	return kind === 'task' ? 'taskListeners' : 'executionListeners';
}

function getParameterKey(kind: 'input' | 'output'): ParameterCollectionKey {
	return kind === 'input' ? 'inputParameters' : 'outputParameters';
}

export interface ElementActions {
	updateGeneralProperty: (property: 'id' | 'name', value: string) => void;
	updateFlowableAttribute: (attribute: FlowableAttributeKey, value: string | boolean) => void;
	updateFieldExtension: (index: number, patch: Partial<FlowableFieldExtension>) => void;
	removeFieldExtension: (index: number) => void;
	addFieldExtension: () => void;
	updateListener: (kind: 'task' | 'execution', index: number, patch: Partial<FlowableListener>) => void;
	addListener: (kind: 'task' | 'execution') => void;
	removeListener: (kind: 'task' | 'execution', index: number) => void;
	updateFormProperty: (index: number, patch: Partial<FlowableFormProperty>) => void;
	addFormProperty: () => void;
	removeFormProperty: (index: number) => void;
	updateConditionExpression: (value: string) => void;
	updateScript: (value: string) => void;
	updateMultiInstance: (patch: Partial<FlowableMultiInstance>) => void;
	removeMultiInstance: () => void;
	updateIOParameter: (kind: 'input' | 'output', index: number, patch: Partial<FlowableIOParameter>) => void;
	addIOParameter: (kind: 'input' | 'output') => void;
	removeIOParameter: (kind: 'input' | 'output', index: number) => void;
	updateTimerDefinition: (patch: Partial<FlowableTimerDefinition>) => void;
	updateErrorRef: (value: string) => void;
	updateSignalRef: (value: string) => void;
	updateMessageRef: (value: string) => void;
	updateTerminateAll: (checked: boolean) => void;
	updateCompensateActivityRef: (value: string) => void;
	updateIsForCompensation: (checked: boolean) => void;
	updateFailedJobRetryTimeCycle: (value: string) => void;
	updateDocumentation: (value: string) => void;
}

export function createElementActions(deps: ElementActionDeps): ElementActions {
	function getSelectedState(): FlowableElementState | undefined {
		const selectedElement = deps.getSelectedElement();
		return selectedElement ? deps.ensureElementState(selectedElement) : undefined;
	}

	function rerender(message: string): void {
		deps.queueMetadataSave();
		deps.setStatus(message);
		deps.renderProperties();
	}

	function withSelectedState(update: (elementState: FlowableElementState) => void): void {
		const elementState = getSelectedState();
		if (!elementState) {
			return;
		}
		update(elementState);
	}

	function updateAndRerender(update: (elementState: FlowableElementState) => void, message: string): void {
		withSelectedState((elementState) => {
			update(elementState);
			rerender(message);
		});
	}

	function setSavedStringProperty(
		key: SavedStringPropertyKey,
		value: string,
		message: string,
	): void {
		withSelectedState((elementState) => {
			elementState[key] = value;
			deps.queueMetadataSave();
			deps.setStatus(message);
		});
	}

	function updateGeneralProperty(property: 'id' | 'name', value: string): void {
		const selectedElement = deps.getSelectedElement();
		if (!selectedElement) {
			return;
		}

		if (property === 'id') {
			const nextId = value.trim();
			if (!nextId) {
				return;
			}

			const previousId = getElementId(selectedElement);
			try {
				deps.modeling.updateProperties(selectedElement, { id: nextId });
			} catch (error) {
				deps.setStatus(error instanceof Error ? error.message : 'Unable to update element ID', 'error');
				deps.renderProperties();
				return;
			}

			const appliedId = getElementId(selectedElement);
			if (appliedId !== nextId) {
				deps.setStatus('Element ID was not applied', 'error');
				deps.renderProperties();
				return;
			}

			deps.renameElementState(previousId, appliedId, getElementType(selectedElement));
			deps.queueMetadataSave();
			return;
		}

		deps.modeling.updateProperties(selectedElement, { name: value });
	}

	function updateFlowableAttribute(attribute: FlowableAttributeKey, value: string | boolean): void {
		let stringValue: string;
		if (typeof value === 'boolean') {
			if (value) {
				stringValue = 'true';
			} else {
				stringValue = attribute === 'exclusive' ? 'false' : '';
			}
		} else {
			stringValue = value.trim();
		}
		updateAndRerender((elementState) => {
			if (stringValue) {
				elementState.activitiAttributes[attribute] = stringValue;
				return;
			}
			delete elementState.activitiAttributes[attribute];
		}, 'Flowable properties updated');
	}

	function updateFieldExtension(index: number, patch: Partial<FlowableFieldExtension>): void {
		updateAndRerender((elementState) => {
			elementState.fieldExtensions = elementState.fieldExtensions.map((fieldExtension, fieldIndex) => {
				return fieldIndex === index ? { ...fieldExtension, ...patch } : fieldExtension;
			});
		}, 'Field extensions updated');
	}

	function removeFieldExtension(index: number): void {
		updateAndRerender((elementState) => {
			elementState.fieldExtensions = elementState.fieldExtensions.filter((_, fieldIndex) => fieldIndex !== index);
		}, 'Field extension removed');
	}

	function addFieldExtension(): void {
		updateAndRerender((elementState) => {
			deps.counters.field += 1;
			elementState.fieldExtensions = [...elementState.fieldExtensions, createFieldExtension(deps.counters.field)];
		}, 'Field extension added');
	}

	function updateListener(kind: 'task' | 'execution', index: number, patch: Partial<FlowableListener>): void {
		const key = getListenerKey(kind);
		updateAndRerender((elementState) => {
			elementState[key] = elementState[key].map((listener, listenerIndex) => {
				return listenerIndex === index ? { ...listener, ...patch } : listener;
			});
		}, 'Listener updated');
	}

	function addListener(kind: 'task' | 'execution'): void {
		const key = getListenerKey(kind);
		updateAndRerender((elementState) => {
			deps.counters.listener += 1;
			elementState[key] = [...elementState[key], createListener(kind, deps.counters.listener)];
		}, 'Listener added');
	}

	function removeListener(kind: 'task' | 'execution', index: number): void {
		const key = getListenerKey(kind);
		updateAndRerender((elementState) => {
			elementState[key] = elementState[key].filter((_, listenerIndex) => listenerIndex !== index);
		}, 'Listener removed');
	}

	function updateFormProperty(index: number, patch: Partial<FlowableFormProperty>): void {
		updateAndRerender((elementState) => {
			elementState.formProperties = elementState.formProperties.map((formProperty, formPropertyIndex) => {
				return formPropertyIndex === index ? { ...formProperty, ...patch } : formProperty;
			});
		}, 'Form property updated');
	}

	function addFormProperty(): void {
		updateAndRerender((elementState) => {
			deps.counters.formProperty += 1;
			elementState.formProperties = [...elementState.formProperties, createFormProperty(deps.counters.formProperty)];
		}, 'Form property added');
	}

	function removeFormProperty(index: number): void {
		updateAndRerender((elementState) => {
			elementState.formProperties = elementState.formProperties.filter((_, formPropertyIndex) => formPropertyIndex !== index);
		}, 'Form property removed');
	}

	function updateConditionExpression(value: string): void {
		setSavedStringProperty('conditionExpression', value, 'Condition expression updated');
	}

	function updateScript(value: string): void {
		setSavedStringProperty('script', value, 'Script updated');
	}

	function updateMultiInstance(patch: Partial<FlowableMultiInstance>): void {
		const elementState = getSelectedState();
		if (!elementState) {
			return;
		}
		elementState.multiInstance ??= {
			sequential: false,
			loopCardinality: '',
			collection: '',
			elementVariable: '',
			completionCondition: '',
		};
		Object.assign(elementState.multiInstance, patch);
		rerender('Multi-instance updated');
	}

	function removeMultiInstance(): void {
		updateAndRerender((elementState) => {
			elementState.multiInstance = null;
		}, 'Multi-instance removed');
	}

	function updateIOParameter(kind: 'input' | 'output', index: number, patch: Partial<FlowableIOParameter>): void {
		const key = getParameterKey(kind);
		updateAndRerender((elementState) => {
			elementState[key] = elementState[key].map((parameter, parameterIndex) => {
				return parameterIndex === index ? { ...parameter, ...patch } : parameter;
			});
		}, 'IO parameter updated');
	}

	function addIOParameter(kind: 'input' | 'output'): void {
		const key = getParameterKey(kind);
		updateAndRerender((elementState) => {
			deps.counters.ioParameter += 1;
			elementState[key] = [...elementState[key], createIOParameter(deps.counters.ioParameter)];
		}, 'IO parameter added');
	}

	function removeIOParameter(kind: 'input' | 'output', index: number): void {
		const key = getParameterKey(kind);
		updateAndRerender((elementState) => {
			elementState[key] = elementState[key].filter((_, parameterIndex) => parameterIndex !== index);
		}, 'IO parameter removed');
	}

	function updateTimerDefinition(patch: Partial<FlowableTimerDefinition>): void {
		const elementState = getSelectedState();
		if (!elementState) {
			return;
		}
		elementState.timerDefinition ??= { type: 'timeDuration', value: '' };
		Object.assign(elementState.timerDefinition, patch);
		rerender('Timer definition updated');
	}

	function updateErrorRef(value: string): void {
		setSavedStringProperty('errorRef', value, 'Error reference updated');
	}

	function updateSignalRef(value: string): void {
		setSavedStringProperty('signalRef', value, 'Signal reference updated');
	}

	function updateMessageRef(value: string): void {
		setSavedStringProperty('messageRef', value, 'Message reference updated');
	}

	function updateTerminateAll(checked: boolean): void {
		setSavedStringProperty('terminateAll', checked ? 'true' : '', 'Terminate all updated');
	}

	function updateCompensateActivityRef(value: string): void {
		setSavedStringProperty('compensateActivityRef', value, 'Compensate activity reference updated');
	}

	function updateIsForCompensation(checked: boolean): void {
		setSavedStringProperty('isForCompensation', checked ? 'true' : '', 'Is for compensation updated');
	}

	function updateFailedJobRetryTimeCycle(value: string): void {
		setSavedStringProperty('failedJobRetryTimeCycle', value, 'Failed job retry time cycle updated');
	}

	function updateDocumentation(value: string): void {
		setSavedStringProperty('documentation', value, 'Documentation updated');
	}

	return {
		updateGeneralProperty,
		updateFlowableAttribute,
		updateFieldExtension,
		removeFieldExtension,
		addFieldExtension,
		updateListener,
		addListener,
		removeListener,
		updateFormProperty,
		addFormProperty,
		removeFormProperty,
		updateConditionExpression,
		updateScript,
		updateMultiInstance,
		removeMultiInstance,
		updateIOParameter,
		addIOParameter,
		removeIOParameter,
		updateTimerDefinition,
		updateErrorRef,
		updateSignalRef,
		updateMessageRef,
		updateTerminateAll,
		updateCompensateActivityRef,
		updateIsForCompensation,
		updateFailedJobRetryTimeCycle,
		updateDocumentation,
	};
}