import type {
	FlowableAttributeKey,
	FlowableDataObject,
	FlowableElementState,
	FlowableEventListenerImplType,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableMultiInstance,
	TimerDefinitionType,
} from '../flowable/types';
import { type PropertyRenderDeps, type SharedCollectionRenderers } from './propertyRenderingTypes';

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

function renderProcessEventListenerTypeOptions(): FlowableEventListenerImplType[] {
	return ['class', 'delegateExpression', 'throwSignalEvent', 'throwGlobalSignalEvent', 'throwMessageEvent', 'throwErrorEvent'];
}

function renderTimerTypeOptions(): TimerDefinitionType[] {
	return ['timeDuration', 'timeDate', 'timeCycle'];
}

export function createSharedCollectionRenderers(deps: PropertyRenderDeps): SharedCollectionRenderers {
	const { ui } = deps;

	function renderIOParameters(group: HTMLDivElement, params: FlowableIOParameter[], kind: 'input' | 'output'): void {
		params.forEach((param, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			deps.makeDraggableItem(item, index, params, `io-${kind}`, () => {
				deps.queueMetadataSave();
				deps.renderProperties();
			});
			item.appendChild(ui.createField('Source', ui.createTextInput(param.source, (value) => deps.actions.updateIOParameter(kind, index, { source: value }))));
			item.appendChild(ui.createField('Source Expression', ui.createTextInput(param.sourceExpression, (value) => deps.actions.updateIOParameter(kind, index, { sourceExpression: value }))));
			item.appendChild(ui.createField('Target', ui.createTextInput(param.target, (value) => deps.actions.updateIOParameter(kind, index, { target: value }))));
			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.className = 'btn-remove';
			removeButton.textContent = `Remove ${kind === 'input' ? 'Input' : 'Output'} Parameter`;
			removeButton.addEventListener('click', () => deps.actions.removeIOParameter(kind, index));
			item.appendChild(removeButton);
			group.appendChild(item);
		});

		const actions = document.createElement('div');
		actions.className = 'properties-actions';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.textContent = `Add ${kind === 'input' ? 'Input' : 'Output'} Parameter`;
		addButton.addEventListener('click', () => deps.actions.addIOParameter(kind));
		actions.appendChild(addButton);
		group.appendChild(actions);
	}

	function renderMultiInstance(group: HTMLDivElement, mi: FlowableMultiInstance): void {
		group.appendChild(ui.createField('Sequential', ui.createCheckbox(mi.sequential, (value) => deps.actions.updateMultiInstance({ sequential: value })), true));
		group.appendChild(ui.createField('Loop Cardinality', ui.createTextInput(mi.loopCardinality, (value) => deps.actions.updateMultiInstance({ loopCardinality: value }))));
		group.appendChild(ui.createField('Collection', ui.createTextInput(mi.collection, (value) => deps.actions.updateMultiInstance({ collection: value }))));
		group.appendChild(ui.createField('Element Variable', ui.createTextInput(mi.elementVariable, (value) => deps.actions.updateMultiInstance({ elementVariable: value }))));
		group.appendChild(ui.createField('Completion Condition', ui.createTextInput(mi.completionCondition, (value) => deps.actions.updateMultiInstance({ completionCondition: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Multi-Instance';
		removeButton.addEventListener('click', deps.actions.removeMultiInstance);
		group.appendChild(removeButton);
	}

	function renderFieldExtensions(group: HTMLDivElement, elementState: FlowableElementState): void {
		elementState.fieldExtensions.forEach((fieldExtension, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			deps.makeDraggableItem(item, index, elementState.fieldExtensions, 'field-extensions', () => {
				deps.queueMetadataSave();
				deps.renderProperties();
			});

			item.appendChild(ui.createField('Name', ui.createTextInput(fieldExtension.name, (value) => deps.actions.updateFieldExtension(index, { name: value }))));

			const typeSelect = document.createElement('select');
			for (const valueType of ['string', 'expression'] as const) {
				const option = document.createElement('option');
				option.value = valueType;
				option.textContent = valueType === 'string' ? 'String' : 'Expression';
				option.selected = fieldExtension.valueType === valueType;
				typeSelect.appendChild(option);
			}
			typeSelect.addEventListener('change', () => {
				deps.actions.updateFieldExtension(index, { valueType: typeSelect.value as FlowableFieldExtension['valueType'] });
			});
			item.appendChild(ui.createField('Value Type', typeSelect));
			item.appendChild(ui.createField('Value', ui.createTextInput(fieldExtension.value, (value) => deps.actions.updateFieldExtension(index, { value }))));

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.className = 'btn-remove';
			removeButton.textContent = 'Remove Field Extension';
			removeButton.addEventListener('click', () => deps.actions.removeFieldExtension(index));
			item.appendChild(removeButton);
			group.appendChild(item);
		});

		const actions = document.createElement('div');
		actions.className = 'properties-actions';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.textContent = 'Add Field Extension';
		addButton.addEventListener('click', deps.actions.addFieldExtension);
		actions.appendChild(addButton);
		group.appendChild(actions);
	}

	function renderListeners(group: HTMLDivElement, listeners: FlowableListener[], kind: 'task' | 'execution'): void {
		const eventOptions = kind === 'task' ? ['create', 'assignment', 'complete', 'delete'] : ['start', 'end', 'take'];
		listeners.forEach((listener, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			deps.makeDraggableItem(item, index, listeners, `listeners-${kind}`, () => {
				deps.queueMetadataSave();
				deps.renderProperties();
			});

			const eventSelect = ui.createSelect(eventOptions, listener.event, (value) => deps.actions.updateListener(kind, index, { event: value as FlowableListener['event'] }));
			item.appendChild(ui.createField('Event', eventSelect));
			const implSelect = ui.createSelect(['class', 'expression', 'delegateExpression'], listener.implementationType, (value) => deps.actions.updateListener(kind, index, { implementationType: value as FlowableListener['implementationType'] }));
			item.appendChild(ui.createField('Implementation Type', implSelect));
			item.appendChild(ui.createField('Implementation', ui.createTextInput(listener.implementation, (value) => deps.actions.updateListener(kind, index, { implementation: value }))));

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.className = 'btn-remove';
			removeButton.textContent = kind === 'task' ? 'Remove Task Listener' : 'Remove Execution Listener';
			removeButton.addEventListener('click', () => deps.actions.removeListener(kind, index));
			item.appendChild(removeButton);
			group.appendChild(item);
		});

		const actions = document.createElement('div');
		actions.className = 'properties-actions';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.textContent = kind === 'task' ? 'Add Task Listener' : 'Add Execution Listener';
		addButton.addEventListener('click', () => deps.actions.addListener(kind));
		actions.appendChild(addButton);
		group.appendChild(actions);
	}

	function renderFormProperties(group: HTMLDivElement, formProperties: FlowableFormProperty[]): void {
		formProperties.forEach((formProperty, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			deps.makeDraggableItem(item, index, formProperties, 'form-properties', () => {
				deps.queueMetadataSave();
				deps.renderProperties();
			});
			item.appendChild(ui.createField('ID', ui.createTextInput(formProperty.id, (value) => deps.actions.updateFormProperty(index, { id: value }))));
			item.appendChild(ui.createField('Name', ui.createTextInput(formProperty.name, (value) => deps.actions.updateFormProperty(index, { name: value }))));
			item.appendChild(ui.createField('Type', ui.createSelect(['string', 'long', 'boolean', 'date', 'enum'], formProperty.type, (value) => deps.actions.updateFormProperty(index, { type: value as FlowableFormProperty['type'] }))));
			item.appendChild(ui.createField('Default', ui.createTextInput(formProperty.defaultValue, (value) => deps.actions.updateFormProperty(index, { defaultValue: value }))));
			item.appendChild(ui.createField('Required', ui.createCheckbox(formProperty.required, (checked) => deps.actions.updateFormProperty(index, { required: checked })), true));
			item.appendChild(ui.createField('Readable', ui.createCheckbox(formProperty.readable, (checked) => deps.actions.updateFormProperty(index, { readable: checked })), true));
			item.appendChild(ui.createField('Writable', ui.createCheckbox(formProperty.writable, (checked) => deps.actions.updateFormProperty(index, { writable: checked })), true));
			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.className = 'btn-remove';
			removeButton.textContent = 'Remove Form Property';
			removeButton.addEventListener('click', () => deps.actions.removeFormProperty(index));
			item.appendChild(removeButton);
			group.appendChild(item);
		});

		const actions = document.createElement('div');
		actions.className = 'properties-actions';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.textContent = 'Add Form Property';
		addButton.addEventListener('click', deps.actions.addFormProperty);
		actions.appendChild(addButton);
		group.appendChild(actions);
	}

	function renderAttributeGroup(groupTitle: string, attributes: FlowableAttributeKey[], elementState: FlowableElementState): HTMLDivElement {
		const group = ui.createGroup(groupTitle);
		for (const attribute of attributes) {
			const label = editableLabels[attribute] || attribute;
			if (attribute === 'async' || attribute === 'exclusive') {
				group.appendChild(ui.createField(label, ui.createCheckbox(elementState.activitiAttributes[attribute] === 'true', (checked) => deps.actions.updateFlowableAttribute(attribute, checked)), true));
				continue;
			}
			group.appendChild(ui.createField(label, ui.createTextInput(elementState.activitiAttributes[attribute] || '', (value) => deps.actions.updateFlowableAttribute(attribute, value), attributePlaceholders[attribute])));
		}
		return group;
	}

	function renderExceptionMaps(group: HTMLDivElement, elementState: FlowableElementState): void {
		elementState.exceptionMaps.forEach((exceptionMap, index) => {
			const item = document.createElement('div');
			item.className = 'field-array-item';
			deps.makeDraggableItem(item, index, elementState.exceptionMaps, 'exception-maps', () => {
				deps.queueMetadataSave();
				deps.renderProperties();
			});
			item.appendChild(ui.createField('Error Code', ui.createTextInput(exceptionMap.errorCode, (value) => {
				elementState.exceptionMaps[index].errorCode = value;
				deps.queueMetadataSave();
				deps.renderProperties();
			})));
			item.appendChild(ui.createField('Class Name', ui.createTextInput(exceptionMap.className, (value) => {
				elementState.exceptionMaps[index].className = value;
				deps.queueMetadataSave();
				deps.renderProperties();
			})));
			item.appendChild(ui.createField('Include Child Exceptions', ui.createCheckbox(exceptionMap.includeChildExceptions, (checked) => {
				elementState.exceptionMaps[index].includeChildExceptions = checked;
				deps.queueMetadataSave();
				deps.renderProperties();
			}), true));
			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.className = 'btn-remove';
			removeButton.textContent = 'Remove';
			removeButton.addEventListener('click', () => {
				elementState.exceptionMaps.splice(index, 1);
				deps.queueMetadataSave();
				deps.renderProperties();
			});
			item.appendChild(removeButton);
			group.appendChild(item);
		});
	}

	function upsertFieldExtensionValue(elementState: FlowableElementState, fieldName: string, value: string): void {
		const selectedElement = deps.getSelectedElement();
		const fieldIndex = elementState.fieldExtensions.findIndex((field) => field.name === fieldName);
		if (!value.trim()) {
			if (fieldIndex >= 0) {
				deps.actions.removeFieldExtension(fieldIndex);
			}
			return;
		}
		if (fieldIndex >= 0) {
			deps.actions.updateFieldExtension(fieldIndex, { value });
			return;
		}
		if (!selectedElement) {
			return;
		}
		const state = deps.ensureElementState(selectedElement);
		state.fieldExtensions.push({
			id: `field-${Date.now()}`,
			name: fieldName,
			valueType: 'string',
			value,
		});
		deps.queueMetadataSave();
		deps.renderProperties();
	}

	function renderTextFieldExtension(group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string, multiline = false): void {
		const existing = elementState.fieldExtensions.find((field) => field.name === fieldName);
		const control = multiline
			? ui.createTextArea(existing?.value || '', (value) => upsertFieldExtensionValue(elementState, fieldName, value))
			: ui.createTextInput(existing?.value || '', (value) => upsertFieldExtensionValue(elementState, fieldName, value));
		group.appendChild(ui.createField(label, control));
	}

	function renderBooleanFieldExtension(group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string): void {
		const existing = elementState.fieldExtensions.find((field) => field.name === fieldName);
		group.appendChild(ui.createField(label, ui.createCheckbox(existing?.value === 'true', (checked) => {
			upsertFieldExtensionValue(elementState, fieldName, checked ? 'true' : 'false');
		}), true));
	}

	function renderMailField(group: HTMLDivElement, elementState: FlowableElementState, fieldName: string, label: string, multiline = false): void {
		renderTextFieldExtension(group, elementState, fieldName, label, multiline);
	}

	function renderProcessDataObject(group: HTMLDivElement, processId: string, dataObject: FlowableDataObject, index: number): void {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		deps.makeProcessScopedDraggableItem(item, index, deps.getFlowableState().dataObjects, processId, deps.getKnownProcessIds(), 'data-objects', () => {
			deps.queueMetadataSave();
			deps.renderProperties();
		});
		item.appendChild(ui.createField('ID', ui.createTextInput(dataObject.id, (value) => deps.actions.updateDataObject(processId, index, { id: value }))));
		item.appendChild(ui.createField('Name', ui.createTextInput(dataObject.name, (value) => deps.actions.updateDataObject(processId, index, { name: value }))));
		item.appendChild(ui.createField('Type', ui.createTextInput(dataObject.itemSubjectRef, (value) => deps.actions.updateDataObject(processId, index, { itemSubjectRef: value }))));
		item.appendChild(ui.createField('Default Value', ui.createTextInput(dataObject.defaultValue, (value) => deps.actions.updateDataObject(processId, index, { defaultValue: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Data Object';
		removeButton.addEventListener('click', () => deps.actions.removeDataObject(processId, index));
		item.appendChild(removeButton);
		group.appendChild(item);
	}

	return {
		renderIOParameters,
		renderMultiInstance,
		renderFieldExtensions,
		renderListeners,
		renderFormProperties,
		renderAttributeGroup,
		renderExceptionMaps,
		renderMailField,
		renderBooleanFieldExtension,
		renderTextFieldExtension,
		renderProcessEventListenerTypeOptions,
		renderTimerTypeOptions,
		renderProcessDataObject,
	};
}