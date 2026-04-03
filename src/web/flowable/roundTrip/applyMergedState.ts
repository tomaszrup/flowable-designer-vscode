import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { buildEventListenerNode, buildLocalizationNode } from './xmlBuilders';
import { applyElementOverlay } from './elementOverlay';

import { processPreFlowChildNames, XMLNS_NAMESPACE } from './constants';
import {
	appendPreservedExtensionElements,
	createElementFromFragment,
	ensureExtensionElements,
	hasMeaningfulChildren,
	reconcileManagedCollection,
} from './managedCollections';
import {
	patchDataObjectNode,
	patchLocalizationNode,
	patchMessageDefinitionNode,
	patchProcessEventListenerNode,
	patchSignalDefinitionNode,
} from './patchingHelpers';
import { buildIdMap } from './structuralIndexing';
import {
	reconcileStructuralChildren,
	syncDocumentLexicalNodes,
	syncStructuralAttributes,
} from './structuralMerge';
import type { FlowableDocumentState } from '../types';
import {
	escapeXml,
	detachNode,
	findDirectChild,
	getElementChildren,
	getElementsByLocalName,
	getLocalName,
	isActivitiElement,
} from './xmlUtils';

interface ApplyMergedStateParams {
	originalDocument: XmlDocument;
	serializedDocument: XmlDocument;
	originalDefinitions: XmlElement;
	serializedDefinitions: XmlElement;
	originalState: FlowableDocumentState;
	mergedState: FlowableDocumentState;
}

function buildSignalDefinitionXml(id: string, name: string, scope: string): string {
	const scopeAttribute = scope ? ` activiti:scope="${escapeXml(scope)}"` : '';
	return `<signal id="${escapeXml(id)}" name="${escapeXml(name)}"${scopeAttribute}/>`;
}

function buildDataObjectXml(id: string, name: string, itemSubjectRef: string): string {
	const typeAttribute = itemSubjectRef ? ` itemSubjectRef="${escapeXml(itemSubjectRef)}"` : '';
	return `<dataObject id="${escapeXml(id)}" name="${escapeXml(name)}"${typeAttribute}/>`;
}

export function applyMergedStateToDocument({
	originalDocument,
	serializedDocument,
	originalDefinitions,
	serializedDefinitions,
	originalState,
	mergedState,
}: ApplyMergedStateParams): void {
	const structuralContext = {
		originalById: buildIdMap(originalDocument),
	};

	syncDocumentLexicalNodes(originalDocument, serializedDocument);
	syncStructuralAttributes(originalDefinitions, serializedDefinitions);
	reconcileStructuralChildren(originalDefinitions, serializedDefinitions, structuralContext);

	for (const [prefix, namespaceUri] of Object.entries(mergedState.namespaces)) {
		originalDefinitions.setAttributeNS(XMLNS_NAMESPACE, `xmlns:${prefix}`, namespaceUri);
	}

	if (mergedState.targetNamespace) {
		originalDefinitions.setAttribute('targetNamespace', mergedState.targetNamespace);
	}

	const currentElementsById = buildIdMap(originalDocument);
	for (const [id, elementState] of Object.entries(mergedState.elements)) {
		const element = currentElementsById.get(id);
		if (!element) {
			continue;
		}
		applyElementOverlay(element, elementState, originalState.elements[id], mergedState.namespaces);
	}

	reconcileManagedCollection(originalDefinitions, mergedState.signalDefinitions, {
		isManagedNode: (node) => getLocalName(node) === 'signal',
		createNode: (item) => createElementFromFragment(originalDefinitions, buildSignalDefinitionXml(item.id, item.name, item.scope), mergedState.namespaces),
		patchNode: patchSignalDefinitionNode,
		matchFallback: (node, item) => node.getAttribute('id') === item.id,
		insertBefore: (parent) => findDirectChild(parent, 'process') || findDirectChild(parent, 'collaboration') || null,
	});

	reconcileManagedCollection(originalDefinitions, mergedState.messageDefinitions, {
		isManagedNode: (node) => getLocalName(node) === 'message',
		createNode: (item) => createElementFromFragment(originalDefinitions, `<message id="${escapeXml(item.id)}" name="${escapeXml(item.name)}"/>`, mergedState.namespaces),
		patchNode: patchMessageDefinitionNode,
		matchFallback: (node, item) => node.getAttribute('id') === item.id,
		insertBefore: (parent) => findDirectChild(parent, 'process') || findDirectChild(parent, 'collaboration') || null,
	});

	const processElements = getElementsByLocalName(originalDocument, 'process');
	const singleProcessId = processElements.length === 1 ? (processElements[0]?.getAttribute('id') || '') : '';
	for (const processElement of processElements) {
		const processId = processElement.getAttribute('id') || '';
		const processDataObjects = mergedState.dataObjects.filter((item) => item.processId === processId || (!item.processId && singleProcessId === processId));
		reconcileManagedCollection(processElement, processDataObjects, {
			isManagedNode: (node) => getLocalName(node) === 'dataObject',
			createNode: (item) => createElementFromFragment(processElement, buildDataObjectXml(item.id, item.name, item.itemSubjectRef), mergedState.namespaces),
			patchNode: (node, item) => patchDataObjectNode(node, item, mergedState.namespaces),
			matchFallback: (node, item) => node.getAttribute('id') === item.id,
			insertBefore: () => getElementChildren(processElement).find((child) => {
				const localName = getLocalName(child);
				return localName !== 'dataObject' && !processPreFlowChildNames.has(localName);
			}) || null,
		});

		const processEventListeners = mergedState.eventListeners.filter((item) => item.processId === processId || (!item.processId && singleProcessId === processId));
		const processLocalizations = mergedState.localizations.filter((item) => item.processId === processId || (!item.processId && singleProcessId === processId));
		const processPreservedExtensionElements = mergedState.processExtensionElements.find((item) => item.processId === processId || (!item.processId && singleProcessId === processId))?.preservedExtensionElements || [];
		const needsProcessExtensionElements = processEventListeners.length > 0 || processLocalizations.length > 0 || processPreservedExtensionElements.length > 0;
		let processExtensionElements = findDirectChild(processElement, 'extensionElements');
		if (needsProcessExtensionElements) {
			processExtensionElements = processExtensionElements || ensureExtensionElements(processElement);
		}

		if (processExtensionElements) {
			const extensionTarget = processExtensionElements;
			reconcileManagedCollection(processExtensionElements, processEventListeners, {
				isManagedNode: (node) => isActivitiElement(node, 'eventListener'),
				createNode: (item) => createElementFromFragment(extensionTarget, buildEventListenerNode(item), mergedState.namespaces),
				patchNode: patchProcessEventListenerNode,
				matchFallback: (node, item) => node.getAttribute('events') === item.events && (node.getAttribute('class') || node.getAttribute('delegateExpression') || node.getAttribute('signalName') || node.getAttribute('messageName') || node.getAttribute('errorCode') || '') === item.implementation,
			});

			reconcileManagedCollection(processExtensionElements, processLocalizations, {
				isManagedNode: (node) => isActivitiElement(node, 'localization'),
				createNode: (item) => createElementFromFragment(extensionTarget, buildLocalizationNode(item), mergedState.namespaces),
				patchNode: patchLocalizationNode,
				matchFallback: (node, item) => node.getAttribute('locale') === item.locale,
			});

			appendPreservedExtensionElements(processExtensionElements, processPreservedExtensionElements, mergedState.namespaces);

			if (!hasMeaningfulChildren(processExtensionElements)) {
				detachNode(processExtensionElements);
			}
		}
	}
}