import type { Document as XmlDocument, Element as XmlElement, Node as XmlNode } from '@xmldom/xmldom';
import { FLOWABLE_ATTRIBUTE_KEYS } from '../types';
import { getElementChildren, getLocalName } from './xmlUtils';

function compareStrings(left: string, right: string): number {
	return left.localeCompare(right);
}

const editableActivitiAttributes = new Set(FLOWABLE_ATTRIBUTE_KEYS.map((key) => `activiti:${key}`));
const overlayManagedChildNames = new Set([
	'extensionElements',
	'documentation',
	'conditionExpression',
	'script',
	'multiInstanceLoopCharacteristics',
]);

function buildComparableNodeSignature(node: XmlNode, ignoreElementId = false, structuralOnly = false): string {
	if (node.nodeType === node.ELEMENT_NODE) {
		const element = node as XmlElement;
		const attributes = Array.from(element.attributes)
			.filter((attribute) => attribute.name !== 'xmlns' && !attribute.name.startsWith('xmlns:'))
			.filter((attribute) => !(structuralOnly && editableActivitiAttributes.has(attribute.name)))
			.filter((attribute) => !(ignoreElementId && attribute.name === 'id'))
			.map((attribute) => `${attribute.name}=${attribute.value}`)
			.sort(compareStrings)
			.join('|');
		const children = Array.from(element.childNodes)
			.filter((child) => {
				if (!structuralOnly || child.nodeType !== child.ELEMENT_NODE) {
					return true;
				}

				return !overlayManagedChildNames.has(getLocalName(child as XmlElement));
			})
			.map((child) => buildComparableNodeSignature(child, false, structuralOnly))
			.filter((signature) => signature.length > 0)
			.join('|');

		return `element:${element.namespaceURI || ''}:${getLocalName(element)}:[${attributes}]:[${children}]`;
	}

	if (node.nodeType === node.TEXT_NODE || node.nodeType === node.CDATA_SECTION_NODE) {
		const value = node.nodeValue || '';
		if (value.trim().length === 0) {
			return '';
		}
		return `text:${value}`;
	}

	return '';
}

function buildProcessStructureKey(processElement: XmlElement): string {
	return buildComparableNodeSignature(processElement, true);
}

function buildElementStructureKey(element: XmlElement): string {
	return buildComparableNodeSignature(element, true, true);
}

function getProcessElements(definitions: XmlElement): XmlElement[] {
	return getElementChildren(definitions)
		.filter((child) => getLocalName(child) === 'process')
		.filter((child) => Boolean(child.getAttribute('id')));
}

function getUnmatchedProcesses(processes: XmlElement[], matchedIds: Set<string>): XmlElement[] {
	return processes.filter((processElement) => !matchedIds.has(processElement.getAttribute('id') || ''));
}

function groupProcessesByStructure(processes: XmlElement[]): Map<string, XmlElement[]> {
	const processesByStructure = new Map<string, XmlElement[]>();

	for (const processElement of processes) {
		const structureKey = buildProcessStructureKey(processElement);
		if (!structureKey) {
			continue;
		}

		const bucket = processesByStructure.get(structureKey) || [];
		bucket.push(processElement);
		processesByStructure.set(structureKey, bucket);
	}

	return processesByStructure;
}

function addDirectProcessMatches(
	originalProcesses: XmlElement[],
	serializedById: Map<string, XmlElement>,
	matchedOriginalIds: Set<string>,
	matchedSerializedIds: Set<string>,
): void {
	for (const processElement of originalProcesses) {
		const processId = processElement.getAttribute('id') || '';
		if (serializedById.has(processId)) {
			matchedOriginalIds.add(processId);
			matchedSerializedIds.add(processId);
		}
	}
}

function addStructureBasedProcessMatches(
	renameMap: Map<string, string>,
	originalProcesses: XmlElement[],
	serializedProcesses: XmlElement[],
	matchedOriginalIds: Set<string>,
	matchedSerializedIds: Set<string>,
): void {
	const originalByStructure = groupProcessesByStructure(originalProcesses);
	const serializedByStructure = groupProcessesByStructure(serializedProcesses);

	for (const [structureKey, originalMatches] of originalByStructure.entries()) {
		const serializedMatches = serializedByStructure.get(structureKey);
		if (!serializedMatches || originalMatches.length !== 1 || serializedMatches.length !== 1) {
			continue;
		}

		const originalId = originalMatches[0].getAttribute('id') || '';
		const serializedId = serializedMatches[0].getAttribute('id') || '';
		if (originalId && serializedId && originalId !== serializedId) {
			renameMap.set(originalId, serializedId);
			matchedOriginalIds.add(originalId);
			matchedSerializedIds.add(serializedId);
		}
	}
}

function addDescendantBasedProcessMatches(
	renameMap: Map<string, string>,
	originalProcesses: XmlElement[],
	serializedProcesses: XmlElement[],
): void {
	const descendantIdRenameMatches = findUniqueBestBidirectionalMatches(
		originalProcesses,
		serializedProcesses,
		(processElement) => processElement.getAttribute('id') || '',
		(processElement) => processElement.getAttribute('id') || '',
		(leftProcess, rightProcess) => countSharedSetValues(
			collectDescendantElementIds(leftProcess),
			collectDescendantElementIds(rightProcess),
		),
	);

	for (const [originalId, serializedId] of descendantIdRenameMatches.entries()) {
		if (originalId !== serializedId) {
			renameMap.set(originalId, serializedId);
		}
	}
}

function getRemainingProcessSets(
	originalProcesses: XmlElement[],
	serializedProcesses: XmlElement[],
	matchedOriginalIds: Set<string>,
	matchedSerializedIds: Set<string>,
): { originalProcesses: XmlElement[]; serializedProcesses: XmlElement[] } {
	return {
		originalProcesses: getUnmatchedProcesses(originalProcesses, matchedOriginalIds),
		serializedProcesses: getUnmatchedProcesses(serializedProcesses, matchedSerializedIds),
	};
}

function buildProcessIdRenameMapForDefinitions(
	originalDefinitions: XmlElement,
	serializedDefinitions: XmlElement,
): Map<string, string> {
	const originalProcesses = getProcessElements(originalDefinitions);
	const serializedProcesses = getProcessElements(serializedDefinitions);
	const serializedById = new Map(
		serializedProcesses.map((processElement) => [processElement.getAttribute('id') || '', processElement] as const),
	);
	const matchedOriginalIds = new Set<string>();
	const matchedSerializedIds = new Set<string>();
	const renameMap = new Map<string, string>();

	addDirectProcessMatches(originalProcesses, serializedById, matchedOriginalIds, matchedSerializedIds);

	const structureCandidates = getRemainingProcessSets(
		originalProcesses,
		serializedProcesses,
		matchedOriginalIds,
		matchedSerializedIds,
	);
	addStructureBasedProcessMatches(
		renameMap,
		structureCandidates.originalProcesses,
		structureCandidates.serializedProcesses,
		matchedOriginalIds,
		matchedSerializedIds,
	);

	const descendantCandidates = getRemainingProcessSets(
		originalProcesses,
		serializedProcesses,
		matchedOriginalIds,
		matchedSerializedIds,
	);
	addDescendantBasedProcessMatches(
		renameMap,
		descendantCandidates.originalProcesses,
		descendantCandidates.serializedProcesses,
	);

	return renameMap;
}

function collectDescendantElementIds(element: XmlElement): Set<string> {
	const descendantIds = new Set<string>();
	const queue = [...getElementChildren(element)];

	while (queue.length > 0) {
		const [current] = queue.splice(0, 1);
		const id = current.getAttribute('id');
		if (id) {
			descendantIds.add(id);
		}
		queue.push(...getElementChildren(current));
	}

	return descendantIds;
}

function countSharedSetValues(left: Set<string>, right: Set<string>): number {
	let sharedCount = 0;
	for (const value of left) {
		if (right.has(value)) {
			sharedCount += 1;
		}
	}
	return sharedCount;
}

function findUniqueBestBidirectionalMatches<T, U>(
	leftItems: T[],
	rightItems: U[],
	getLeftId: (item: T) => string,
	getRightId: (item: U) => string,
	getScore: (left: T, right: U) => number,
): Map<string, string> {
	const leftCandidates = new Map<string, Array<{ id: string; score: number }>>();
	const rightCandidates = new Map<string, Array<{ id: string; score: number }>>();

	for (const leftItem of leftItems) {
		const leftId = getLeftId(leftItem);
		for (const rightItem of rightItems) {
			const rightId = getRightId(rightItem);
			const score = getScore(leftItem, rightItem);
			if (score <= 0) {
				continue;
			}

			const leftBucket = leftCandidates.get(leftId) || [];
			leftBucket.push({ id: rightId, score });
			leftCandidates.set(leftId, leftBucket);

			const rightBucket = rightCandidates.get(rightId) || [];
			rightBucket.push({ id: leftId, score });
			rightCandidates.set(rightId, rightBucket);
		}
	}

	const selectUniqueBestMatch = (candidates: Array<{ id: string; score: number }> | undefined): string | undefined => {
		if (!candidates || candidates.length === 0) {
			return undefined;
		}

		const sortedCandidates = [...candidates].sort((left, right) => right.score - left.score);
		if (sortedCandidates.length > 1 && sortedCandidates[0].score === sortedCandidates[1].score) {
			return undefined;
		}

		return sortedCandidates[0].id;
	};

	const matches = new Map<string, string>();
	for (const [leftId, candidates] of leftCandidates.entries()) {
		const rightId = selectUniqueBestMatch(candidates);
		if (!rightId) {
			continue;
		}

		const reverseMatch = selectUniqueBestMatch(rightCandidates.get(rightId));
		if (reverseMatch === leftId) {
			matches.set(leftId, rightId);
		}
	}

	return matches;
}

export function buildProcessIdRenameMap(originalDocument: XmlDocument, serializedDocument: XmlDocument): Map<string, string> {
	const originalDefinitions = originalDocument.documentElement;
	const serializedDefinitions = serializedDocument.documentElement;
	if (!originalDefinitions || !serializedDefinitions) {
		return new Map();
	}

	return buildProcessIdRenameMapForDefinitions(originalDefinitions, serializedDefinitions);
}

export function buildElementIdRenameMap(originalDocument: XmlDocument, serializedDocument: XmlDocument): Map<string, string> {
	const originalElements = Array.from(originalDocument.getElementsByTagName('*'))
		.filter((element) => getLocalName(element) !== 'process')
		.filter((element) => Boolean(element.getAttribute('id')));
	const serializedElements = Array.from(serializedDocument.getElementsByTagName('*'))
		.filter((element) => getLocalName(element) !== 'process')
		.filter((element) => Boolean(element.getAttribute('id')));

	const serializedById = new Map(
		serializedElements.map((element) => [element.getAttribute('id') || '', element] as const),
	);
	const unmatchedOriginalElements = originalElements.filter((element) => !serializedById.has(element.getAttribute('id') || ''));
	const originalByStructure = new Map<string, XmlElement[]>();
	for (const element of unmatchedOriginalElements) {
		const structureKey = buildElementStructureKey(element);
		if (!structureKey) {
			continue;
		}
		const bucket = originalByStructure.get(structureKey) || [];
		bucket.push(element);
		originalByStructure.set(structureKey, bucket);
	}

	const originalById = new Map(originalElements.map((element) => [element.getAttribute('id') || '', element] as const));
	const unmatchedSerializedElements = serializedElements.filter((element) => !originalById.has(element.getAttribute('id') || ''));
	const serializedByStructure = new Map<string, XmlElement[]>();
	for (const element of unmatchedSerializedElements) {
		const structureKey = buildElementStructureKey(element);
		if (!structureKey) {
			continue;
		}
		const bucket = serializedByStructure.get(structureKey) || [];
		bucket.push(element);
		serializedByStructure.set(structureKey, bucket);
	}

	const renameMap = new Map<string, string>();
	for (const [structureKey, originalMatches] of originalByStructure.entries()) {
		const serializedMatches = serializedByStructure.get(structureKey);
		if (!serializedMatches || originalMatches.length !== 1 || serializedMatches.length !== 1) {
			continue;
		}

		const originalId = originalMatches[0].getAttribute('id') || '';
		const serializedId = serializedMatches[0].getAttribute('id') || '';
		if (originalId && serializedId && originalId !== serializedId) {
			renameMap.set(originalId, serializedId);
		}
	}

	return renameMap;
}

export function remapProcessScopedItems<T extends { processId?: string }>(items: T[], processIdRenameMap: Map<string, string>): T[] {
	return items.map((item) => {
		if (!item.processId) {
			return { ...item };
		}

		const nextProcessId = processIdRenameMap.get(item.processId);
		if (!nextProcessId || nextProcessId === item.processId) {
			return { ...item };
		}

		return {
			...item,
			processId: nextProcessId,
		};
	});
}