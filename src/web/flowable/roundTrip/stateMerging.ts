import type {
	FlowableElementState,
	FlowableProcessExtensionState,
	XmlIdentified,
} from '../types';

const EMPTY_RECORD: Record<string, unknown> = {};

function cloneArray<T>(items: T[] | undefined): T[] {
	return items?.map((item) => ({ ...item })) || [];
}

function cloneRecord<T extends object>(value: T | undefined): T | Record<string, never> {
	return value ? { ...value } : {};
}

function cloneOptionalObject<T extends object>(value: T | null | undefined): T | null {
	if (value === null) {
		return null;
	}

	return value ? { ...value } : null;
}

function preferValue<T>(incomingValue: T | undefined, originalValue: T | undefined, fallbackValue: T): T {
	return incomingValue ?? originalValue ?? fallbackValue;
}

function preferOptionalObject<T extends object>(incomingValue: T | null | undefined, originalValue: T | null | undefined): T | null {
	if (incomingValue !== undefined) {
		return cloneOptionalObject(incomingValue);
	}

	return cloneOptionalObject(originalValue);
}

function preferExtensionElements(incomingValue: string[] | undefined, originalValue: string[] | undefined): string[] {
	if (incomingValue && incomingValue.length > 0) {
		return [...incomingValue];
	}

	return [...(originalValue || [])];
}

export function mergeElementState(
	originalState: FlowableElementState | undefined,
	incomingState: FlowableElementState | undefined,
): FlowableElementState | undefined {
	if (!originalState && !incomingState) {
		return undefined;
	}

	const base = originalState || incomingState;
	if (!base) {
		return undefined;
	}

	return {
		id: preferValue(incomingState?.id, originalState?.id, base.id),
		type: preferValue(incomingState?.type, originalState?.type, base.type),
		activitiAttributes: cloneRecord(incomingState?.activitiAttributes ?? originalState?.activitiAttributes),
		fieldExtensions: cloneArray(incomingState?.fieldExtensions ?? originalState?.fieldExtensions),
		taskListeners: cloneArray(incomingState?.taskListeners ?? originalState?.taskListeners),
		executionListeners: cloneArray(incomingState?.executionListeners ?? originalState?.executionListeners),
		formProperties: cloneArray(incomingState?.formProperties ?? originalState?.formProperties),
		inputParameters: cloneArray(incomingState?.inputParameters ?? originalState?.inputParameters),
		outputParameters: cloneArray(incomingState?.outputParameters ?? originalState?.outputParameters),
		multiInstance: preferOptionalObject(incomingState?.multiInstance, originalState?.multiInstance),
		conditionExpression: preferValue(incomingState?.conditionExpression, originalState?.conditionExpression, ''),
		script: preferValue(incomingState?.script, originalState?.script, ''),
		timerDefinition: preferOptionalObject(incomingState?.timerDefinition, originalState?.timerDefinition),
		errorRef: preferValue(incomingState?.errorRef, originalState?.errorRef, ''),
		signalRef: preferValue(incomingState?.signalRef, originalState?.signalRef, ''),
		messageRef: preferValue(incomingState?.messageRef, originalState?.messageRef, ''),
		terminateAll: preferValue(incomingState?.terminateAll, originalState?.terminateAll, ''),
		compensateActivityRef: preferValue(incomingState?.compensateActivityRef, originalState?.compensateActivityRef, ''),
		isForCompensation: preferValue(incomingState?.isForCompensation, originalState?.isForCompensation, ''),
		failedJobRetryTimeCycle: preferValue(incomingState?.failedJobRetryTimeCycle, originalState?.failedJobRetryTimeCycle, ''),
		exceptionMaps: cloneArray(incomingState?.exceptionMaps ?? originalState?.exceptionMaps),
		documentation: preferValue(incomingState?.documentation, originalState?.documentation, ''),
		preservedAttributes: {
			...originalState?.preservedAttributes,
			...incomingState?.preservedAttributes,
		},
		preservedExtensionElements: preferExtensionElements(incomingState?.preservedExtensionElements, originalState?.preservedExtensionElements),
	};
}

function cloneIdentifiedCollection<T extends XmlIdentified>(items: T[]): T[] {
	return items.map((item) => ({ ...item }));
}

function cloneValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return [...value] as T;
	}

	if (value && typeof value === 'object') {
		return { ...value } as T;
	}

	return value;
}

function areValuesEquivalent<T>(left: T, right: T): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeSerializedValue<T>(originalValue: T, serializedValue: T, incomingValue: T): T {
	if (!areValuesEquivalent(incomingValue, originalValue)) {
		return cloneValue(incomingValue);
	}

	return cloneValue(serializedValue);
}

export function mergeSerializedOverlayValue<T>(
	originalValue: T,
	serializedValue: T,
	incomingValue: T,
	preserveOriginalOnEmptySerialized: boolean,
	isEmpty: (value: T) => boolean,
): T {
	if (!areValuesEquivalent(incomingValue, originalValue)) {
		return cloneValue(incomingValue);
	}

	if (preserveOriginalOnEmptySerialized && isEmpty(serializedValue)) {
		return cloneValue(originalValue);
	}

	return cloneValue(serializedValue);
}

function stripXmlIdentity<T extends XmlIdentified>(item: T): Omit<T, 'xmlIdentity'> {
	const { xmlIdentity: _xmlIdentity, ...rest } = item;
	return rest;
}

function areCollectionsEquivalent<T extends XmlIdentified>(left: T[], right: T[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((item, index) => {
		const other = right[index];
		if (!other) {
			return false;
		}
		return JSON.stringify(stripXmlIdentity(item)) === JSON.stringify(stripXmlIdentity(other));
	});
}

function areItemsEquivalent<T extends XmlIdentified>(left: T | undefined, right: T | undefined): boolean {
	if (!left || !right) {
		return left === right;
	}

	return JSON.stringify(stripXmlIdentity(left)) === JSON.stringify(stripXmlIdentity(right));
}

function areCollectionKeysEquivalent<T extends XmlIdentified>(
	left: T[],
	right: T[],
	getKey: (item: T) => string,
): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((item, index) => {
		const other = right[index];
		return Boolean(other) && getKey(item) === getKey(other);
	});
}

function createMergedRecordBase<T extends XmlIdentified>(
	originalItem: T | undefined,
	serializedItem: T | undefined,
	incomingItem: T,
): Record<string, unknown> {
	return {
		...((serializedItem ?? originalItem ?? incomingItem) as unknown as Record<string, unknown>),
	};
}

function collectMergeKeys(
	originalRecord: Record<string, unknown>,
	serializedRecord: Record<string, unknown>,
	incomingRecord: Record<string, unknown>,
): Set<string> {
	return new Set([
		...Object.keys(originalRecord),
		...Object.keys(serializedRecord),
		...Object.keys(incomingRecord),
	]);
}

function mergeSerializedCollectionItem<T extends XmlIdentified>(
	originalItem: T | undefined,
	serializedItem: T | undefined,
	incomingItem: T,
): T {
	const originalRecord = (originalItem ?? EMPTY_RECORD) as Record<string, unknown>;
	const serializedRecord = (serializedItem ?? EMPTY_RECORD) as Record<string, unknown>;
	const incomingRecord = incomingItem as unknown as Record<string, unknown>;
	const mergedRecord = createMergedRecordBase(originalItem, serializedItem, incomingItem);
	const keys = collectMergeKeys(originalRecord, serializedRecord, incomingRecord);

	for (const key of keys) {
		if (key === 'xmlIdentity') {
			continue;
		}

		if (!originalItem) {
			mergedRecord[key] = incomingRecord[key];
			continue;
		}

		if (incomingRecord[key] !== originalRecord[key]) {
			mergedRecord[key] = incomingRecord[key];
			continue;
		}

		if (serializedItem && key in serializedRecord) {
			mergedRecord[key] = serializedRecord[key];
			continue;
		}

		mergedRecord[key] = incomingRecord[key];
	}

	mergedRecord.xmlIdentity = incomingItem.xmlIdentity || serializedItem?.xmlIdentity || originalItem?.xmlIdentity;
	return mergedRecord as T;
}

function mergeAlignedSerializedCollectionState<T extends XmlIdentified>(
	originalByKey: Map<string, T>,
	serializedItems: T[],
	incomingItems: T[],
	incomingByKey: Map<string, T>,
	serializedByKey: Map<string, T>,
	getKey: (item: T) => string,
): T[] {
	const mergedItems: T[] = [];
	const includedKeys = new Set<string>();

	for (const serializedItem of serializedItems) {
		const key = getKey(serializedItem);
		const originalItem = originalByKey.get(key);
		const incomingItem = incomingByKey.get(key);

		if (!incomingItem) {
			if (!originalItem) {
				mergedItems.push({ ...serializedItem });
				includedKeys.add(key);
			}
			continue;
		}

		mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedItem, incomingItem));
		includedKeys.add(key);
	}

	for (const incomingItem of incomingItems) {
		const key = getKey(incomingItem);
		if (includedKeys.has(key)) {
			continue;
		}

		const originalItem = originalByKey.get(key);
		if (originalItem && areItemsEquivalent(incomingItem, originalItem)) {
			continue;
		}

		mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedByKey.get(key), incomingItem));
	}

	return mergedItems;
}

function mergeReorderedSerializedCollectionState<T extends XmlIdentified>(
	originalByKey: Map<string, T>,
	serializedItems: T[],
	incomingItems: T[],
	serializedByKey: Map<string, T>,
	getKey: (item: T) => string,
): T[] {
	const mergedItems: T[] = [];
	const includedKeys = new Set<string>();

	for (const incomingItem of incomingItems) {
		const key = getKey(incomingItem);
		const originalItem = originalByKey.get(key);
		const serializedItem = serializedByKey.get(key);

		if (!serializedItem && originalItem && areItemsEquivalent(incomingItem, originalItem)) {
			continue;
		}

		mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedItem, incomingItem));
		includedKeys.add(key);
	}

	for (const serializedItem of serializedItems) {
		const key = getKey(serializedItem);
		if (!includedKeys.has(key) && !originalByKey.has(key)) {
			mergedItems.push({ ...serializedItem });
		}
	}

	return mergedItems;
}

export function mergeSerializedCollectionState<T extends XmlIdentified>(
	originalItems: T[],
	serializedItems: T[],
	incomingItems: T[],
	getKey: (item: T) => string,
): T[] {
	if (areCollectionsEquivalent(incomingItems, originalItems)) {
		return cloneIdentifiedCollection(serializedItems);
	}

	const originalByKey = new Map(originalItems.map((item) => [getKey(item), item]));
	const serializedByKey = new Map(serializedItems.map((item) => [getKey(item), item]));
	const incomingByKey = new Map(incomingItems.map((item) => [getKey(item), item]));
	const incomingStructureMatchesOriginal = areCollectionKeysEquivalent(incomingItems, originalItems, getKey);

	if (incomingStructureMatchesOriginal) {
		return mergeAlignedSerializedCollectionState(
			originalByKey,
			serializedItems,
			incomingItems,
			incomingByKey,
			serializedByKey,
			getKey,
		);
	}

	return mergeReorderedSerializedCollectionState(originalByKey, serializedItems, incomingItems, serializedByKey, getKey);
}

export function mergePreservedExtensionElements(
	baseElements: string[],
	serializedElements: string[],
	serializedHadExtensionContainer = serializedElements.length > 0,
	preserveMissingContainerElements = true,
): string[] {
	if (serializedElements.length === 0 && !serializedHadExtensionContainer && preserveMissingContainerElements) {
		return [...baseElements];
	}

	return [...serializedElements];
}

export function mergeSerializedProcessExtensionStates(
	originalItems: FlowableProcessExtensionState[],
	serializedItems: FlowableProcessExtensionState[],
	incomingItems: FlowableProcessExtensionState[],
	serializedProcessIdsWithExtensionElements: Set<string>,
	preserveMissingContainerElements = true,
): FlowableProcessExtensionState[] {
	const originalByProcessId = new Map(originalItems.map((item) => [item.processId || '', item] as const));
	const serializedByProcessId = new Map(serializedItems.map((item) => [item.processId || '', item] as const));
	const incomingByProcessId = new Map(incomingItems.map((item) => [item.processId || '', item] as const));
	const processIds = new Set<string>([
		...originalByProcessId.keys(),
		...serializedByProcessId.keys(),
		...incomingByProcessId.keys(),
	]);
	const mergedItems: FlowableProcessExtensionState[] = [];

	for (const processId of processIds) {
		const originalPreserved = originalByProcessId.get(processId)?.preservedExtensionElements || [];
		const incomingPreserved = incomingByProcessId.get(processId)?.preservedExtensionElements || originalPreserved;
		const serializedPreserved = serializedByProcessId.get(processId)?.preservedExtensionElements || [];
		const serializedHadExtensionContainer = serializedProcessIdsWithExtensionElements.has(processId);
		const mergedPreserved = areValuesEquivalent(incomingPreserved, originalPreserved)
			? mergePreservedExtensionElements(
				originalPreserved,
				serializedPreserved,
				serializedHadExtensionContainer,
				preserveMissingContainerElements,
			)
			: [...incomingPreserved];

		if (mergedPreserved.length > 0) {
			mergedItems.push({
				processId,
				preservedExtensionElements: mergedPreserved,
			});
		}
	}

	return mergedItems;
}

export function getStableCollectionKey<T extends XmlIdentified>(item: T, fallbackKey: string): string {
	return item.xmlIdentity || fallbackKey;
}