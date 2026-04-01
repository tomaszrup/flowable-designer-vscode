export interface BpmnBusinessObject {
	id: string;
	$type: string;
	name?: string;
	[key: string]: unknown;
}

export interface BpmnElement {
	id: string;
	type: string;
	businessObject: BpmnBusinessObject;
}

export function getBusinessObject(element: BpmnElement): BpmnBusinessObject {
	return element.businessObject || (element as unknown as BpmnBusinessObject);
}

export function getElementId(element: BpmnElement): string {
	return getBusinessObject(element).id || element.id;
}

export function getElementType(element: BpmnElement): string {
	return getBusinessObject(element).$type || element.type;
}

export function isUserTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:UserTask';
}

export function isServiceTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:ServiceTask';
}

export function isStartEvent(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:StartEvent';
}

export function isProcess(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:Process';
}

export function isSequenceFlow(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:SequenceFlow';
}

export function isScriptTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:ScriptTask';
}

export function isBusinessRuleTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:BusinessRuleTask';
}

export function isCallActivity(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:CallActivity';
}

export function isMailTask(element: BpmnElement): boolean {
	if (!isServiceTask(element)) { return false; }
	const bo = getBusinessObject(element);
	return bo.$type === 'bpmn:ServiceTask' && (bo as Record<string, unknown>)['activiti:type'] === 'mail';
}

export function isHttpTask(element: BpmnElement): boolean {
	if (!isServiceTask(element)) { return false; }
	const bo = getBusinessObject(element);
	return bo.$type === 'bpmn:ServiceTask' && (bo as Record<string, unknown>)['activiti:type'] === 'http';
}

export function isShellTask(element: BpmnElement): boolean {
	if (!isServiceTask(element)) { return false; }
	const bo = getBusinessObject(element);
	return bo.$type === 'bpmn:ServiceTask' && (bo as Record<string, unknown>)['activiti:type'] === 'shell';
}

export function isExternalWorkerTask(element: BpmnElement): boolean {
	if (!isServiceTask(element)) { return false; }
	const bo = getBusinessObject(element);
	return bo.$type === 'bpmn:ServiceTask' && (bo as Record<string, unknown>)['activiti:type'] === 'external-worker';
}

export function isGenericServiceTask(element: BpmnElement): boolean {
	return isServiceTask(element) && !isMailTask(element) && !isHttpTask(element) && !isShellTask(element) && !isExternalWorkerTask(element);
}

export function isSendTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:SendTask';
}

export function isReceiveTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:ReceiveTask';
}

export function isManualTask(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:ManualTask';
}

export function isActivity(element: BpmnElement): boolean {
	const type = getElementType(element);
	return type === 'bpmn:UserTask' || type === 'bpmn:ServiceTask' || type === 'bpmn:ScriptTask'
		|| type === 'bpmn:BusinessRuleTask' || type === 'bpmn:CallActivity'
		|| type === 'bpmn:SendTask' || type === 'bpmn:ReceiveTask' || type === 'bpmn:ManualTask'
		|| type === 'bpmn:SubProcess' || type === 'bpmn:Transaction';
}

export function isGateway(element: BpmnElement): boolean {
	const type = getElementType(element);
	return type === 'bpmn:ExclusiveGateway' || type === 'bpmn:InclusiveGateway'
		|| type === 'bpmn:ParallelGateway' || type === 'bpmn:EventBasedGateway'
		|| type === 'bpmn:ComplexGateway';
}

export function isTextAnnotation(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:TextAnnotation';
}

export function isParticipant(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:Participant';
}

export function isLane(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:Lane';
}

export function isSubProcess(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:SubProcess';
}

export function isTransaction(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:Transaction';
}

export function isEventSubProcess(element: BpmnElement): boolean {
	if (!isSubProcess(element)) { return false; }
	const bo = getBusinessObject(element);
	return bo.triggeredByEvent === true;
}

export function isSubProcessType(element: BpmnElement): boolean {
	return isSubProcess(element) || isTransaction(element);
}

export function isFlowNode(element: BpmnElement): boolean {
	return isActivity(element) || isGateway(element) || isStartEvent(element)
		|| isEndEvent(element) || isBoundaryEvent(element)
		|| isIntermediateCatchEvent(element) || isIntermediateThrowEvent(element);
}

export function isBoundaryEvent(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:BoundaryEvent';
}

export function isEndEvent(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:EndEvent';
}

export function isIntermediateCatchEvent(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:IntermediateCatchEvent';
}

export function isIntermediateThrowEvent(element: BpmnElement): boolean {
	return getElementType(element) === 'bpmn:IntermediateThrowEvent';
}

export function isEventElement(element: BpmnElement): boolean {
	return isStartEvent(element) || isEndEvent(element) || isBoundaryEvent(element)
		|| isIntermediateCatchEvent(element) || isIntermediateThrowEvent(element);
}

export function getEventDefinitionType(element: BpmnElement): string | null {
	const bo = getBusinessObject(element);
	const eventDefs = bo.eventDefinitions as Array<{ $type: string }> | undefined;
	if (!eventDefs || eventDefs.length === 0) { return null; }
	return eventDefs[0].$type || null;
}
