import type { FlowableAttributeKey, FlowableElementState } from '../flowable/types';
import {
	getBusinessObject,
	isActivity,
	isBusinessRuleTask,
	isCallActivity,
	isGenericServiceTask,
	isLane,
	isManualTask,
	isParticipant,
	isReceiveTask,
	isSendTask,
	isStartEvent,
	isSubProcessType,
	isUserTask,
	isEventSubProcess,
	type BpmnElement,
} from './bpmnTypeGuards';
import type { PropertyRenderDeps, SharedCollectionRenderers } from './propertyRenderingTypes';

const userTaskAttributes: FlowableAttributeKey[] = ['assignee', 'candidateUsers', 'candidateGroups', 'formKey', 'dueDate', 'priority', 'category', 'skipExpression', 'async', 'exclusive'];
const serviceTaskAttributes: FlowableAttributeKey[] = ['class', 'expression', 'delegateExpression', 'resultVariableName', 'skipExpression', 'async', 'exclusive', 'triggerable'];
const sendTaskAttributes: FlowableAttributeKey[] = ['class', 'expression', 'delegateExpression', 'resultVariableName', 'skipExpression', 'async', 'exclusive'];
const receiveTaskAttributes: FlowableAttributeKey[] = ['async', 'exclusive'];
const manualTaskAttributes: FlowableAttributeKey[] = ['async', 'exclusive'];
const startEventAttributes: FlowableAttributeKey[] = ['formKey', 'initiator'];
const businessRuleTaskAttributes: FlowableAttributeKey[] = ['class', 'expression', 'delegateExpression', 'resultVariableName', 'skipExpression', 'async', 'exclusive'];

function renderServiceTaskProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	properties.appendChild(renderers.renderAttributeGroup('Service Task', serviceTaskAttributes, elementState));
	const fieldExtensionsGroup = ui.createGroup('Field Extensions');
	renderers.renderFieldExtensions(fieldExtensionsGroup, elementState);
	properties.appendChild(fieldExtensionsGroup);
	const exceptionGroup = ui.createGroup('Exception Mapping');
	renderers.renderExceptionMaps(exceptionGroup, elementState);
	const actions = document.createElement('div');
	actions.className = 'properties-actions';
	const addButton = document.createElement('button');
	addButton.type = 'button';
	addButton.textContent = 'Add Exception Mapping';
	addButton.addEventListener('click', () => {
		elementState.exceptionMaps.push({ id: `exception-${Date.now()}`, errorCode: '', className: '', includeChildExceptions: false });
		deps.queueMetadataSave();
		deps.renderProperties();
	});
	actions.appendChild(addButton);
	exceptionGroup.appendChild(actions);
	properties.appendChild(exceptionGroup);
}

function renderCallActivityProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
	businessObject: Record<string, unknown>,
): void {
	const { ui } = deps;
	const callGroup = ui.createGroup('Call Activity');
	callGroup.appendChild(ui.createField('Called Element', ui.createTextInput(typeof businessObject.calledElement === 'string' ? businessObject.calledElement : '', (value) => {
		deps.modeling.updateProperties(selectedElement, { calledElement: value });
		deps.queueMetadataSave();
	}, 'e.g. mySubProcess')));
	properties.appendChild(callGroup);
	const inputGroup = ui.createGroup('Input Parameters');
	renderers.renderIOParameters(inputGroup, elementState.inputParameters, 'input');
	properties.appendChild(inputGroup);
	const outputGroup = ui.createGroup('Output Parameters');
	renderers.renderIOParameters(outputGroup, elementState.outputParameters, 'output');
	properties.appendChild(outputGroup);
}

function renderActivityProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	const multiInstanceGroup = ui.createGroup('Multi-Instance');
	if (elementState.multiInstance) {
		renderers.renderMultiInstance(multiInstanceGroup, elementState.multiInstance);
	} else {
		const actions = document.createElement('div');
		actions.className = 'properties-actions';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.textContent = 'Add Multi-Instance';
		addButton.addEventListener('click', () => deps.actions.updateMultiInstance({}));
		actions.appendChild(addButton);
		multiInstanceGroup.appendChild(actions);
	}
	properties.appendChild(multiInstanceGroup);

	const compensationGroup = ui.createGroup('Compensation');
	compensationGroup.appendChild(ui.createField('Is Compensation Handler', ui.createCheckbox(elementState.isForCompensation === 'true', (checked) => deps.actions.updateIsForCompensation(checked)), true));
	properties.appendChild(compensationGroup);
}

function renderUserTaskProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	properties.appendChild(renderers.renderAttributeGroup('User Task', userTaskAttributes, elementState));
	const formPropertiesGroup = ui.createGroup('Form Properties');
	renderers.renderFormProperties(formPropertiesGroup, elementState.formProperties);
	properties.appendChild(formPropertiesGroup);
	const taskListenersGroup = ui.createGroup('Task Listeners');
	renderers.renderListeners(taskListenersGroup, elementState.taskListeners, 'task');
	properties.appendChild(taskListenersGroup);
}

function renderParticipantAndLaneProperties(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	businessObject: Record<string, unknown>,
): void {
	const { ui } = deps;
	if (isParticipant(selectedElement)) {
		const poolGroup = ui.createGroup('Pool');
		const processRef = businessObject.processRef as { id?: string } | undefined;
		const processRefInput = ui.createTextInput(processRef?.id || '', () => {});
		processRefInput.readOnly = true;
		poolGroup.appendChild(ui.createField('Process Reference', processRefInput));
		properties.appendChild(poolGroup);
	}

	if (isLane(selectedElement)) {
		const laneGroup = ui.createGroup('Lane');
		laneGroup.appendChild(ui.createField('Name', ui.createTextInput(typeof businessObject.name === 'string' ? businessObject.name : '', (value) => {
			deps.modeling.updateProperties(selectedElement, { name: value });
			deps.queueMetadataSave();
		})));
		properties.appendChild(laneGroup);
	}
}

function renderSubProcessAndStartEventProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	if (isSubProcessType(selectedElement)) {
		const subProcessGroup = ui.createGroup('Sub Process');
		if (isEventSubProcess(selectedElement)) {
			const triggeredByEvent = getBusinessObject(selectedElement).triggeredByEvent === true;
			const eventSubProcessCheckbox = ui.createCheckbox(triggeredByEvent, () => {});
			eventSubProcessCheckbox.disabled = true;
			subProcessGroup.appendChild(ui.createField('Event Sub Process', eventSubProcessCheckbox, true));
		}
		subProcessGroup.appendChild(ui.createField('Async', ui.createCheckbox(elementState.activitiAttributes.async === 'true', (checked) => deps.actions.updateFlowableAttribute('async', checked)), true));
		subProcessGroup.appendChild(ui.createField('Exclusive', ui.createCheckbox(elementState.activitiAttributes.exclusive === 'true', (checked) => deps.actions.updateFlowableAttribute('exclusive', checked)), true));
		properties.appendChild(subProcessGroup);
	}

	if (isStartEvent(selectedElement)) {
		properties.appendChild(renderers.renderAttributeGroup('Start Event', startEventAttributes, elementState));
		const formPropertiesGroup = ui.createGroup('Form Properties');
		renderers.renderFormProperties(formPropertiesGroup, elementState.formProperties);
		properties.appendChild(formPropertiesGroup);
	}
}

export function renderTaskProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	const businessObject = getBusinessObject(selectedElement);

	if (isUserTask(selectedElement)) {
		renderUserTaskProperties(deps, renderers, properties, elementState);
	}

	if (isGenericServiceTask(selectedElement)) {
		renderServiceTaskProperties(deps, renderers, properties, elementState);
	}

	if (isSendTask(selectedElement)) {
		properties.appendChild(renderers.renderAttributeGroup('Send Task', sendTaskAttributes, elementState));
		const fieldExtensionsGroup = ui.createGroup('Field Extensions');
		renderers.renderFieldExtensions(fieldExtensionsGroup, elementState);
		properties.appendChild(fieldExtensionsGroup);
	}

	if (isReceiveTask(selectedElement)) {
		properties.appendChild(renderers.renderAttributeGroup('Receive Task', receiveTaskAttributes, elementState));
	}

	if (isManualTask(selectedElement)) {
		properties.appendChild(renderers.renderAttributeGroup('Manual Task', manualTaskAttributes, elementState));
	}

	renderParticipantAndLaneProperties(deps, properties, selectedElement, businessObject as Record<string, unknown>);
	renderSubProcessAndStartEventProperties(deps, renderers, properties, selectedElement, elementState);

	if (isBusinessRuleTask(selectedElement)) {
		const businessRuleGroup = ui.createGroup('Business Rule Task');
		businessRuleGroup.appendChild(ui.createField('Rule Names', ui.createTextInput(typeof businessObject.ruleNames === 'string' ? businessObject.ruleNames : '', (value) => {
			deps.modeling.updateProperties(selectedElement, { ruleNames: value });
			deps.queueMetadataSave();
		})));
		properties.appendChild(businessRuleGroup);
		properties.appendChild(renderers.renderAttributeGroup('Business Rule Implementation', businessRuleTaskAttributes, elementState));
	}

	if (isCallActivity(selectedElement)) {
		renderCallActivityProperties(deps, renderers, properties, selectedElement, elementState, businessObject as Record<string, unknown>);
	}

	if (isActivity(selectedElement)) {
		renderActivityProperties(deps, renderers, properties, elementState);
	}
}