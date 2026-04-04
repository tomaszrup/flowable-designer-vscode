import type { FlowableElementState } from '../flowable/types';
import {
	getBusinessObject,
	getEventDefinitionType,
	isBoundaryEvent,
	isEventElement,
	isFlowNode,
	isGateway,
	isManualTask,
	isReceiveTask,
	isSendTask,
	isSequenceFlow,
	isServiceTask,
	isTextAnnotation,
	isUserTask,
	type BpmnElement,
} from './bpmnTypeGuards';
import type { PropertyRenderDeps, SharedCollectionRenderers } from './propertyRenderingTypes';
import { validateRetryCycle, validateTimerValue } from './validators';

function getCurrentDefaultFlowId(defaultValue: unknown): string {
	if (typeof defaultValue === 'string') {
		return defaultValue;
	}

	if (defaultValue && typeof defaultValue === 'object') {
		return (defaultValue as { id?: string }).id || '';
	}

	return '';
}

function renderGatewayProperties(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	businessObject: Record<string, unknown>,
): void {
	if (!isGateway(selectedElement)) {
		return;
	}

	const { ui } = deps;
	const gatewayGroup = ui.createGroup('Gateway');
	const currentDefault = getCurrentDefaultFlowId(businessObject.default);
	const outgoingFlows = (businessObject.outgoing as Array<{ id: string; name?: string }> || []);
	const flowOptions = outgoingFlows.map((flow) => ({ value: flow.id, label: flow.name ? `${flow.name} (${flow.id})` : flow.id }));
	gatewayGroup.appendChild(ui.createField('Default Flow', ui.createReferenceSelect(flowOptions, currentDefault, (value) => {
		const targetFlow = value.trim();
		if (targetFlow) {
			const flowElement = deps.elementRegistry.get(targetFlow);
			if (flowElement) {
				deps.modeling.updateProperties(selectedElement, { default: flowElement.businessObject });
			}
		} else {
			deps.modeling.updateProperties(selectedElement, { default: undefined });
		}
		deps.queueMetadataSave();
	}, 'Select a sequence flow...')));
	properties.appendChild(gatewayGroup);
}

function renderAsyncProperties(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	if (isFlowNode(selectedElement) && !isUserTask(selectedElement) && !isServiceTask(selectedElement) && !isSendTask(selectedElement) && !isReceiveTask(selectedElement) && !isManualTask(selectedElement)) {
		const asyncGroup = ui.createGroup('Async');
		asyncGroup.appendChild(ui.createField('Async', ui.createCheckbox(elementState.activitiAttributes.async === 'true', (checked) => deps.actions.updateFlowableAttribute('async', checked)), true));
		asyncGroup.appendChild(ui.createField('Exclusive', ui.createCheckbox(elementState.activitiAttributes.exclusive === 'true', (checked) => deps.actions.updateFlowableAttribute('exclusive', checked)), true));
		asyncGroup.appendChild(ui.createField('Failed Job Retry', ui.createTextInput(elementState.failedJobRetryTimeCycle, (value) => deps.actions.updateFailedJobRetryTimeCycle(value), 'e.g. R3/PT10M', validateRetryCycle)));
		properties.appendChild(asyncGroup);
	}

	if (isServiceTask(selectedElement) || isSendTask(selectedElement) || isReceiveTask(selectedElement) || isManualTask(selectedElement) || isUserTask(selectedElement)) {
		const retryGroup = ui.createGroup('Failed Job Retry');
		retryGroup.appendChild(ui.createField('Retry Time Cycle', ui.createTextInput(elementState.failedJobRetryTimeCycle, (value) => deps.actions.updateFailedJobRetryTimeCycle(value), 'e.g. R3/PT10M', validateRetryCycle)));
		properties.appendChild(retryGroup);
	}
}

function renderTextAnnotationProperties(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	businessObject: Record<string, unknown>,
): void {
	if (!isTextAnnotation(selectedElement)) {
		return;
	}

	const { ui } = deps;
	const annotationGroup = ui.createGroup('Text Annotation');
	const currentText = typeof businessObject.text === 'string' ? businessObject.text : '';
	annotationGroup.appendChild(ui.createField('Text', ui.createTextArea(currentText, (value) => {
		deps.modeling.updateProperties(selectedElement, { text: value });
		deps.queueMetadataSave();
	})));
	properties.appendChild(annotationGroup);
}

function renderEventDefinitionProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
	businessObject: Record<string, unknown>,
): void {
	if (!isEventElement(selectedElement)) {
		return;
	}

	const { ui } = deps;
	const eventDefinitionType = getEventDefinitionType(selectedElement);
	if (eventDefinitionType === 'bpmn:TimerEventDefinition') {
		const timerGroup = ui.createGroup('Timer Definition');
		const timerDefinition = elementState.timerDefinition || { type: 'timeDuration' as const, value: '' };
		timerGroup.appendChild(ui.createField('Timer Type', ui.createSelect(renderers.renderTimerTypeOptions(), timerDefinition.type, (value) => deps.actions.updateTimerDefinition({ type: value as typeof timerDefinition.type }))));
		timerGroup.appendChild(ui.createField('Value', ui.createTextInput(timerDefinition.value, (value) => deps.actions.updateTimerDefinition({ value }), 'e.g. PT5M, 2026-12-31T23:59, R3/PT10M', validateTimerValue)));
		properties.appendChild(timerGroup);
	}

	if (eventDefinitionType === 'bpmn:ErrorEventDefinition') {
		const errorGroup = ui.createGroup('Error Definition');
		errorGroup.appendChild(ui.createField('Error Reference', ui.createTextInput(elementState.errorRef, (value) => deps.actions.updateErrorRef(value))));
		properties.appendChild(errorGroup);
	}

	if (eventDefinitionType === 'bpmn:SignalEventDefinition') {
		const signalGroup = ui.createGroup('Signal Definition');
		const signalOptions = deps.getFlowableState().signalDefinitions.map((signal) => ({ value: signal.id, label: signal.name ? `${signal.name} (${signal.id})` : signal.id }));
		signalGroup.appendChild(ui.createField('Signal Reference', ui.createReferenceSelect(signalOptions, elementState.signalRef, (value) => deps.actions.updateSignalRef(value), 'Select a signal...')));
		properties.appendChild(signalGroup);
	}

	if (eventDefinitionType === 'bpmn:MessageEventDefinition') {
		const messageGroup = ui.createGroup('Message Definition');
		const messageOptions = deps.getFlowableState().messageDefinitions.map((message) => ({ value: message.id, label: message.name ? `${message.name} (${message.id})` : message.id }));
		messageGroup.appendChild(ui.createField('Message Reference', ui.createReferenceSelect(messageOptions, elementState.messageRef, (value) => deps.actions.updateMessageRef(value), 'Select a message...')));
		properties.appendChild(messageGroup);
	}

	if (eventDefinitionType === 'bpmn:TerminateEventDefinition') {
		const terminateGroup = ui.createGroup('Terminate End Event');
		terminateGroup.appendChild(ui.createField('Terminate All', ui.createCheckbox(elementState.terminateAll === 'true', (checked) => deps.actions.updateTerminateAll(checked)), true));
		properties.appendChild(terminateGroup);
	}

	if (eventDefinitionType === 'bpmn:CompensateEventDefinition') {
		const compensateGroup = ui.createGroup('Compensate Event');
		compensateGroup.appendChild(ui.createField('Activity Reference', ui.createTextInput(elementState.compensateActivityRef, (value) => deps.actions.updateCompensateActivityRef(value))));
		properties.appendChild(compensateGroup);
	}

	if (eventDefinitionType === 'bpmn:CancelEventDefinition') {
		const cancelGroup = ui.createGroup('Cancel Event');
		const info = ui.createTextInput('Cancel Event Definition', () => {});
		info.readOnly = true;
		cancelGroup.appendChild(ui.createField('Type', info));
		properties.appendChild(cancelGroup);
	}

	if (isBoundaryEvent(selectedElement)) {
		const boundaryGroup = ui.createGroup('Boundary Event');
		const cancelActivity = businessObject.cancelActivity !== false;
		boundaryGroup.appendChild(ui.createField('Cancel Activity', ui.createCheckbox(cancelActivity, (checked) => {
			deps.modeling.updateProperties(selectedElement, { cancelActivity: checked });
			deps.queueMetadataSave();
		}), true));
		properties.appendChild(boundaryGroup);
	}
}

export function renderEventAndMiscProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	const businessObject = getBusinessObject(selectedElement);

	renderEventDefinitionProperties(deps, renderers, properties, selectedElement, elementState, businessObject as Record<string, unknown>);

	if (isSequenceFlow(selectedElement)) {
		const flowGroup = ui.createGroup('Sequence Flow');
		flowGroup.appendChild(ui.createField('Condition Expression', ui.createTextArea(elementState.conditionExpression, (value) => deps.actions.updateConditionExpression(value), 'e.g. ${approved == true}')));
		flowGroup.appendChild(ui.createField('Skip Expression', ui.createTextInput(elementState.activitiAttributes.skipExpression || '', (value) => deps.actions.updateFlowableAttribute('skipExpression', value), 'e.g. ${skip}')));
		properties.appendChild(flowGroup);
	}

	renderGatewayProperties(deps, properties, selectedElement, businessObject as Record<string, unknown>);
	renderAsyncProperties(deps, properties, selectedElement, elementState);
	renderTextAnnotationProperties(deps, properties, selectedElement, businessObject as Record<string, unknown>);

	const executionListenersGroup = ui.createGroup('Execution Listeners');
	renderers.renderListeners(executionListenersGroup, elementState.executionListeners, 'execution');
	properties.appendChild(executionListenersGroup);
}