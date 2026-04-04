import { describe, expect, test, vi } from 'vitest';

const vscodeMocks = vi.hoisted(() => ({
	EventEmitter: class {
		readonly event = vi.fn();
		fire = vi.fn();
		dispose = vi.fn();
	},
}));

vi.mock('vscode', () => ({
	ThemeIcon: class {
		constructor(public readonly id: string) {}
	},
	TreeItem: class {
		label: string;
		collapsibleState: number;
		description?: string;
		tooltip?: string;
		iconPath?: unknown;
		contextValue?: string;

		constructor(label: string, collapsibleState: number) {
			this.label = label;
			this.collapsibleState = collapsibleState;
		}
	},
	TreeItemCollapsibleState: {
		Expanded: 1,
		None: 0,
	},
	EventEmitter: vscodeMocks.EventEmitter,
}));

vi.mock('../../bpmnEditorRouting', () => ({
	resolveActiveBpmnUri: () => undefined,
	isBpmnFileName: () => true,
}));

import legacyPoolLanesFixture from '../../../../fixtures/flowable/legacy-pool-lanes.bpmn?raw';
import { ProcessNavigatorProvider } from '../../processNavigatorProvider';

describe('ProcessNavigatorProvider', () => {
	test('surfaces lanes as children of the process node', () => {
		const provider = new ProcessNavigatorProvider();

		provider.refresh(legacyPoolLanesFixture);

		const rootItems = provider.getChildren();
		const processItem = rootItems.find((item) => item.nodeInfo.id === 'poolProcess');
		expect(processItem).toBeDefined();

		const childIds = provider.getChildren(processItem).map((item) => item.nodeInfo.id);
		expect(childIds).toContain('lane1');
		expect(childIds).toContain('lane2');
		expect(childIds).not.toContain('laneSet1');
	});
});