import type { FlowableDocumentState } from '../flowable/types';

export function getKnownProcessIds(flowableState: Pick<FlowableDocumentState, 'elements'>): string[] {
	return Object.values(flowableState.elements)
		.filter((elementState) => elementState.type === 'bpmn:Process' || elementState.type === 'process')
		.map((elementState) => elementState.id);
}

export function isProcessScopedItemMatch(
	processId: string | undefined,
	selectedProcessId: string,
	knownProcessIds: string[],
): boolean {
	return processId === selectedProcessId || (!processId && knownProcessIds.length <= 1);
}

export function getProcessScopedItems<T extends { processId?: string }>(
	items: T[],
	processId: string,
	knownProcessIds: string[],
): T[] {
	return items.filter((item) => isProcessScopedItemMatch(item.processId, processId, knownProcessIds));
}

export function getProcessScopedGlobalIndex<T extends { processId?: string }>(
	items: T[],
	processId: string,
	scopedIndex: number,
	knownProcessIds: string[],
): number {
	let currentScopedIndex = 0;
	for (let index = 0; index < items.length; index += 1) {
		if (!isProcessScopedItemMatch(items[index].processId, processId, knownProcessIds)) {
			continue;
		}
		if (currentScopedIndex === scopedIndex) {
			return index;
		}
		currentScopedIndex += 1;
	}
	return -1;
}

export function reorderProcessScopedItems<T extends { processId?: string }>(
	items: T[],
	processId: string,
	fromIndex: number,
	toIndex: number,
	knownProcessIds: string[],
): boolean {
	const scopedIndexes: number[] = [];
	const scopedItems: T[] = [];
	for (let index = 0; index < items.length; index += 1) {
		if (!isProcessScopedItemMatch(items[index].processId, processId, knownProcessIds)) {
			continue;
		}
		scopedIndexes.push(index);
		scopedItems.push(items[index]);
	}

	if (fromIndex < 0 || toIndex < 0 || fromIndex >= scopedItems.length || toIndex >= scopedItems.length || fromIndex === toIndex) {
		return false;
	}

	const reorderedItems = [...scopedItems];
	const [movedItem] = reorderedItems.splice(fromIndex, 1);
	reorderedItems.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, movedItem);

	scopedIndexes.forEach((globalIndex, scopedItemIndex) => {
		items[globalIndex] = reorderedItems[scopedItemIndex];
	});

	return true;
}

export function remapProcessScopedIds<T extends { processId?: string }>(items: T[], oldId: string, newId: string): void {
	for (let index = 0; index < items.length; index += 1) {
		if (items[index].processId !== oldId) {
			continue;
		}

		items[index] = {
			...items[index],
			processId: newId,
		};
	}
}