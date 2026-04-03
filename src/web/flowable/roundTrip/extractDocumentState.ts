import { parseXmlDocument } from '../xmlParser';
import type { Element as XmlElement } from '@xmldom/xmldom';
import { ACTIVITI_NAMESPACE, XSI_NAMESPACE } from './constants';
import {
	cloneFlowableState,
	createEmptyFlowableState,
	type FlowableDocumentState,
} from '../types';
import {
	buildXmlIdentity,
	getActivitiAttribute,
	getElementChildren,
	getElementsByLocalName,
	getLocalName,
} from './xmlUtils';
import { extractElementState } from './elementStateExtraction';
import { extractProcessLevelState } from './processStateExtraction';

const KNOWN_QNAME_PREFIX_NAMESPACES: Record<string, string> = {
	xsd: 'http://www.w3.org/2001/XMLSchema',
};

function getQNamePrefix(value: string): string {
	const trimmedValue = value.trim();
	const separatorIndex = trimmedValue.indexOf(':');
	if (separatorIndex <= 0) {
		return '';
	}
	return trimmedValue.slice(0, separatorIndex);
}

export function ensureActivitiNamespace(documentState: FlowableDocumentState): void {
	const needsActivitiNamespace = Object.values(documentState.elements).some((elementState) => {
		return (
			Object.keys(elementState.activitiAttributes).length > 0 ||
			elementState.fieldExtensions.length > 0 ||
			elementState.taskListeners.length > 0 ||
			elementState.executionListeners.length > 0 ||
			elementState.formProperties.length > 0 ||
			elementState.inputParameters.length > 0 ||
			elementState.outputParameters.length > 0 ||
			Boolean(elementState.failedJobRetryTimeCycle) ||
			elementState.exceptionMaps.length > 0 ||
			(elementState.multiInstance !== null && (elementState.multiInstance.collection || elementState.multiInstance.elementVariable))
		);
	}) || documentState.signalDefinitions.some((signal) => Boolean(signal.scope))
		|| documentState.eventListeners.length > 0
		|| documentState.localizations.length > 0
		|| documentState.dataObjects.some((dataObject) => Boolean(dataObject.defaultValue));

	if (needsActivitiNamespace && !documentState.namespaces.activiti) {
		documentState.namespaces.activiti = ACTIVITI_NAMESPACE;
	}

	const needsXsiNamespace = Object.values(documentState.elements).some((elementState) => Boolean(elementState.conditionExpression));
	if (needsXsiNamespace && !documentState.namespaces.xsi) {
		documentState.namespaces.xsi = XSI_NAMESPACE;
	}

	for (const dataObject of documentState.dataObjects) {
		const prefix = getQNamePrefix(dataObject.itemSubjectRef);
		if (!prefix || documentState.namespaces[prefix]) {
			continue;
		}

		const namespaceUri = KNOWN_QNAME_PREFIX_NAMESPACES[prefix];
		if (namespaceUri) {
			documentState.namespaces[prefix] = namespaceUri;
		}
	}
}

function extractDefinitionLevelState(definitions: XmlElement, documentState: FlowableDocumentState): void {
	for (const attribute of Array.from(definitions.attributes)) {
		if (attribute.name.startsWith('xmlns:')) {
			documentState.namespaces[attribute.name.slice(6)] = attribute.value;
		}
	}

	documentState.targetNamespace = definitions.getAttribute('targetNamespace') || '';

	for (const child of getElementChildren(definitions)) {
		const localName = getLocalName(child);
		if (localName === 'signal') {
			const id = child.getAttribute('id');
			if (id) {
				documentState.signalDefinitions.push({
					id,
					name: child.getAttribute('name') || '',
					scope: getActivitiAttribute(child, 'scope') || '',
					xmlIdentity: buildXmlIdentity('signalDefinition', child),
				});
			}
			continue;
		}

		if (localName === 'message') {
			const id = child.getAttribute('id');
			if (id) {
				documentState.messageDefinitions.push({
					id,
					name: child.getAttribute('name') || '',
					xmlIdentity: buildXmlIdentity('messageDefinition', child),
				});
			}
		}
	}
}


export function extractFlowableDocumentState(xml: string): FlowableDocumentState {
	const documentState = createEmptyFlowableState();
	const document = parseXmlDocument(xml);
	const definitions = document.documentElement;
	if (!definitions) {
		return documentState;
	}

	extractDefinitionLevelState(definitions, documentState);

	for (const processElement of getElementsByLocalName(document, 'process')) {
		extractProcessLevelState(processElement, documentState);
	}

	for (const node of getElementsByLocalName(document, '*')) {
		extractElementState(node, documentState);
	}

	ensureActivitiNamespace(documentState);
	return cloneFlowableState(documentState);
}