import type { Element as XmlElement } from '@xmldom/xmldom';
import type {
	FlowableDataObject,
	FlowableEventListener,
	FlowableExceptionMap,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableLocalization,
	FlowableMessageDefinition,
	FlowableSignalDefinition,
} from '../types';
import { ACTIVITI_NAMESPACE, BPMN_MODEL_NAMESPACE } from './constants';
import { createElementFromFragment } from './managedCollections';
import {
	detachNode,
	escapeXml,
	findDirectChild,
	getElementChildren,
	getLocalName,
	getNodeDocument,
	insertBeforeNode,
	isActivitiElement,
	parseXmlFragment,
	removeActivitiAttribute,
	replaceNode,
	setActivitiAttribute,
	setTextContentPreservingComments,
} from './xmlUtils';

export function setOptionalAttribute(element: XmlElement, name: string, value: string | undefined): void {
	if (value !== undefined && value !== '') {
		element.setAttribute(name, value);
	} else {
		element.removeAttribute(name);
	}
}

function isFieldValueElement(element: XmlElement): boolean {
	const localName = getLocalName(element);
	return localName === 'string' || localName === 'expression';
}

export function patchFieldExtensionNode(node: XmlElement, field: FlowableFieldExtension, namespaces: Record<string, string>): void {
	node.setAttribute('name', field.name);
	const desiredTagName = field.valueType === 'expression' ? 'activiti:expression' : 'activiti:string';
	const valueElements = getElementChildren(node).filter(isFieldValueElement);
	let valueNode = valueElements[0];

	for (const extraValueNode of valueElements.slice(1)) {
		detachNode(extraValueNode);
	}

	if (valueNode?.nodeName !== desiredTagName) {
		const replacement = createElementFromFragment(node, `<${desiredTagName}/>`, namespaces);
		if (valueNode) {
			replaceNode(valueNode, replacement);
		} else {
			const firstElementChild = getElementChildren(node)[0];
			if (firstElementChild) {
				insertBeforeNode(node, replacement, firstElementChild);
			} else {
				node.appendChild(replacement);
			}
		}
		valueNode = replacement;
	}

	setTextContentPreservingComments(valueNode, field.value);
}

export function patchListenerNode(node: XmlElement, listener: FlowableListener): void {
	node.setAttribute('event', listener.event);
	node.removeAttribute('class');
	node.removeAttribute('expression');
	node.removeAttribute('delegateExpression');
	removeActivitiAttribute(node, 'class');
	removeActivitiAttribute(node, 'expression');
	removeActivitiAttribute(node, 'delegateExpression');
	setActivitiAttribute(node, listener.implementationType, listener.implementation);
}

export function patchFormPropertyNode(node: XmlElement, formProperty: FlowableFormProperty): void {
	node.setAttribute('id', formProperty.id);
	node.setAttribute('name', formProperty.name);
	node.setAttribute('type', formProperty.type);
	node.setAttribute('required', String(formProperty.required));
	node.setAttribute('readable', String(formProperty.readable));
	node.setAttribute('writable', String(formProperty.writable));
	node.setAttribute('default', formProperty.defaultValue);
}

export function patchIoParameterNode(node: XmlElement, parameter: FlowableIOParameter): void {
	setOptionalAttribute(node, 'source', parameter.source);
	setOptionalAttribute(node, 'sourceExpression', parameter.sourceExpression);
	node.setAttribute('target', parameter.target);
}

export function patchExceptionMapNode(node: XmlElement, exceptionMap: FlowableExceptionMap): void {
	setOptionalAttribute(node, 'errorCode', exceptionMap.errorCode);
	if (exceptionMap.includeChildExceptions) {
		node.setAttribute('includeChildExceptions', 'true');
	} else {
		node.removeAttribute('includeChildExceptions');
	}
	setTextContentPreservingComments(node, exceptionMap.className);
}

export function patchProcessEventListenerNode(node: XmlElement, listener: FlowableEventListener): void {
	setOptionalAttribute(node, 'events', listener.events);
	setOptionalAttribute(node, 'entityType', listener.entityType);
	node.removeAttribute('class');
	node.removeAttribute('delegateExpression');
	removeActivitiAttribute(node, 'class');
	removeActivitiAttribute(node, 'delegateExpression');
	node.removeAttribute('signalName');
	node.removeAttribute('messageName');
	node.removeAttribute('errorCode');
	node.removeAttribute('throwGlobalEvent');

	switch (listener.implementationType) {
		case 'class':
			node.setAttribute('class', listener.implementation);
			break;
		case 'delegateExpression':
			node.setAttribute('delegateExpression', listener.implementation);
			break;
		case 'throwSignalEvent':
			node.setAttribute('signalName', listener.implementation);
			break;
		case 'throwGlobalSignalEvent':
			node.setAttribute('signalName', listener.implementation);
			node.setAttribute('throwGlobalEvent', 'true');
			break;
		case 'throwMessageEvent':
			node.setAttribute('messageName', listener.implementation);
			break;
		case 'throwErrorEvent':
			node.setAttribute('errorCode', listener.implementation);
			break;
	}
}

export function patchLocalizationNode(node: XmlElement, localization: FlowableLocalization): void {
	node.setAttribute('locale', localization.locale);
	setOptionalAttribute(node, 'name', localization.name);

	const documentation = findDirectChild(node, 'documentation');
	let normalizedDocumentation = documentation;
	if (documentation && (documentation.nodeName !== 'activiti:documentation' || documentation.namespaceURI !== ACTIVITI_NAMESPACE)) {
		normalizedDocumentation = getNodeDocument(node).createElementNS(ACTIVITI_NAMESPACE, 'activiti:documentation');
		while (documentation.firstChild) {
			normalizedDocumentation.appendChild(documentation.firstChild);
		}
		replaceNode(documentation, normalizedDocumentation);
	}

	if (localization.description) {
		const documentationNode = normalizedDocumentation || getNodeDocument(node).createElementNS(ACTIVITI_NAMESPACE, 'activiti:documentation');
		setTextContentPreservingComments(documentationNode, localization.description);
		if (!normalizedDocumentation) {
			node.appendChild(documentationNode);
		}
	} else if (normalizedDocumentation) {
		detachNode(normalizedDocumentation);
	}
}

export function patchSignalDefinitionNode(node: XmlElement, signal: FlowableSignalDefinition): void {
	node.setAttribute('id', signal.id);
	node.setAttribute('name', signal.name);
	if (signal.scope) {
		setActivitiAttribute(node, 'scope', signal.scope);
	} else {
		removeActivitiAttribute(node, 'scope');
	}
}

export function patchMessageDefinitionNode(node: XmlElement, message: FlowableMessageDefinition): void {
	node.setAttribute('id', message.id);
	node.setAttribute('name', message.name);
}

export function patchDataObjectNode(node: XmlElement, dataObject: FlowableDataObject, namespaces: Record<string, string>): void {
	node.setAttribute('id', dataObject.id);
	node.setAttribute('name', dataObject.name);
	setOptionalAttribute(node, 'itemSubjectRef', dataObject.itemSubjectRef);

	let extensionElements = findDirectChild(node, 'extensionElements');
	const valueElement = extensionElements ? getElementChildren(extensionElements).find((child) => isActivitiElement(child, 'value')) : undefined;

	if (dataObject.defaultValue) {
		if (!extensionElements) {
			extensionElements = getNodeDocument(node).createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
			node.appendChild(extensionElements);
		}
		let valueNode = valueElement;
		if (!valueNode) {
			const fragments = parseXmlFragment(`<activiti:value>${escapeXml(dataObject.defaultValue)}</activiti:value>`, namespaces);
			valueNode = getNodeDocument(node).importNode(fragments[0], true) as XmlElement;
			extensionElements.appendChild(valueNode);
		}
		setTextContentPreservingComments(valueNode, dataObject.defaultValue);
	} else if (valueElement && extensionElements) {
		detachNode(valueElement);
		if (!Array.from(extensionElements.childNodes).some((child) => child.nodeType !== child.TEXT_NODE || (child.textContent || '').trim().length > 0)) {
			detachNode(extensionElements);
		}
	}
}