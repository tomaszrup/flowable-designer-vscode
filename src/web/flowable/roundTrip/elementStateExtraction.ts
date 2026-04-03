import type { Element as XmlElement } from '@xmldom/xmldom';
import {
	FLOWABLE_ATTRIBUTE_KEYS,
	type FlowableAttributeKey,
	type FlowableDocumentState,
	type FlowableElementState,
} from '../types';
import {
	buildXmlIdentity,
	findDirectChild,
	getActivitiAttribute,
	getElementChildren,
	isActivitiElement,
	serializer,
} from './xmlUtils';
import {
	parseFieldExtension,
	parseFormProperty,
	parseIOParameter,
	parseListener,
	parseMultiInstance,
	parseTimerDefinition,
} from './xmlParsers';
import { ACTIVITI_NAMESPACE } from './constants';

const editableActivitiAttributeKeys = new Set<FlowableAttributeKey>(FLOWABLE_ATTRIBUTE_KEYS);

function createElementState(id: string, type: string): FlowableElementState {
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

function extractEditableAttributes(node: XmlElement, elementState: FlowableElementState): void {
	for (const attribute of Array.from(node.attributes)) {
		if (attribute.name.startsWith('xmlns:') || attribute.name === 'id') {
			continue;
		}

		const attributeKey = attribute.localName as FlowableAttributeKey;
		const isManagedNamespacedAttribute = (attribute.namespaceURI || '') === ACTIVITI_NAMESPACE
			&& editableActivitiAttributeKeys.has(attributeKey);
		const isManagedLegacyAttribute = !attribute.name.includes(':')
			&& editableActivitiAttributeKeys.has(attribute.name as FlowableAttributeKey);

		if (isManagedNamespacedAttribute || isManagedLegacyAttribute) {
			elementState.activitiAttributes[isManagedLegacyAttribute ? attribute.name as FlowableAttributeKey : attributeKey] = attribute.value;
			continue;
		}

		if (attribute.name.includes(':')) {
			elementState.preservedAttributes[attribute.name] = attribute.value;
		}
	}
}

function extractManagedExtensionChild(child: XmlElement, elementState: FlowableElementState): boolean {
	if (isActivitiElement(child, 'field')) {
		elementState.fieldExtensions.push(parseFieldExtension(child));
		return true;
	}

	if (isActivitiElement(child, 'taskListener')) {
		elementState.taskListeners.push(parseListener(child));
		return true;
	}

	if (isActivitiElement(child, 'executionListener')) {
		elementState.executionListeners.push(parseListener(child));
		return true;
	}

	if (isActivitiElement(child, 'formProperty')) {
		elementState.formProperties.push(parseFormProperty(child));
		return true;
	}

	if (isActivitiElement(child, 'in')) {
		elementState.inputParameters.push(parseIOParameter(child));
		return true;
	}

	if (isActivitiElement(child, 'out')) {
		elementState.outputParameters.push(parseIOParameter(child));
		return true;
	}

	if (isActivitiElement(child, 'failedJobRetryTimeCycle')) {
		const retryElement = child as XmlElement;
		elementState.failedJobRetryTimeCycle = retryElement.textContent || '';
		return true;
	}

	if (isActivitiElement(child, 'mapException')) {
		const mapExceptionElement = child as XmlElement;
		const errorCode = mapExceptionElement.getAttribute('errorCode') || '';
		const className = mapExceptionElement.textContent || '';
		elementState.exceptionMaps.push({
			id: `exception-${errorCode}-${className}`,
			errorCode,
			className,
			includeChildExceptions: mapExceptionElement.getAttribute('includeChildExceptions') === 'true',
			xmlIdentity: buildXmlIdentity('exceptionMap', mapExceptionElement),
		});
		return true;
	}

	return false;
}

function extractExtensionElements(node: XmlElement, elementState: FlowableElementState): void {
	const extensionElements = findDirectChild(node, 'extensionElements');
	if (!extensionElements) {
		return;
	}

	for (const child of getElementChildren(extensionElements)) {
		if (isActivitiElement(child, 'eventListener') || isActivitiElement(child, 'localization')) {
			continue;
		}

		if (extractManagedExtensionChild(child, elementState)) {
			continue;
		}

		elementState.preservedExtensionElements.push(serializer.serializeToString(child));
	}
}

function extractDirectChildState(node: XmlElement, elementState: FlowableElementState): void {
	elementState.documentation = findDirectChild(node, 'documentation')?.textContent || '';
	elementState.conditionExpression = findDirectChild(node, 'conditionExpression')?.textContent || '';
	elementState.script = findDirectChild(node, 'script')?.textContent || '';

	const multiInstanceElement = findDirectChild(node, 'multiInstanceLoopCharacteristics');
	if (multiInstanceElement) {
		elementState.multiInstance = parseMultiInstance(multiInstanceElement);
	}

	const timerEventDefinitionElement = findDirectChild(node, 'timerEventDefinition');
	if (timerEventDefinitionElement) {
		elementState.timerDefinition = parseTimerDefinition(timerEventDefinitionElement);
	}

	elementState.errorRef = findDirectChild(node, 'errorEventDefinition')?.getAttribute('errorRef') || '';
	elementState.signalRef = findDirectChild(node, 'signalEventDefinition')?.getAttribute('signalRef') || '';
	elementState.messageRef = findDirectChild(node, 'messageEventDefinition')?.getAttribute('messageRef') || '';
	const terminateEventDefinitionElement = findDirectChild(node, 'terminateEventDefinition');
	elementState.terminateAll = terminateEventDefinitionElement ? getActivitiAttribute(terminateEventDefinitionElement, 'terminateAll') || '' : '';
	elementState.compensateActivityRef = findDirectChild(node, 'compensateEventDefinition')?.getAttribute('activityRef') || '';
	elementState.isForCompensation = node.getAttribute('isForCompensation') || '';
}

export function extractElementState(node: XmlElement, documentState: FlowableDocumentState): void {
	const id = node.getAttribute('id');
	if (!id) {
		return;
	}

	const elementState = createElementState(id, node.nodeName);
	extractEditableAttributes(node, elementState);
	extractExtensionElements(node, elementState);
	extractDirectChildState(node, elementState);
	documentState.elements[id] = elementState;
}