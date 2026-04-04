import { type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import type { BpmnValidationIssue } from '../shared/messages';
import {
	getActivitiAttribute,
	getElementsByLocalName,
} from './roundTrip/xmlUtils';
import { parseXmlDocument } from './xmlParser';

const FLOW_ELEMENTS = new Set([
	'startEvent', 'endEvent', 'userTask', 'serviceTask', 'scriptTask',
	'businessRuleTask', 'sendTask', 'receiveTask', 'manualTask', 'callActivity',
	'subProcess', 'transaction', 'exclusiveGateway', 'inclusiveGateway',
	'parallelGateway', 'eventBasedGateway', 'complexGateway',
	'boundaryEvent', 'intermediateCatchEvent', 'intermediateThrowEvent',
]);

interface SequenceFlow {
	id: string;
	sourceRef: string;
	targetRef: string;
	hasCondition: boolean;
}

interface ProcessElementCollection {
	flowNodeIds: Set<string>;
	sequenceFlows: SequenceFlow[];
	gatewaysWithoutDefault: string[];
	startEventCount: number;
	endEventCount: number;
}

interface FlowNodeMetadata {
	localName: string;
	skipIncomingValidation: boolean;
	skipOutgoingValidation: boolean;
}

function getLocalName(node: XmlNode): string {
	return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function getElementChildren(element: XmlElement): XmlElement[] {
	return Array.from(element.childNodes).filter(
		(node): node is XmlElement => node.nodeType === node.ELEMENT_NODE,
	);
}

function createProcessElementCollection(): ProcessElementCollection {
	return {
		flowNodeIds: new Set<string>(),
		sequenceFlows: [],
		gatewaysWithoutDefault: [],
		startEventCount: 0,
		endEventCount: 0,
	};
}

function getExtensionFieldNames(element: XmlElement): Set<string> {
	const extensionElements = getElementChildren(element).find((child) => getLocalName(child) === 'extensionElements');
	const fields = extensionElements
		? getElementChildren(extensionElements).filter((child) => getLocalName(child) === 'field')
		: [];
	return new Set(fields.map((field) => field.getAttribute('name') || ''));
}

function collectSequenceFlowElement(child: XmlElement, issues: BpmnValidationIssue[], sequenceFlows: SequenceFlow[]): void {
	const id = child.getAttribute('id') || '';
	const sourceRef = child.getAttribute('sourceRef') || '';
	const targetRef = child.getAttribute('targetRef') || '';
	if (sourceRef === '') {
		issues.push({ elementId: id, message: `Sequence flow '${id}' is missing sourceRef`, severity: 'error' });
	}
	if (targetRef === '') {
		issues.push({ elementId: id, message: `Sequence flow '${id}' is missing targetRef`, severity: 'error' });
	}
	const hasCondition = getElementChildren(child).some((candidate) => getLocalName(candidate) === 'conditionExpression');
	sequenceFlows.push({ id, sourceRef, targetRef, hasCondition });
}

function collectFlowNodeId(localName: string, id: string, issues: BpmnValidationIssue[], flowNodeIds: Set<string>): void {
	if (id === '') {
		issues.push({ elementId: '', message: `${localName} element is missing an id attribute`, severity: 'error' });
		return;
	}
	if (flowNodeIds.has(id)) {
		issues.push({ elementId: id, message: `Duplicate flow node id '${id}' found in the same process`, severity: 'error' });
		return;
	}
	flowNodeIds.add(id);
}

function updateProcessEventCounts(localName: string, collection: ProcessElementCollection): void {
	if (localName === 'startEvent') {
		collection.startEventCount++;
	}
	if (localName === 'endEvent') {
		collection.endEventCount++;
	}
}

function validateServiceTaskElement(child: XmlElement, id: string, issues: BpmnValidationIssue[]): void {
	const hasClass = getActivitiAttribute(child, 'class') || child.getAttribute('class');
	const hasExpression = getActivitiAttribute(child, 'expression') || child.getAttribute('expression');
	const hasDelegate = getActivitiAttribute(child, 'delegateExpression') || child.getAttribute('delegateExpression');
	const hasType = getActivitiAttribute(child, 'type') || child.getAttribute('type');
	if (!hasClass && !hasExpression && !hasDelegate && !hasType) {
		issues.push({ elementId: id, message: `Service task '${id}' has no implementation (class, expression, delegateExpression, or type)`, severity: 'warning' });
	}

	const taskType = getActivitiAttribute(child, 'type') || child.getAttribute('type') || '';
	const fieldNames = getExtensionFieldNames(child);
	if (taskType === 'http') {
		if (!fieldNames.has('requestMethod')) {
			issues.push({ elementId: id, message: `Http task '${id}' is missing required field 'requestMethod'`, severity: 'warning' });
		}
		if (!fieldNames.has('requestUrl')) {
			issues.push({ elementId: id, message: `Http task '${id}' is missing required field 'requestUrl'`, severity: 'warning' });
		}
	}
	if (taskType === 'shell' && !fieldNames.has('command')) {
		issues.push({ elementId: id, message: `Shell task '${id}' is missing required field 'command'`, severity: 'warning' });
	}
	if (taskType === 'external-worker' && !fieldNames.has('topic')) {
		issues.push({ elementId: id, message: `External worker task '${id}' is missing required field 'topic'`, severity: 'warning' });
	}
}

function validateScriptTaskElement(child: XmlElement, id: string, issues: BpmnValidationIssue[]): void {
	const hasScript = getElementChildren(child).some((scriptChild) => getLocalName(scriptChild) === 'script');
	if (!hasScript) {
		issues.push({ elementId: id, message: `Script task '${id}' has no script element`, severity: 'warning' });
	}
}

function collectGatewayWithoutDefault(localName: string, child: XmlElement, id: string, gatewaysWithoutDefault: string[]): void {
	const isDefaultGateway = localName === 'exclusiveGateway' || localName === 'inclusiveGateway';
	if (isDefaultGateway && (child.getAttribute('default') || '') === '') {
		gatewaysWithoutDefault.push(id);
	}
}

function validateAsyncRetryElement(child: XmlElement, id: string, issues: BpmnValidationIssue[]): void {
	const isAsync = getActivitiAttribute(child, 'async') === 'true' || child.getAttribute('async') === 'true';
	if (!isAsync) {
		return;
	}

	const extensionElements = getElementChildren(child).find((candidate) => getLocalName(candidate) === 'extensionElements');
	if (!extensionElements) {
		return;
	}

	for (const extensionChild of getElementChildren(extensionElements)) {
		if (getLocalName(extensionChild) !== 'failedJobRetryTimeCycle') {
			continue;
		}
		const value = (extensionChild.textContent || '').trim();
		if (value && !/^R\d*\//.test(value)) {
			issues.push({ elementId: id, message: `Element '${id}' has invalid failedJobRetryTimeCycle '${value}' (expected ISO 8601 repeat pattern like R3/PT10M)`, severity: 'warning' });
		}
	}
}

function validateUserTaskElement(child: XmlElement, id: string, issues: BpmnValidationIssue[]): void {
	const hasAssignee = getActivitiAttribute(child, 'assignee') || child.getAttribute('assignee');
	const hasCandidateUsers = getActivitiAttribute(child, 'candidateUsers') || child.getAttribute('candidateUsers');
	const hasCandidateGroups = getActivitiAttribute(child, 'candidateGroups') || child.getAttribute('candidateGroups');
	if (!hasAssignee && !hasCandidateUsers && !hasCandidateGroups) {
		issues.push({ elementId: id, message: `User task '${id}' has no assignee or candidate users/groups`, severity: 'warning' });
	}
}

function validateTransactionElement(processElement: XmlElement, id: string, issues: BpmnValidationIssue[]): void {
	const boundaryEvents = getElementChildren(processElement).filter(
		(sibling) => getLocalName(sibling) === 'boundaryEvent' && sibling.getAttribute('attachedToRef') === id,
	);
	const hasCancelBoundary = boundaryEvents.some((boundaryEvent) =>
		getElementChildren(boundaryEvent).some((candidate) => getLocalName(candidate) === 'cancelEventDefinition'),
	);
	if (!hasCancelBoundary) {
		issues.push({ elementId: id, message: `Transaction subprocess '${id}' should have a cancel boundary event`, severity: 'warning' });
	}
}

function mergeCollectedSubprocess(collection: ProcessElementCollection, nested: ProcessElementCollection): void {
	for (const nodeId of nested.flowNodeIds) {
		collection.flowNodeIds.add(nodeId);
	}
	collection.sequenceFlows.push(...nested.sequenceFlows);
}

function validateFlowElement(
	child: XmlElement,
	localName: string,
	id: string,
	processElement: XmlElement,
	issues: BpmnValidationIssue[],
	collection: ProcessElementCollection,
): void {
	collectFlowNodeId(localName, id, issues, collection.flowNodeIds);
	updateProcessEventCounts(localName, collection);
	if (localName === 'serviceTask') {
		validateServiceTaskElement(child, id, issues);
	}
	if (localName === 'scriptTask') {
		validateScriptTaskElement(child, id, issues);
	}
	collectGatewayWithoutDefault(localName, child, id, collection.gatewaysWithoutDefault);
	validateAsyncRetryElement(child, id, issues);
	if (localName === 'userTask') {
		validateUserTaskElement(child, id, issues);
	}
	if (localName === 'transaction') {
		validateTransactionElement(processElement, id, issues);
	}
	if (localName === 'subProcess' || localName === 'transaction') {
		mergeCollectedSubprocess(collection, collectProcessElements(child, issues));
	}
}

function validateGatewayDefaultFlows(collection: ProcessElementCollection, issues: BpmnValidationIssue[]): void {
	for (const gatewayId of collection.gatewaysWithoutDefault) {
		const outgoingFlows = collection.sequenceFlows.filter((sequenceFlow) => sequenceFlow.sourceRef === gatewayId);
		const hasConditionalFlows = outgoingFlows.some((sequenceFlow) => sequenceFlow.hasCondition);
		if (hasConditionalFlows && outgoingFlows.length > 1) {
			issues.push({ elementId: gatewayId, message: `Gateway '${gatewayId}' has conditional flows but no default flow`, severity: 'warning' });
		}
	}
}

function collectProcessElements(
	processElement: XmlElement,
	issues: BpmnValidationIssue[],
): ProcessElementCollection {
	const collection = createProcessElementCollection();

	for (const child of getElementChildren(processElement)) {
		const localName = getLocalName(child);
		if (localName === 'sequenceFlow') {
			collectSequenceFlowElement(child, issues, collection.sequenceFlows);
			continue;
		}
		if (!FLOW_ELEMENTS.has(localName)) {
			continue;
		}
		const id = child.getAttribute('id') || '';
		validateFlowElement(child, localName, id, processElement, issues, collection);
	}

	validateGatewayDefaultFlows(collection, issues);
	return collection;
}

function validateDefinitionsRoot(document: ReturnType<typeof parseXmlDocument>, issues: BpmnValidationIssue[]): boolean {
	const definitions = document.documentElement;
	if (!definitions || getLocalName(definitions) !== 'definitions') {
		issues.push({ elementId: '', message: 'Missing <definitions> root element', severity: 'error' });
		return false;
	}
	return true;
}

function validateParticipantProcessReferences(
	document: ReturnType<typeof parseXmlDocument>,
	processes: XmlElement[],
	issues: BpmnValidationIssue[],
): void {
	const processIds = new Set(processes
		.map((process) => process.getAttribute('id') || '')
		.filter((processId) => processId !== ''));

	for (const participant of getElementsByLocalName(document, 'participant')) {
		const participantId = participant.getAttribute('id') || '';
		const processRef = participant.getAttribute('processRef') || '';
		if (processRef && !processIds.has(processRef)) {
			issues.push({
				elementId: participantId,
				message: `Participant '${participantId || processRef}' references non-existent process '${processRef}'`,
				severity: 'error',
			});
		}
	}
}

function validateProcessPresence(document: ReturnType<typeof parseXmlDocument>, issues: BpmnValidationIssue[]): XmlElement[] | undefined {
	const processes = getElementsByLocalName(document, 'process');
	if (processes.length > 0) {
		return processes;
	}
	const participants = getElementsByLocalName(document, 'participant');
	if (participants.length === 0) {
		issues.push({ elementId: '', message: 'No <process> element found in the document', severity: 'error' });
		return undefined;
	}
	return processes;
}

function validateProcessEventCounts(
	processId: string,
	startEventCount: number,
	endEventCount: number,
	issues: BpmnValidationIssue[],
): void {
	if (startEventCount === 0) {
		issues.push({ elementId: processId, message: `Process '${processId}' has no start event`, severity: 'warning' });
	}
	if (endEventCount === 0) {
		issues.push({ elementId: processId, message: `Process '${processId}' has no end event`, severity: 'warning' });
	}
}

function validateSequenceFlowReferences(sequenceFlows: SequenceFlow[], flowNodeIds: Set<string>, issues: BpmnValidationIssue[]): void {
	for (const flow of sequenceFlows) {
		if (flow.sourceRef && !flowNodeIds.has(flow.sourceRef)) {
			issues.push({ elementId: flow.id, message: `Sequence flow '${flow.id}' references non-existent source '${flow.sourceRef}'`, severity: 'error' });
		}
		if (flow.targetRef && !flowNodeIds.has(flow.targetRef)) {
			issues.push({ elementId: flow.id, message: `Sequence flow '${flow.id}' references non-existent target '${flow.targetRef}'`, severity: 'error' });
		}
	}
}

function buildNodeDirectionSets(sequenceFlows: SequenceFlow[]): { nodesWithIncoming: Set<string>; nodesWithOutgoing: Set<string> } {
	const nodesWithIncoming = new Set<string>();
	const nodesWithOutgoing = new Set<string>();
	for (const flow of sequenceFlows) {
		if (flow.targetRef) {
			nodesWithIncoming.add(flow.targetRef);
		}
		if (flow.sourceRef) {
			nodesWithOutgoing.add(flow.sourceRef);
		}
	}
	return { nodesWithIncoming, nodesWithOutgoing };
}

function isCompensationHandler(element: XmlElement): boolean {
	return (getActivitiAttribute(element, 'isForCompensation') || element.getAttribute('isForCompensation') || '') === 'true';
}

function isCompensationBoundaryEvent(element: XmlElement): boolean {
	return getLocalName(element) === 'boundaryEvent'
		&& getElementChildren(element).some((child) => getLocalName(child) === 'compensateEventDefinition');
}

function buildFlowNodeMetadataMap(document: ReturnType<typeof parseXmlDocument>, flowNodeIds: Set<string>): Map<string, FlowNodeMetadata> {
	const nodeMetadataMap = new Map<string, FlowNodeMetadata>();
	for (const element of Array.from(document.getElementsByTagName('*'))) {
		const elementId = element.getAttribute('id');
		if (elementId && flowNodeIds.has(elementId)) {
			const localName = getLocalName(element);
			nodeMetadataMap.set(elementId, {
				localName,
				skipIncomingValidation: localName === 'startEvent' || localName === 'boundaryEvent' || isCompensationHandler(element),
				skipOutgoingValidation: localName === 'endEvent' || isCompensationHandler(element) || isCompensationBoundaryEvent(element),
			});
		}
	}
	return nodeMetadataMap;
}

function validateNodeConnectivity(
	flowNodeIds: Set<string>,
	nodeMetadataMap: Map<string, FlowNodeMetadata>,
	nodesWithIncoming: Set<string>,
	nodesWithOutgoing: Set<string>,
	issues: BpmnValidationIssue[],
): void {
	for (const nodeId of flowNodeIds) {
		const metadata = nodeMetadataMap.get(nodeId);
		if (!metadata) {
			continue;
		}
		if (!metadata.skipIncomingValidation && !nodesWithIncoming.has(nodeId)) {
			issues.push({ elementId: nodeId, message: `Element '${nodeId}' has no incoming sequence flow`, severity: 'warning' });
		}
		if (!metadata.skipOutgoingValidation && !nodesWithOutgoing.has(nodeId)) {
			issues.push({ elementId: nodeId, message: `Element '${nodeId}' has no outgoing sequence flow`, severity: 'warning' });
		}
	}
}

function validateProcessElement(document: ReturnType<typeof parseXmlDocument>, process: XmlElement, issues: BpmnValidationIssue[]): void {
	const processId = process.getAttribute('id') || '';
	if (processId === '') {
		issues.push({ elementId: '', message: 'Process element is missing an id attribute', severity: 'error' });
		return;
	}

	const { flowNodeIds, sequenceFlows, startEventCount, endEventCount } = collectProcessElements(process, issues);
	validateProcessEventCounts(processId, startEventCount, endEventCount, issues);
	validateSequenceFlowReferences(sequenceFlows, flowNodeIds, issues);
	const { nodesWithIncoming, nodesWithOutgoing } = buildNodeDirectionSets(sequenceFlows);
	const nodeMetadataMap = buildFlowNodeMetadataMap(document, flowNodeIds);
	validateNodeConnectivity(flowNodeIds, nodeMetadataMap, nodesWithIncoming, nodesWithOutgoing, issues);
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

	if (!validateDefinitionsRoot(document, issues)) {
		return issues;
	}

	const processes = validateProcessPresence(document, issues);
	if (!processes) {
		return issues;
	}

	validateParticipantProcessReferences(document, processes, issues);

	for (const process of processes) {
		validateProcessElement(document, process, issues);
	}

	return issues;
}
