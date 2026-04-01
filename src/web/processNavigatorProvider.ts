import * as vscode from 'vscode';
import { type Element as XmlElement } from '@xmldom/xmldom';
import { BPMN_EDITOR_VIEW_TYPE } from './flowableBpmn';
import { parseXmlDocument } from './flowable/xmlParser';

interface BpmnNodeInfo {
	id: string;
	name: string;
	type: string;
	children: BpmnNodeInfo[];
}

const ELEMENT_ICONS: Record<string, vscode.ThemeIcon> = {
	'process': new vscode.ThemeIcon('symbol-namespace'),
	'startEvent': new vscode.ThemeIcon('play'),
	'endEvent': new vscode.ThemeIcon('stop'),
	'userTask': new vscode.ThemeIcon('person'),
	'serviceTask': new vscode.ThemeIcon('gear'),
	'scriptTask': new vscode.ThemeIcon('code'),
	'sendTask': new vscode.ThemeIcon('mail'),
	'receiveTask': new vscode.ThemeIcon('inbox'),
	'manualTask': new vscode.ThemeIcon('tools'),
	'businessRuleTask': new vscode.ThemeIcon('law'),
	'callActivity': new vscode.ThemeIcon('references'),
	'subProcess': new vscode.ThemeIcon('symbol-class'),
	'transaction': new vscode.ThemeIcon('symbol-class'),
	'exclusiveGateway': new vscode.ThemeIcon('git-compare'),
	'inclusiveGateway': new vscode.ThemeIcon('git-merge'),
	'parallelGateway': new vscode.ThemeIcon('split-horizontal'),
	'eventBasedGateway': new vscode.ThemeIcon('git-compare'),
	'complexGateway': new vscode.ThemeIcon('git-compare'),
	'boundaryEvent': new vscode.ThemeIcon('bell'),
	'intermediateCatchEvent': new vscode.ThemeIcon('bell'),
	'intermediateThrowEvent': new vscode.ThemeIcon('bell-dot'),
	'sequenceFlow': new vscode.ThemeIcon('arrow-right'),
	'textAnnotation': new vscode.ThemeIcon('note'),
	'participant': new vscode.ThemeIcon('organization'),
	'lane': new vscode.ThemeIcon('layout'),
	'collaboration': new vscode.ThemeIcon('organization'),
};

function getLocalName(nodeName: string): string {
	const colonIdx = nodeName.indexOf(':');
	return colonIdx >= 0 ? nodeName.substring(colonIdx + 1) : nodeName;
}

function formatLabel(type: string): string {
	return type.replace(/([A-Z])/g, ' $1').trim();
}

function parseProcessElements(xml: string): BpmnNodeInfo[] {
	const roots: BpmnNodeInfo[] = [];

	let document;
	try {
		document = parseXmlDocument(xml);
	} catch {
		return roots;
	}

	const definitions = document.documentElement;
	if (!definitions) {
		return roots;
	}

	const SKIP_TYPES = new Set([
		'definitions', 'extensionElements', 'documentation', 'conditionExpression',
		'script', 'multiInstanceLoopCharacteristics', 'timerEventDefinition',
		'errorEventDefinition', 'signalEventDefinition', 'messageEventDefinition',
		'signal', 'message', 'loopCardinality', 'completionCondition',
		'BPMNDiagram', 'BPMNPlane', 'BPMNShape', 'BPMNEdge', 'Bounds', 'waypoint',
		'dataObject', 'dataObjectReference', 'dataStoreReference',
		'field', 'string', 'expression', 'formProperty',
		'taskListener', 'executionListener', 'eventListener',
		'in', 'out', 'localization',
	]);

	const CONTAINER_TYPES = new Set(['process', 'subProcess', 'transaction', 'collaboration']);

	function getElementChildren(element: XmlElement): XmlElement[] {
		return Array.from(element.childNodes).filter(
			(node): node is XmlElement => node.nodeType === 1,
		);
	}

	function parseChildren(parent: XmlElement): BpmnNodeInfo[] {
		const nodes: BpmnNodeInfo[] = [];

		for (const child of getElementChildren(parent)) {
			const type = getLocalName(child.nodeName);

			if (SKIP_TYPES.has(type)) {
				continue;
			}

			const id = child.getAttribute('id') || '';
			if (!id) {
				continue;
			}

			const name = child.getAttribute('name') || '';
			const node: BpmnNodeInfo = {
				id,
				name: name || id,
				type,
				children: CONTAINER_TYPES.has(type) ? parseChildren(child) : [],
			};

			nodes.push(node);
		}

		return nodes;
	}

	roots.push(...parseChildren(definitions));

	return roots;
}

class BpmnTreeItem extends vscode.TreeItem {
	constructor(
		public readonly nodeInfo: BpmnNodeInfo,
		public readonly hasChildren: boolean,
	) {
		super(
			nodeInfo.name,
			hasChildren
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None,
		);

		this.description = nodeInfo.id !== nodeInfo.name ? nodeInfo.id : undefined;
		this.tooltip = `${formatLabel(nodeInfo.type)}: ${nodeInfo.name} (${nodeInfo.id})`;
		this.iconPath = ELEMENT_ICONS[nodeInfo.type] || new vscode.ThemeIcon('symbol-misc');
		this.contextValue = nodeInfo.type;
	}
}

export class ProcessNavigatorProvider implements vscode.TreeDataProvider<BpmnTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<BpmnTreeItem | undefined | null>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private roots: BpmnNodeInfo[] = [];
	private nodeMap = new Map<string, BpmnTreeItem>();

	refresh(xml?: string): void {
		this.nodeMap.clear();
		if (xml) {
			this.roots = parseProcessElements(xml);
		} else {
			this.roots = [];
		}
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: BpmnTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BpmnTreeItem): BpmnTreeItem[] {
		const nodes = element ? element.nodeInfo.children : this.roots;
		return nodes.map((node) => {
			const item = new BpmnTreeItem(node, node.children.length > 0);
			this.nodeMap.set(node.id, item);
			return item;
		});
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
	}
}

export function registerProcessNavigator(context: vscode.ExtensionContext): ProcessNavigatorProvider {
	const provider = new ProcessNavigatorProvider();

	const treeView = vscode.window.createTreeView('flowable-bpmn-designer.processNavigator', {
		treeDataProvider: provider,
	});
	context.subscriptions.push(treeView);

	// Refresh when the active custom editor changes
	const refreshFromDocument = () => {
		const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
		const bpmnTab = tabs.find(tab => {
			const input = tab.input as { viewType?: string } | undefined;
			return input?.viewType === BPMN_EDITOR_VIEW_TYPE;
		});
		if (bpmnTab) {
			const input = bpmnTab.input as { uri?: vscode.Uri };
			if (input.uri) {
				vscode.workspace.openTextDocument(input.uri).then(doc => {
					provider.refresh(doc.getText());
				}, () => {
					provider.refresh();
				});
			}
		} else {
			provider.refresh();
		}
	};

	// Refresh when text document is saved or changed
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (doc.fileName.match(/\.bpmn2?$/i) || doc.fileName.endsWith('.bpmn20.xml')) {
				provider.refresh(doc.getText());
			}
		}),
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			const doc = event.document;
			if (doc.fileName.match(/\.bpmn2?$/i) || doc.fileName.endsWith('.bpmn20.xml')) {
				provider.refresh(doc.getText());
			}
		}),
	);

	// Refresh on tab change
	context.subscriptions.push(
		vscode.window.tabGroups.onDidChangeTabs(() => {
			refreshFromDocument();
		}),
	);

	// Initial refresh
	refreshFromDocument();

	return provider;
}
