import type { Element as XmlElement } from '@xmldom/xmldom';
import {
	buildFieldExtensionNode,
	buildFormPropertyNode,
	buildIOParameterNode,
	buildListenerNode,
	buildMultiInstanceNode,
} from './xmlBuilders';
import { BPMN_MODEL_NAMESPACE, XSI_NAMESPACE } from './constants';
import {
	appendPreservedExtensionElements,
	createElementFromFragment,
	ensureExtensionElements,
	hasMeaningfulChildren,
	reconcileManagedCollection,
} from './managedCollections';
import {
	patchExceptionMapNode,
	patchFieldExtensionNode,
	patchFormPropertyNode,
	patchIoParameterNode,
	patchListenerNode,
	setOptionalAttribute,
} from './patchingHelpers';
import { type FlowableElementState, FLOWABLE_ATTRIBUTE_KEYS } from '../types';
import {
	detachNode,
	escapeXml,
	findDirectChild,
	getElementChildren,
	getNodeDocument,
	isActivitiElement,
	removeActivitiAttribute,
	replaceNode,
	setActivitiAttribute,
	setTextContentPreservingComments,
} from './xmlUtils';

function applyEditableActivitiAttributes(element: XmlElement, elementState: FlowableElementState): void {
	for (const key of FLOWABLE_ATTRIBUTE_KEYS) {
		element.removeAttribute(key);
		const value = elementState.activitiAttributes[key]?.trim();
		if (value) {
			setActivitiAttribute(element, key, value);
			continue;
		}
		removeActivitiAttribute(element, key);
	}
}

function applyPreservedAttributes(element: XmlElement, elementState: FlowableElementState): void {
	for (const [attributeName, value] of Object.entries(elementState.preservedAttributes)) {
		if (!element.hasAttribute(attributeName)) {
			element.setAttribute(attributeName, value);
		}
	}
}

function countManagedExtensionItems(elementState: FlowableElementState): number {
	return elementState.fieldExtensions.length
		+ elementState.inputParameters.length
		+ elementState.outputParameters.length
		+ elementState.taskListeners.length
		+ elementState.executionListeners.length
		+ elementState.formProperties.length
		+ elementState.exceptionMaps.length
		+ elementState.preservedExtensionElements.length
		+ (elementState.failedJobRetryTimeCycle ? 1 : 0);
}

function buildRetryItems(elementState: FlowableElementState): Array<{ xmlIdentity: string; value: string }> {
	if (!elementState.failedJobRetryTimeCycle) {
		return [];
	}
	return [{
		xmlIdentity: 'failedJobRetryTimeCycle:http://activiti.org/bpmn:failedJobRetryTimeCycle:0',
		value: elementState.failedJobRetryTimeCycle,
	}];
}

function buildExceptionMapFragment(item: FlowableElementState['exceptionMaps'][number]): string {
	const errorCodeAttribute = item.errorCode ? ` errorCode="${escapeXml(item.errorCode)}"` : '';
	const includeChildAttribute = item.includeChildExceptions ? ' includeChildExceptions="true"' : '';
	return `<activiti:mapException${errorCodeAttribute}${includeChildAttribute}>${escapeXml(item.className)}</activiti:mapException>`;
}

function reconcileExtensionElements(
	extensionElements: XmlElement,
	elementState: FlowableElementState,
	namespaces: Record<string, string>,
): void {
	reconcileManagedCollection(extensionElements, elementState.fieldExtensions, {
		isManagedNode: (node) => isActivitiElement(node, 'field'),
		createNode: (item) => createElementFromFragment(extensionElements, buildFieldExtensionNode(item), namespaces),
		patchNode: (node, item) => patchFieldExtensionNode(node, item, namespaces),
		matchFallback: (node, item) => node.getAttribute('name') === item.name,
	});
	reconcileManagedCollection(extensionElements, elementState.inputParameters, {
		isManagedNode: (node) => isActivitiElement(node, 'in'),
		createNode: (item) => createElementFromFragment(extensionElements, buildIOParameterNode('activiti:in', item), namespaces),
		patchNode: patchIoParameterNode,
		matchFallback: (node, item) => node.getAttribute('target') === item.target,
	});
	reconcileManagedCollection(extensionElements, elementState.outputParameters, {
		isManagedNode: (node) => isActivitiElement(node, 'out'),
		createNode: (item) => createElementFromFragment(extensionElements, buildIOParameterNode('activiti:out', item), namespaces),
		patchNode: patchIoParameterNode,
		matchFallback: (node, item) => node.getAttribute('target') === item.target,
	});
	reconcileManagedCollection(extensionElements, elementState.taskListeners, {
		isManagedNode: (node) => isActivitiElement(node, 'taskListener'),
		createNode: (item) => createElementFromFragment(extensionElements, buildListenerNode('activiti:taskListener', item), namespaces),
		patchNode: patchListenerNode,
		matchFallback: (node, item) => node.getAttribute('event') === item.event,
	});
	reconcileManagedCollection(extensionElements, elementState.executionListeners, {
		isManagedNode: (node) => isActivitiElement(node, 'executionListener'),
		createNode: (item) => createElementFromFragment(extensionElements, buildListenerNode('activiti:executionListener', item), namespaces),
		patchNode: patchListenerNode,
		matchFallback: (node, item) => node.getAttribute('event') === item.event,
	});
	reconcileManagedCollection(extensionElements, elementState.formProperties, {
		isManagedNode: (node) => isActivitiElement(node, 'formProperty'),
		createNode: (item) => createElementFromFragment(extensionElements, buildFormPropertyNode(item), namespaces),
		patchNode: patchFormPropertyNode,
		matchFallback: (node, item) => node.getAttribute('id') === item.id,
	});
	reconcileManagedCollection(extensionElements, buildRetryItems(elementState), {
		isManagedNode: (node) => isActivitiElement(node, 'failedJobRetryTimeCycle'),
		createNode: (item) => createElementFromFragment(
			extensionElements,
			`<activiti:failedJobRetryTimeCycle>${escapeXml(item.value)}</activiti:failedJobRetryTimeCycle>`,
			namespaces,
		),
		patchNode: (node, item) => setTextContentPreservingComments(node, item.value),
	});
	reconcileManagedCollection(extensionElements, elementState.exceptionMaps, {
		isManagedNode: (node) => isActivitiElement(node, 'mapException'),
		createNode: (item) => createElementFromFragment(extensionElements, buildExceptionMapFragment(item), namespaces),
		patchNode: patchExceptionMapNode,
		matchFallback: (node, item) => node.textContent === item.className,
	});
	appendPreservedExtensionElements(extensionElements, elementState.preservedExtensionElements, namespaces);
}

function syncExtensionElements(
	element: XmlElement,
	elementState: FlowableElementState,
	namespaces: Record<string, string>,
): void {
	let extensionElements = findDirectChild(element, 'extensionElements');
	if (countManagedExtensionItems(elementState) > 0) {
		extensionElements = ensureExtensionElements(element);
	}
	if (!extensionElements) {
		return;
	}
	reconcileExtensionElements(extensionElements, elementState, namespaces);
	if (!hasMeaningfulChildren(extensionElements)) {
		detachNode(extensionElements);
	}
}

function prependChild(parent: XmlElement, child: XmlElement): void {
	if (parent.firstChild) {
		parent.insertBefore(child, parent.firstChild);
		return;
	}
	parent.appendChild(child);
}

function syncDocumentation(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
): void {
	const existingDocumentation = findDirectChild(element, 'documentation');
	if (!elementState.documentation) {
		if (existingDocumentation) {
			detachNode(existingDocumentation);
		}
		return;
	}
	const documentation = existingDocumentation || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'documentation');
	const documentationChanged = elementState.documentation !== (originalElementState?.documentation || '');
	if (documentationChanged || !existingDocumentation) {
		setTextContentPreservingComments(documentation, elementState.documentation);
	}
	if (!existingDocumentation) {
		prependChild(element, documentation);
	}
}

function syncConditionExpression(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
): void {
	const existingCondition = findDirectChild(element, 'conditionExpression');
	if (!elementState.conditionExpression) {
		if (existingCondition) {
			detachNode(existingCondition);
		}
		return;
	}
	const condition = existingCondition || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'conditionExpression');
	condition.setAttributeNS(XSI_NAMESPACE, 'xsi:type', 'tFormalExpression');
	const conditionChanged = elementState.conditionExpression !== (originalElementState?.conditionExpression || '');
	if (conditionChanged || !existingCondition) {
		setTextContentPreservingComments(condition, elementState.conditionExpression);
	}
	if (!existingCondition) {
		element.appendChild(condition);
	}
}

function syncScript(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
): void {
	const existingScript = findDirectChild(element, 'script');
	if (!elementState.script) {
		if (existingScript) {
			detachNode(existingScript);
		}
		return;
	}
	const script = existingScript || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'script');
	const scriptChanged = elementState.script !== (originalElementState?.script || '');
	if (scriptChanged || !existingScript) {
		setTextContentPreservingComments(script, elementState.script);
	}
	if (!existingScript) {
		element.appendChild(script);
	}
}

function syncMultiInstance(element: XmlElement, elementState: FlowableElementState, namespaces: Record<string, string>): void {
	const existingMultiInstance = findDirectChild(element, 'multiInstanceLoopCharacteristics');
	if (elementState.multiInstance) {
		const replacement = createElementFromFragment(element, buildMultiInstanceNode(elementState.multiInstance), namespaces);
		if (existingMultiInstance) {
			replaceNode(existingMultiInstance, replacement);
			return;
		}
		element.appendChild(replacement);
		return;
	}
	if (existingMultiInstance && elementState.multiInstance === null) {
		detachNode(existingMultiInstance);
	}
}

function syncTimerDefinition(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
): void {
	const existingTimerDefinition = findDirectChild(element, 'timerEventDefinition');
	if (!elementState.timerDefinition?.value) {
		if (existingTimerDefinition && originalElementState?.timerDefinition) {
			detachNode(existingTimerDefinition);
		}
		return;
	}
	const timerDefinition = existingTimerDefinition || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'timerEventDefinition');
	for (const child of getElementChildren(timerDefinition)) {
		detachNode(child);
	}
	const timerChild = getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, elementState.timerDefinition.type);
	setTextContentPreservingComments(timerChild, elementState.timerDefinition.value);
	timerDefinition.appendChild(timerChild);
	if (!existingTimerDefinition) {
		element.appendChild(timerDefinition);
	}
}

function syncEventDefinitionAttributes(element: XmlElement, elementState: FlowableElementState): void {
	const existingErrorDefinition = findDirectChild(element, 'errorEventDefinition');
	if (existingErrorDefinition) {
		setOptionalAttribute(existingErrorDefinition, 'errorRef', elementState.errorRef);
	}
	const existingSignalDefinition = findDirectChild(element, 'signalEventDefinition');
	if (existingSignalDefinition) {
		setOptionalAttribute(existingSignalDefinition, 'signalRef', elementState.signalRef);
	}
	const existingMessageDefinition = findDirectChild(element, 'messageEventDefinition');
	if (existingMessageDefinition) {
		setOptionalAttribute(existingMessageDefinition, 'messageRef', elementState.messageRef);
	}
	const existingTerminateDefinition = findDirectChild(element, 'terminateEventDefinition');
	if (existingTerminateDefinition) {
		if (elementState.terminateAll === 'true') {
			setActivitiAttribute(existingTerminateDefinition, 'terminateAll', 'true');
		} else {
			removeActivitiAttribute(existingTerminateDefinition, 'terminateAll');
		}
	}
	const existingCompensateDefinition = findDirectChild(element, 'compensateEventDefinition');
	if (existingCompensateDefinition) {
		setOptionalAttribute(existingCompensateDefinition, 'activityRef', elementState.compensateActivityRef);
	}
}

function syncCompensationAttribute(element: XmlElement, elementState: FlowableElementState): void {
	if (elementState.isForCompensation === 'true') {
		element.setAttribute('isForCompensation', 'true');
		return;
	}
	element.removeAttribute('isForCompensation');
}

export function applyElementOverlay(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
	namespaces: Record<string, string>,
): void {
	applyEditableActivitiAttributes(element, elementState);
	applyPreservedAttributes(element, elementState);
	syncExtensionElements(element, elementState, namespaces);
	syncDocumentation(element, elementState, originalElementState);
	syncConditionExpression(element, elementState, originalElementState);
	syncScript(element, elementState, originalElementState);
	syncMultiInstance(element, elementState, namespaces);
	syncTimerDefinition(element, elementState, originalElementState);
	syncEventDefinitionAttributes(element, elementState);
	syncCompensationAttribute(element, elementState);
}
