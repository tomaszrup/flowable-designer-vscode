import { describe, expect, it } from 'vitest';
import {
	getKnownProcessIds,
	getProcessScopedGlobalIndex,
	getProcessScopedItems,
	remapProcessScopedIds,
	reorderProcessScopedItems,
} from '../../webview/processScoped';

describe('processScoped helpers', () => {
	it('matches global items when there is a single process', () => {
		const flowableState = {
			elements: {
				Process_1: { id: 'Process_1', type: 'bpmn:Process' },
			},
		};
		const knownProcessIds = getKnownProcessIds(flowableState as never);
		const items = [
			{ id: 'a' },
			{ id: 'b', processId: 'Process_1' },
		];

		expect(getProcessScopedItems(items, 'Process_1', knownProcessIds)).toEqual(items);
		expect(getProcessScopedGlobalIndex(items, 'Process_1', 0, knownProcessIds)).toBe(0);
		expect(getProcessScopedGlobalIndex(items, 'Process_1', 1, knownProcessIds)).toBe(1);
	});

	it('reorders only items for the selected process', () => {
		const knownProcessIds = ['Process_1', 'Process_2'];
		const items = [
			{ id: 'x', processId: 'Process_1' },
			{ id: 'keep', processId: 'Process_2' },
			{ id: 'y', processId: 'Process_1' },
			{ id: 'z', processId: 'Process_1' },
		];

		reorderProcessScopedItems(items, 'Process_1', 0, 2, knownProcessIds);

		expect(items.map((item) => item.id)).toEqual(['y', 'keep', 'x', 'z']);
	});

	it('remaps process-scoped ids in place', () => {
		const items = [
			{ id: 'a', processId: 'old' },
			{ id: 'b', processId: 'other' },
			{ id: 'c', processId: 'old' },
		];

		remapProcessScopedIds(items, 'old', 'new');

		expect(items).toEqual([
			{ id: 'a', processId: 'new' },
			{ id: 'b', processId: 'other' },
			{ id: 'c', processId: 'new' },
		]);
	});

	it('returns false when a process-scoped reorder is a no-op', () => {
		const items = [
			{ id: 'a', processId: 'Process_1' },
			{ id: 'b', processId: 'Process_1' },
		];

		expect(reorderProcessScopedItems(items, 'Process_1', 0, 0, ['Process_1'])).toBe(false);
		expect(items.map((item) => item.id)).toEqual(['a', 'b']);
	});
});