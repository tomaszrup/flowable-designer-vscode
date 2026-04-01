import { type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import type { BpmnValidationIssue } from '../shared/messages';
import { parseXmlDocument } from './xmlParser';

const FLOW_ELEMENTS = new Set([
	'startEvent', 'endEvent', 'userTask', 'serviceTask', 'scriptTask',
	'businessRuleTask', 'sendTask', 'receiveTask', 'manualTask', 'callActivity',
	'subProcess', 'transaction', 'exclusiveGateway', 'inclusiveGateway',
	'parallelGateway', 'eventBasedGateway', 'complexGateway',
	'boundaryEvent', 'intermediateCatchEvent', 'intermediateThrowEvent',
]);

function getLocalName(node: XmlNode): string {
	return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function getElementChildren(element: XmlElement): XmlElement[] {
	return Array.from(element.childNodes).filter(
		(node): node is XmlElement => node.nodeType === node.ELEMENT_NODE,
	);
}

interface SequenceFlow {
	id: string;
	sourceRef: string;
	targetRef: string;
	hasCondition: boolean;
}

function collectProcessElements(
	processElement: XmlElement,
	issues: BpmnValidationIssue[],
): { flowNodeIds: Set<string>; sequenceFlows: SequenceFlow[]; startEventCount: number; endEventCount: number } {
	const flowNodeIds = new Set<string>();
	const sequenceFlows: SequenceFlow[] = [];
	const gatewaysWithoutDefault: string[] = [];
	let startEventCount = 0;
	let endEventCount = 0;

	for (const child of getElementChildren(processElement)) {
		const localName = getLocalName(child);
		const id = child.getAttribute('id') || '';

		if (localName === 'sequenceFlow') {
			const sourceRef = child.getAttribute('sourceRef') || '';
			const targetRef = child.getAttribute('targetRef') || '';
			if (!sourceRef) {
				issues.push({ elementId: id, message: `Sequence flow '${id}' is missing sourceRef`, severity: 'error' });
			}
			if (!targetRef) {
				issues.push({ elementId: id, message: `Sequence flow '${id}' is missing targetRef`, severity: 'error' });
			}
			const hasCondition = getElementChildren(child).some((c) => getLocalName(c) === 'conditionExpression');
			sequenceFlows.push({ id, sourceRef, targetRef, hasCondition });
			continue;
		}

		if (FLOW_ELEMENTS.has(localName)) {
			if (!id) {
				issues.push({ elementId: '', message: `${localName} element is missing an id attribute`, severity: 'error' });
			} else {
				flowNodeIds.add(id);
			}

			if (localName === 'startEvent') {
				startEventCount++;
			}
			if (localName === 'endEvent') {
				endEventCount++;
			}

			// Check service task has implementation
			if (localName === 'serviceTask') {
				const hasClass = child.getAttribute('activiti:class') || child.getAttribute('class');
				const hasExpression = child.getAttribute('activiti:expression') || child.getAttribute('expression');
				const hasDelegate = child.getAttribute('activiti:delegateExpression') || child.getAttribute('delegateExpression');
				const hasType = child.getAttribute('activiti:type') || child.getAttribute('type');
				if (!hasClass && !hasExpression && !hasDelegate && !hasType) {
					issues.push({ elementId: id, message: `Service task '${id}' has no implementation (class, expression, delegateExpression, or type)`, severity: 'warning' });
				}

				// Validate http task required fields
				const taskType = child.getAttribute('activiti:type') || child.getAttribute('type') || '';
				if (taskType === 'http') {
					const extElements = getElementChildren(child).find((c) => getLocalName(c) === 'extensionElements');
					const fields = extElements ? getElementChildren(extElements).filter((c) => getLocalName(c) === 'field') : [];
					const fieldNames = new Set(fields.map((f) => f.getAttribute('name') || ''));
					if (!fieldNames.has('requestMethod')) {
						issues.push({ elementId: id, message: `Http task '${id}' is missing required field 'requestMethod'`, severity: 'warning' });
					}
					if (!fieldNames.has('requestUrl')) {
						issues.push({ elementId: id, message: `Http task '${id}' is missing required field 'requestUrl'`, severity: 'warning' });
					}
				}

				// Validate shell task required fields
				if (taskType === 'shell') {
					const extElements = getElementChildren(child).find((c) => getLocalName(c) === 'extensionElements');
					const fields = extElements ? getElementChildren(extElements).filter((c) => getLocalName(c) === 'field') : [];
					const fieldNames = new Set(fields.map((f) => f.getAttribute('name') || ''));
					if (!fieldNames.has('command')) {
						issues.push({ elementId: id, message: `Shell task '${id}' is missing required field 'command'`, severity: 'warning' });
					}
				}

				// Validate external worker task required fields
				if (taskType === 'external-worker') {
					const extElements = getElementChildren(child).find((c) => getLocalName(c) === 'extensionElements');
					const fields = extElements ? getElementChildren(extElements).filter((c) => getLocalName(c) === 'field') : [];
					const fieldNames = new Set(fields.map((f) => f.getAttribute('name') || ''));
					if (!fieldNames.has('topic')) {
						issues.push({ elementId: id, message: `External worker task '${id}' is missing required field 'topic'`, severity: 'warning' });
					}
				}
			}

			// Check script task has script
			if (localName === 'scriptTask') {
				let hasScript = false;
				for (const scriptChild of getElementChildren(child)) {
					if (getLocalName(scriptChild) === 'script') {
						hasScript = true;
					}
				}
				if (!hasScript) {
					issues.push({ elementId: id, message: `Script task '${id}' has no script element`, severity: 'warning' });
				}
			}

			// Check exclusive/inclusive gateway has default flow when conditions exist
			if (localName === 'exclusiveGateway' || localName === 'inclusiveGateway') {
				const defaultFlow = child.getAttribute('default') || '';
				if (!defaultFlow) {
					// Collect later — need full sequence flow info; mark for post-check
					gatewaysWithoutDefault.push(id);
				}
			}

			// Check async tasks have valid failedJobRetryTimeCycle
			if (child.getAttribute('activiti:async') === 'true' || child.getAttribute('async') === 'true') {
				const extElements = getElementChildren(child).find((c) => getLocalName(c) === 'extensionElements');
				if (extElements) {
					for (const extChild of getElementChildren(extElements)) {
						if (getLocalName(extChild) === 'failedJobRetryTimeCycle') {
							const value = (extChild.textContent || '').trim();
							if (value && !/^R\d*\//.test(value)) {
								issues.push({ elementId: id, message: `Element '${id}' has invalid failedJobRetryTimeCycle '${value}' (expected ISO 8601 repeat pattern like R3/PT10M)`, severity: 'warning' });
							}
						}
					}
				}
			}

			// Check user task has assignee or candidate
			if (localName === 'userTask') {
				const hasAssignee = child.getAttribute('activiti:assignee') || child.getAttribute('assignee');
				const hasCandidateUsers = child.getAttribute('activiti:candidateUsers') || child.getAttribute('candidateUsers');
				const hasCandidateGroups = child.getAttribute('activiti:candidateGroups') || child.getAttribute('candidateGroups');
				if (!hasAssignee && !hasCandidateUsers && !hasCandidateGroups) {
					issues.push({ elementId: id, message: `User task '${id}' has no assignee or candidate users/groups`, severity: 'warning' });
				}
			}

			// Check transaction subprocess has cancel boundary event
			if (localName === 'transaction') {
				const boundaryEvents = getElementChildren(processElement).filter(
					(sibling) => getLocalName(sibling) === 'boundaryEvent' && sibling.getAttribute('attachedToRef') === id,
				);
				const hasCancelBoundary = boundaryEvents.some((be) =>
					getElementChildren(be).some((c) => getLocalName(c) === 'cancelEventDefinition'),
				);
				if (!hasCancelBoundary) {
					issues.push({ elementId: id, message: `Transaction subprocess '${id}' should have a cancel boundary event`, severity: 'warning' });
				}
			}

			// Recurse into subprocesses
			if (localName === 'subProcess' || localName === 'transaction') {
				const sub = collectProcessElements(child, issues);
				for (const nodeId of sub.flowNodeIds) {
					flowNodeIds.add(nodeId);
				}
				sequenceFlows.push(...sub.sequenceFlows);
			}
		}
	}

	// Check gateways without default flow that have conditional outgoing flows
	for (const gatewayId of gatewaysWithoutDefault) {
		const outgoingFlows = sequenceFlows.filter((f) => f.sourceRef === gatewayId);
		const hasConditionalFlows = outgoingFlows.some((f) => f.hasCondition);
		if (hasConditionalFlows && outgoingFlows.length > 1) {
			issues.push({ elementId: gatewayId, message: `Gateway '${gatewayId}' has conditional flows but no default flow`, severity: 'warning' });
		}
	}

	return { flowNodeIds, sequenceFlows, startEventCount, endEventCount };
}

export function validateBpmnXml(xml: string): BpmnValidationIssue[] {
	const issues: BpmnValidationIssue[] = [];

	let document;
	try {
		document = parseXmlDocument(xml);
	} catch {
		issues.push({ elementId: '', message: 'Invalid XML document', severity: 'error' });
		return issues;
	}

	const definitions = document.documentElement;
	if (!definitions || getLocalName(definitions) !== 'definitions') {
		issues.push({ elementId: '', message: 'Missing <definitions> root element', severity: 'error' });
		return issues;
	}

	// Check for at least one process
	const processes = Array.from(document.getElementsByTagName('process'));
	if (processes.length === 0) {
		// Check for collaboration with participants
		const participants = Array.from(document.getElementsByTagName('participant'));
		if (participants.length === 0) {
			issues.push({ elementId: '', message: 'No <process> element found in the document', severity: 'error' });
			return issues;
		}
	}

	for (const process of processes) {
		const processId = process.getAttribute('id') || '';
		if (!processId) {
			issues.push({ elementId: '', message: 'Process element is missing an id attribute', severity: 'error' });
			continue;
		}

		const { flowNodeIds, sequenceFlows, startEventCount, endEventCount } = collectProcessElements(process as XmlElement, issues);

		// Check process has start event
		if (startEventCount === 0) {
			issues.push({ elementId: processId, message: `Process '${processId}' has no start event`, severity: 'warning' });
		}

		// Check process has end event
		if (endEventCount === 0) {
			issues.push({ elementId: processId, message: `Process '${processId}' has no end event`, severity: 'warning' });
		}

		// Check sequence flow references exist
		for (const flow of sequenceFlows) {
			if (flow.sourceRef && !flowNodeIds.has(flow.sourceRef)) {
				issues.push({ elementId: flow.id, message: `Sequence flow '${flow.id}' references non-existent source '${flow.sourceRef}'`, severity: 'error' });
			}
			if (flow.targetRef && !flowNodeIds.has(flow.targetRef)) {
				issues.push({ elementId: flow.id, message: `Sequence flow '${flow.id}' references non-existent target '${flow.targetRef}'`, severity: 'error' });
			}
		}

		// Check for unreachable nodes (nodes with no incoming sequence flow, except start events)
		const nodesWithIncoming = new Set<string>();
		const nodesWithOutgoing = new Set<string>();
		for (const flow of sequenceFlows) {
			if (flow.targetRef) { nodesWithIncoming.add(flow.targetRef); }
			if (flow.sourceRef) { nodesWithOutgoing.add(flow.sourceRef); }
		}

		// Build a lookup map of id -> localName for flow nodes
		const nodeTypeMap = new Map<string, string>();
		const allElements = document.getElementsByTagName('*');
		for (let i = 0; i < allElements.length; i++) {
			const el = allElements[i];
			const elId = el?.getAttribute('id');
			if (elId && flowNodeIds.has(elId)) {
				nodeTypeMap.set(elId, getLocalName(el));
			}
		}

		for (const nodeId of flowNodeIds) {
			const localName = nodeTypeMap.get(nodeId);
			if (!localName) { continue; }
			// Start events and boundary events don't need incoming flows
			if (localName !== 'startEvent' && localName !== 'boundaryEvent') {
				if (!nodesWithIncoming.has(nodeId)) {
					issues.push({ elementId: nodeId, message: `Element '${nodeId}' has no incoming sequence flow`, severity: 'warning' });
				}
			}
			// End events don't need outgoing flows
			if (localName !== 'endEvent') {
				if (!nodesWithOutgoing.has(nodeId)) {
					issues.push({ elementId: nodeId, message: `Element '${nodeId}' has no outgoing sequence flow`, severity: 'warning' });
				}
			}
		}
	}

	return issues;
}
