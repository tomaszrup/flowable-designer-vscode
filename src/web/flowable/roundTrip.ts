import { applyMergedStateToDocument } from './roundTrip/applyMergedState';
import { parseXmlDocument } from './xmlParser';
import { buildElementIdRenameMap, buildProcessIdRenameMap, remapProcessScopedItems } from './roundTrip/processMatching';
import { buildIdMap, collectNamespaceDeclarations } from './roundTrip/structuralIndexing';
import { didStructuralElementChildOrderChange } from './roundTrip/structuralMerge';

import {
	getStableCollectionKey,
	mergeElementState,
	mergePreservedExtensionElements,
	mergeSerializedCollectionState,
	mergeSerializedOverlayValue,
	mergeSerializedProcessExtensionStates,
	mergeSerializedValue,
} from './roundTrip/stateMerging';
import { serializeXmlDocument } from './roundTrip/xmlSerialization';
import {
	cloneFlowableState,
	type FlowableDocumentState,
} from './types';
import { ensureActivitiNamespace, extractFlowableDocumentState } from './roundTrip/extractDocumentState';
import { findDirectChild, getElementsByLocalName } from './roundTrip/xmlUtils';

export { extractFlowableDocumentState } from './roundTrip/extractDocumentState';

export type FlowableMergeOrigin = 'designer' | 'source';

export interface FlowableMergeOptions {
	origin?: FlowableMergeOrigin;
}

function mergeSerializedElementOverlayState(
	context: {
		mergedState: FlowableDocumentState;
		originalState: FlowableDocumentState;
		serializedState: FlowableDocumentState;
		originalElementsById: ReturnType<typeof buildIdMap>;
		serializedElementsById: ReturnType<typeof buildIdMap>;
	},
	originalElementId: string,
	nextId: string,
	preserveMissingExtensionContainers: boolean,
): void {
	const mergedElementState = context.mergedState.elements[nextId];
	const serializedElementState = context.serializedState.elements[nextId];
	if (!mergedElementState || !serializedElementState) {
		return;
	}

	const originalElement = context.originalElementsById.get(originalElementId);
	const serializedElement = context.serializedElementsById.get(nextId);
	const serializedStructuralOrderChanged = Boolean(
		originalElement
		&& serializedElement
		&& didStructuralElementChildOrderChange(originalElement, serializedElement),
	);

	mergedElementState.documentation = mergeSerializedOverlayValue(
		context.originalState.elements[originalElementId]?.documentation || '',
		serializedElementState.documentation,
		mergedElementState.documentation,
		serializedStructuralOrderChanged,
		(value) => value === '',
	);
	mergedElementState.conditionExpression = mergeSerializedOverlayValue(
		context.originalState.elements[originalElementId]?.conditionExpression || '',
		serializedElementState.conditionExpression,
		mergedElementState.conditionExpression,
		serializedStructuralOrderChanged,
		(value) => value === '',
	);
	mergedElementState.script = mergeSerializedOverlayValue(
		context.originalState.elements[originalElementId]?.script || '',
		serializedElementState.script,
		mergedElementState.script,
		serializedStructuralOrderChanged,
		(value) => value === '',
	);
	mergedElementState.multiInstance = mergeSerializedOverlayValue(
		context.originalState.elements[originalElementId]?.multiInstance || null,
		serializedElementState.multiInstance,
		mergedElementState.multiInstance,
		serializedStructuralOrderChanged,
		(value) => value === null,
	);
	mergedElementState.timerDefinition = mergeSerializedValue(
		context.originalState.elements[originalElementId]?.timerDefinition || null,
		serializedElementState.timerDefinition,
		mergedElementState.timerDefinition,
	);
	mergedElementState.preservedExtensionElements = mergePreservedExtensionElements(
		mergedElementState.preservedExtensionElements,
		serializedElementState.preservedExtensionElements,
		Boolean(serializedElement && findDirectChild(serializedElement, 'extensionElements')),
		preserveMissingExtensionContainers,
	);
}

function remapElementReferenceId(referenceId: string, elementIdRenameMap: Map<string, string>): string {
	if (!referenceId) {
		return referenceId;
	}
	return elementIdRenameMap.get(referenceId) || referenceId;
}

function remapElementStateReferences(
	elementState: FlowableDocumentState['elements'][string],
	elementIdRenameMap: Map<string, string>,
): FlowableDocumentState['elements'][string] {
	return {
		...elementState,
		compensateActivityRef: remapElementReferenceId(elementState.compensateActivityRef, elementIdRenameMap),
	};
}

export function mergeFlowableDocumentXml(
	serializedXml: string,
	originalXml: string,
	incomingState: FlowableDocumentState,
	options: FlowableMergeOptions = {},
): string {
	const preserveMissingExtensionContainers = options.origin !== 'source';
	const serializedState = extractFlowableDocumentState(serializedXml);
	const originalDocument = parseXmlDocument(originalXml);
	const serializedDocument = parseXmlDocument(serializedXml);
	const originalDefinitions = originalDocument.documentElement;
	const serializedDefinitions = serializedDocument.documentElement;

	if (!originalDefinitions || !serializedDefinitions) {
		return serializedXml;
	}

	const originalState = extractFlowableDocumentState(originalXml);
	const mergedState = cloneFlowableState(originalState);
	const serializedNamespaces = collectNamespaceDeclarations(serializedDefinitions);
	const processIdRenameMap = buildProcessIdRenameMap(originalDocument, serializedDocument);
	const elementIdRenameMap = buildElementIdRenameMap(originalDocument, serializedDocument);
	const originalElementsById = buildIdMap(originalDocument);
	const serializedElementsById = buildIdMap(serializedDocument);
	const serializedProcessIdsWithExtensionElements = new Set(
		getElementsByLocalName(serializedDocument, 'process')
			.filter((processElement) => Boolean(findDirectChild(processElement, 'extensionElements')))
			.map((processElement) => processElement.getAttribute('id') || ''),
	);

	mergedState.namespaces = {
		...originalState.namespaces,
		...serializedNamespaces,
		...incomingState.namespaces,
	};

	if (incomingState.targetNamespace !== undefined) {
		mergedState.targetNamespace = incomingState.targetNamespace;
	}

	for (const [incomingId, incomingElementState] of Object.entries(incomingState.elements)) {
		const nextId = elementIdRenameMap.get(incomingId) || incomingId;
		const originalElementId = originalState.elements[nextId] ? nextId : incomingId;
		const remappedIncomingElementState = nextId === incomingId
			? incomingElementState
			: {
				...incomingElementState,
				id: nextId,
			};
		const mergedElementState = mergeElementState(
			originalState.elements[originalElementId],
			remapElementStateReferences(remappedIncomingElementState, elementIdRenameMap),
		);
		if (mergedElementState) {
			mergedState.elements[nextId] = mergedElementState;
			mergeSerializedElementOverlayState(
				{ mergedState, originalState, serializedState, originalElementsById, serializedElementsById },
				originalElementId,
				nextId,
				preserveMissingExtensionContainers,
			);
			if (nextId !== originalElementId) {
				delete mergedState.elements[originalElementId];
			}
		}
	}

	mergedState.signalDefinitions = mergeSerializedCollectionState(
		originalState.signalDefinitions,
		serializedState.signalDefinitions,
		incomingState.signalDefinitions,
		(signal) => signal.id,
	);
	mergedState.messageDefinitions = mergeSerializedCollectionState(
		originalState.messageDefinitions,
		serializedState.messageDefinitions,
		incomingState.messageDefinitions,
		(message) => message.id,
	);
	const remappedIncomingEventListeners = remapProcessScopedItems(incomingState.eventListeners, processIdRenameMap);
	const remappedIncomingLocalizations = remapProcessScopedItems(incomingState.localizations, processIdRenameMap);
	const remappedIncomingDataObjects = remapProcessScopedItems(incomingState.dataObjects, processIdRenameMap);
	const remappedIncomingProcessExtensionElements = remapProcessScopedItems(
		incomingState.processExtensionElements,
		processIdRenameMap,
	);
	mergedState.eventListeners = mergeSerializedCollectionState(
		originalState.eventListeners,
		serializedState.eventListeners,
		remappedIncomingEventListeners,
		(eventListener) => `${eventListener.processId || ''}:${getStableCollectionKey(eventListener, eventListener.id)}`,
	);
	mergedState.localizations = mergeSerializedCollectionState(
		originalState.localizations,
		serializedState.localizations,
		remappedIncomingLocalizations,
		(localization) => `${localization.processId || ''}:${getStableCollectionKey(localization, localization.id)}`,
	);
	mergedState.dataObjects = mergeSerializedCollectionState(
		originalState.dataObjects,
		serializedState.dataObjects,
		remappedIncomingDataObjects,
		(dataObject) => `${dataObject.processId || ''}:${getStableCollectionKey(dataObject, dataObject.id)}`,
	);
	mergedState.processExtensionElements = mergeSerializedProcessExtensionStates(
		originalState.processExtensionElements,
		serializedState.processExtensionElements,
		remappedIncomingProcessExtensionElements,
		serializedProcessIdsWithExtensionElements,
		preserveMissingExtensionContainers,
	);
	ensureActivitiNamespace(mergedState);

	applyMergedStateToDocument({
		originalDocument,
		serializedDocument,
		originalDefinitions,
		serializedDefinitions,
		originalState,
		mergedState,
	});

	return serializeXmlDocument(originalDocument);
}
