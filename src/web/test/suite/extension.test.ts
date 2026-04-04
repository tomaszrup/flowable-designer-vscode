import { describe, test, expect } from 'vitest';
import type { Element as XmlElement } from '@xmldom/xmldom';

function assertDefined<T>(val: T): asserts val is NonNullable<T> {
	if (typeof val === 'boolean') {
		expect(val).toBe(true);
		return;
	}
	expect(val).toBeDefined();
	expect(val).not.toBeNull();
}

import legacyDesignerFixture from '../../../../fixtures/flowable/legacy-designer-extension.bpmn?raw';
import legacyListenersFixture from '../../../../fixtures/flowable/legacy-listeners-formprops.bpmn?raw';
import legacyProcessMetadataFixture from '../../../../fixtures/flowable/legacy-process-task-metadata.bpmn?raw';
import legacyServiceTaskFixture from '../../../../fixtures/flowable/legacy-service-task.bpmn?raw';
import legacyUserTaskFixture from '../../../../fixtures/flowable/legacy-user-task.bpmn?raw';
import legacySequenceFlowFixture from '../../../../fixtures/flowable/legacy-sequence-flow.bpmn?raw';
import legacyScriptTaskFixture from '../../../../fixtures/flowable/legacy-script-task.bpmn?raw';
import legacyCallActivityFixture from '../../../../fixtures/flowable/legacy-call-activity.bpmn?raw';
import legacyMultiInstanceFixture from '../../../../fixtures/flowable/legacy-multi-instance.bpmn?raw';
import legacyMailTaskFixture from '../../../../fixtures/flowable/legacy-mail-task.bpmn?raw';
import legacyBoundaryEventsFixture from '../../../../fixtures/flowable/legacy-boundary-events.bpmn?raw';
import legacyEventTypesFixture from '../../../../fixtures/flowable/legacy-event-types.bpmn?raw';
import legacyPhase3Fixture from '../../../../fixtures/flowable/legacy-phase3-features.bpmn?raw';
import legacyPhase4Fixture from '../../../../fixtures/flowable/legacy-phase4-features.bpmn?raw';
import legacyPoolLanesFixture from '../../../../fixtures/flowable/legacy-pool-lanes.bpmn?raw';
import legacyPhase6Fixture from '../../../../fixtures/flowable/legacy-phase6-tasks.bpmn?raw';
import legacyTerminateAllFixture from '../../../../fixtures/flowable/legacy-terminate-all.bpmn?raw';
import legacyCompensationCancelFixture from '../../../../fixtures/flowable/legacy-compensation-cancel.bpmn?raw';
import legacyHttpTaskFixture from '../../../../fixtures/flowable/legacy-http-task.bpmn?raw';
import legacyShellTaskFixture from '../../../../fixtures/flowable/legacy-shell-task.bpmn?raw';
import legacyExternalWorkerFixture from '../../../../fixtures/flowable/legacy-external-worker-task.bpmn?raw';
import legacyAsyncRetryFixture from '../../../../fixtures/flowable/legacy-async-retry.bpmn?raw';
import legacyDataSignalExceptionsFixture from '../../../../fixtures/flowable/legacy-data-signal-exceptions.bpmn?raw';
import legacySubprocessFixture from '../../../../fixtures/flowable/legacy-subprocess.bpmn?raw';
import legacyCollapsedSubprocessFixture from '../../../../fixtures/flowable/legacy-collapsed-subprocess.bpmn?raw';
import legacyNestedCollapsedSubprocessFixture from '../../../../fixtures/flowable/legacy-nested-collapsed-subprocess.bpmn?raw';
import legacyMultiProcessFixture from '../../../../fixtures/flowable/legacy-multi-process.bpmn?raw';
import lexicalPreservationFixture from '../../../../fixtures/flowable/lexical-preservation-comments.bpmn?raw';
import lexicalManagedExtensionChildrenFixture from '../../../../fixtures/flowable/lexical-managed-extension-children.bpmn?raw';
import { extractFlowableDocumentState, mergeFlowableDocumentXml } from '../../flowable/roundTrip';
import { validateBpmnXml } from '../../flowable/validation';
import { parseXmlDocument } from '../../flowable/xmlParser';

function directChildElementNames(element: XmlElement): string[] {
	return Array.from(element.childNodes)
		.filter((node): node is XmlElement => node.nodeType === node.ELEMENT_NODE)
		.map((node) => node.localName || node.nodeName.split(':').pop() || node.nodeName);
}

function directChildElementIds(element: XmlElement): string[] {
	return Array.from(element.childNodes)
		.filter((node): node is XmlElement => node.nodeType === node.ELEMENT_NODE)
		.map((node) => node.getAttribute('id') || node.nodeName);
}

describe('Web Extension Test Suite', () => {

	test('extracts legacy user task Flowable attributes', () => {
		const state = extractFlowableDocumentState(legacyUserTaskFixture);
		const approveTask = state.elements.approveTask;

		assertDefined(approveTask);
		expect(approveTask.activitiAttributes.assignee).toBe('kermit');
		expect(approveTask.activitiAttributes.candidateGroups).toBe('management,reviewers');
		expect(approveTask.activitiAttributes.formKey).toBe('approvalForm');
		expect(state.namespaces.designer).toBe('http://activiti.org/designer/extensions');
	});

	test('preserves legacy designer extensions and namespaces on merge', () => {
		const state = extractFlowableDocumentState(legacyDesignerFixture);
		const strippedXml = legacyDesignerFixture
			.replace(' xmlns:designer="http://activiti.org/designer/extensions"', '')
			.replace(' xmlns:legacy="http://example.com/legacy"', '')
			.replace(' legacy:mode="strict"', '')
			.replace(/<extensionElements>[\s\S]*?<\/extensionElements>/, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyDesignerFixture, state);

		expect(mergedXml).toMatch(/xmlns:designer="http:\/\/activiti.org\/designer\/extensions"/);
		expect(mergedXml).toMatch(/xmlns:legacy="http:\/\/example.com\/legacy"/);
		expect(mergedXml).toMatch(/designer:editor-language/);
		expect(mergedXml).toMatch(/legacy:customFlag/);
		expect(mergedXml).toMatch(/legacy:mode="strict"/);
	});

	test('applies service task activiti attributes and field extensions during merge', () => {
		const state = extractFlowableDocumentState(legacyServiceTaskFixture);
		const serviceTaskState = state.elements.servicetask1;

		assertDefined(serviceTaskState);
		serviceTaskState.activitiAttributes.class = 'com.example.flowable.UpdatedDelegate';
		serviceTaskState.activitiAttributes.resultVariableName = 'updatedResult';
		serviceTaskState.fieldExtensions.push({
			id: 'field-added',
			name: 'tenantId',
			valueType: 'string',
			value: 'acme',
		});

		const strippedXml = legacyServiceTaskFixture
			.replace(' activiti:class="com.example.flowable.LegacyDelegate"', '')
			.replace(' activiti:resultVariableName="serviceResult"', '')
			.replace(/<extensionElements>[\s\S]*?<\/extensionElements>/, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyServiceTaskFixture, state);

		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.UpdatedDelegate"/);
		expect(mergedXml).toMatch(/activiti:resultVariableName="updatedResult"/);
		expect(mergedXml).toMatch(/<activiti:field name="endpoint">/);
		expect(mergedXml).toMatch(/<activiti:field name="tenantId">/);
	});

	test('extracts listeners and form properties from legacy Flowable XML', () => {
		const state = extractFlowableDocumentState(legacyListenersFixture);
		const startEvent = state.elements.startevent1;
		const reviewTask = state.elements.reviewTask;

		assertDefined(startEvent);
		assertDefined(reviewTask);
		expect(startEvent.activitiAttributes.formKey).toBe('startForm');
		expect(startEvent.activitiAttributes.initiator).toBe('initiatorUser');
		expect(startEvent.formProperties[0]?.id).toBe('approvalCode');
		expect(startEvent.executionListeners[0]?.implementation).toBe('com.example.StartListener');
		expect(reviewTask.taskListeners[0]?.implementationType).toBe('delegateExpression');
		expect(reviewTask.formProperties[0]?.type).toBe('enum');
	});

	test('extracts process starter settings and richer legacy task attributes', () => {
		const state = extractFlowableDocumentState(legacyProcessMetadataFixture);
		const processState = state.elements.legacyMetadataProcess;
		const reviewTask = state.elements.reviewTask;
		const serviceTask = state.elements.servicetask1;

		assertDefined(processState);
		assertDefined(reviewTask);
		assertDefined(serviceTask);
		expect(processState.activitiAttributes.candidateStarterUsers).toBe('kermit,gonzo');
		expect(processState.activitiAttributes.candidateStarterGroups).toBe('management,operations');
		expect(reviewTask.activitiAttributes.dueDate).toBe('${dueDate}');
		expect(reviewTask.activitiAttributes.priority).toBe('75');
		expect(reviewTask.activitiAttributes.category).toBe('human-review');
		expect(reviewTask.activitiAttributes.skipExpression).toBe('${skipReview}');
		expect(serviceTask.activitiAttributes.skipExpression).toBe('${skipService}');
	});

	test('merges listeners and form properties back into serialized BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyListenersFixture);
		state.elements.startevent1.executionListeners.push({
			id: 'start-end-listener',
			event: 'end',
			implementationType: 'expression',
			implementation: '${notifyEnd}',
		});
		state.elements.reviewTask.taskListeners.push({
			id: 'review-complete-listener',
			event: 'complete',
			implementationType: 'class',
			implementation: 'com.example.ReviewCompleteListener',
		});
		state.elements.reviewTask.formProperties.push({
			id: 'escalationReason',
			name: 'Escalation Reason',
			type: 'string',
			required: false,
			readable: true,
			writable: true,
			defaultValue: 'none',
		});

		const strippedXml = legacyListenersFixture
			.replace(/<extensionElements>[\s\S]*?<\/extensionElements>/g, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyListenersFixture, state);

		expect(mergedXml).toMatch(/activiti:formKey="startForm"/);
		expect(mergedXml).toMatch(/activiti:initiator="initiatorUser"/);
		expect(mergedXml).toMatch(/<activiti:executionListener event="start" activiti:class="com.example.StartListener"\/>/);
		expect(mergedXml).toMatch(/<activiti:executionListener event="end" activiti:expression="\$\{notifyEnd\}"\/>/);
		expect(mergedXml).toMatch(/<activiti:taskListener event="create" activiti:delegateExpression="\$\{taskCreateListener\}"\/>/);
		expect(mergedXml).toMatch(/<activiti:taskListener event="complete" activiti:class="com.example.ReviewCompleteListener"\/>/);
		expect(mergedXml).toMatch(/<activiti:formProperty id="approvalCode" name="Approval Code" type="string" required="true" readable="true" writable="true" default="A-1"\/>/);
		expect(mergedXml).toMatch(/<activiti:formProperty id="escalationReason" name="Escalation Reason" type="string" required="false" readable="true" writable="true" default="none"\/>/);
	});

	test('merges process starter settings and richer task metadata back into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyProcessMetadataFixture);
		state.elements.legacyMetadataProcess.activitiAttributes.candidateStarterUsers = 'fozzie';
		state.elements.legacyMetadataProcess.activitiAttributes.candidateStarterGroups = 'admins';
		state.elements.reviewTask.activitiAttributes.dueDate = '${updatedDueDate}';
		state.elements.reviewTask.activitiAttributes.priority = '90';
		state.elements.reviewTask.activitiAttributes.category = 'updated-category';
		state.elements.reviewTask.activitiAttributes.skipExpression = '${skipReviewUpdated}';
		state.elements.servicetask1.activitiAttributes.skipExpression = '${skipServiceUpdated}';

		const strippedXml = legacyProcessMetadataFixture
			.replace(' activiti:candidateStarterUsers="kermit,gonzo"', '')
			.replace(' activiti:candidateStarterGroups="management,operations"', '')
			.replace(' activiti:dueDate="${dueDate}"', '')
			.replace(' activiti:priority="75"', '')
			.replace(' activiti:category="human-review"', '')
			.replace(' activiti:skipExpression="${skipReview}"', '')
			.replace(' activiti:skipExpression="${skipService}"', '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyProcessMetadataFixture, state);

		expect(mergedXml).toMatch(/activiti:candidateStarterUsers="fozzie"/);
		expect(mergedXml).toMatch(/activiti:candidateStarterGroups="admins"/);
		expect(mergedXml).toMatch(/activiti:dueDate="\$\{updatedDueDate\}"/);
		expect(mergedXml).toMatch(/activiti:priority="90"/);
		expect(mergedXml).toMatch(/activiti:category="updated-category"/);
		expect(mergedXml).toMatch(/activiti:skipExpression="\$\{skipReviewUpdated\}"/);
		expect(mergedXml).toMatch(/activiti:skipExpression="\$\{skipServiceUpdated\}"/);
	});

	// Phase 1: Sequence Flow
	test('extracts condition expression and skip expression from sequence flows', () => {
		const state = extractFlowableDocumentState(legacySequenceFlowFixture);
		const flow2 = state.elements.flow2;
		const flow3 = state.elements.flow3;

		assertDefined(flow2);
		assertDefined(flow3);
		expect(flow2.conditionExpression).toBe('${approved == true}');
		expect(flow2.activitiAttributes.skipExpression).toBe('${skipApproval}');
		expect(flow3.conditionExpression).toBe('${approved == false}');
	});

	test('merges condition expression updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacySequenceFlowFixture);
		state.elements.flow2.conditionExpression = '${approved == "yes"}';
		state.elements.flow2.activitiAttributes.skipExpression = '${skipUpdated}';

		const strippedXml = legacySequenceFlowFixture
			.replace(/<conditionExpression[^>]*>\$\{approved == true\}<\/conditionExpression>/, '')
			.replace(' activiti:skipExpression="${skipApproval}"', '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacySequenceFlowFixture, state);

		expect(mergedXml).toMatch(/\$\{approved == "yes"\}/);
		expect(mergedXml).toMatch(/activiti:skipExpression="\$\{skipUpdated\}"/);
		expect(mergedXml).toMatch(/\$\{approved == false\}/);
	});

	// Phase 1: Script Task
	test('extracts script and scriptFormat from script tasks', () => {
		const state = extractFlowableDocumentState(legacyScriptTaskFixture);
		const scriptTask = state.elements.scripttask1;

		assertDefined(scriptTask);
		expect(scriptTask.script).toBe('def result = 10 + 20\nexecution.setVariable("total", result)');
	});

	test('merges script updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyScriptTaskFixture);
		state.elements.scripttask1.script = 'println "updated"';

		const strippedXml = legacyScriptTaskFixture
			.replace(/<script>[\s\S]*?<\/script>/, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyScriptTaskFixture, state);

		expect(mergedXml).toMatch(/<script>println "updated"<\/script>/);
	});

	// Phase 1: Call Activity
	test('extracts IO parameters from call activity', () => {
		const state = extractFlowableDocumentState(legacyCallActivityFixture);
		const callActivity = state.elements.callactivity1;

		assertDefined(callActivity);
		expect(callActivity.inputParameters.length).toBe(2);
		expect(callActivity.inputParameters[0].source).toBe('mainVar');
		expect(callActivity.inputParameters[0].target).toBe('subVar');
		expect(callActivity.inputParameters[1].sourceExpression).toBe('${mainExpr}');
		expect(callActivity.inputParameters[1].target).toBe('subExprVar');
		expect(callActivity.outputParameters.length).toBe(1);
		expect(callActivity.outputParameters[0].source).toBe('subResult');
		expect(callActivity.outputParameters[0].target).toBe('mainResult');
	});

	test('merges IO parameter updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyCallActivityFixture);
		state.elements.callactivity1.outputParameters.push({
			id: 'io-new',
			source: 'subStatus',
			sourceExpression: '',
			target: 'mainStatus',
		});

		const strippedXml = legacyCallActivityFixture
			.replace(/<extensionElements>[\s\S]*?<\/extensionElements>/, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyCallActivityFixture, state);

		expect(mergedXml).toMatch(/activiti:in source="mainVar" target="subVar"/);
		expect(mergedXml).toMatch(/activiti:in sourceExpression="\$\{mainExpr\}" target="subExprVar"/);
		expect(mergedXml).toMatch(/activiti:out source="subResult" target="mainResult"/);
		expect(mergedXml).toMatch(/activiti:out source="subStatus" target="mainStatus"/);
	});

	// Phase 1: Multi-Instance
	test('extracts multi-instance loop characteristics', () => {
		const state = extractFlowableDocumentState(legacyMultiInstanceFixture);
		const reviewTask = state.elements.reviewTask;
		const serviceTask = state.elements.servicetask1;

		assertDefined(reviewTask);
		assertDefined(reviewTask.multiInstance);
		expect(reviewTask.multiInstance.sequential).toBe(true);
		expect(reviewTask.multiInstance.collection).toBe('${reviewers}');
		expect(reviewTask.multiInstance.elementVariable).toBe('assignee');
		expect(reviewTask.multiInstance.loopCardinality).toBe('3');
		expect(reviewTask.multiInstance.completionCondition).toBe('${nrOfCompletedInstances/nrOfInstances >= 0.6}');

		assertDefined(serviceTask);
		assertDefined(serviceTask.multiInstance);
		expect(serviceTask.multiInstance.sequential).toBe(false);
		expect(serviceTask.multiInstance.collection).toBe('${recipients}');
		expect(serviceTask.multiInstance.elementVariable).toBe('recipient');
	});

	test('merges multi-instance updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyMultiInstanceFixture);
		assertDefined(state.elements.reviewTask.multiInstance);
		state.elements.reviewTask.multiInstance.loopCardinality = '5';
		state.elements.reviewTask.multiInstance.completionCondition = '${done}';

		const strippedXml = legacyMultiInstanceFixture
			.replace(/<multiInstanceLoopCharacteristics[^>]*>[\s\S]*?<\/multiInstanceLoopCharacteristics>/,
				'<multiInstanceLoopCharacteristics isSequential="true"/>');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyMultiInstanceFixture, state);

		expect(mergedXml).toMatch(/isSequential="true"/);
		expect(mergedXml).toMatch(/<loopCardinality>5<\/loopCardinality>/);
		expect(mergedXml).toMatch(/<completionCondition>\$\{done\}<\/completionCondition>/);
	});

	// Phase 1: Mail Task
	test('extracts mail task field extensions', () => {
		const state = extractFlowableDocumentState(legacyMailTaskFixture);
		const mailTask = state.elements.mailtask1;

		assertDefined(mailTask);
		const toField = mailTask.fieldExtensions.find(f => f.name === 'to');
		const fromField = mailTask.fieldExtensions.find(f => f.name === 'from');
		const subjectField = mailTask.fieldExtensions.find(f => f.name === 'subject');
		const ccField = mailTask.fieldExtensions.find(f => f.name === 'cc');
		const htmlField = mailTask.fieldExtensions.find(f => f.name === 'html');
		const textField = mailTask.fieldExtensions.find(f => f.name === 'text');

		assertDefined(toField);
		expect(toField.value).toBe('user@example.com');
		assertDefined(fromField);
		expect(fromField.value).toBe('noreply@example.com');
		assertDefined(subjectField);
		expect(subjectField.value).toBe('Task Notification');
		assertDefined(ccField);
		expect(ccField.value).toBe('manager@example.com');
		assertDefined(htmlField);
		assertDefined(textField);
		expect(textField.value).toBe('Hello, your task is ready.');
	});

	test('merges mail task field updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyMailTaskFixture);
		const toIdx = state.elements.mailtask1.fieldExtensions.findIndex(f => f.name === 'to');
		assertDefined(toIdx >= 0);
		state.elements.mailtask1.fieldExtensions[toIdx].value = 'updated@example.com';

		const strippedXml = legacyMailTaskFixture
			.replace(/<extensionElements>[\s\S]*?<\/extensionElements>/, '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyMailTaskFixture, state);

		expect(mergedXml).toMatch(/updated@example.com/);
		expect(mergedXml).toMatch(/noreply@example.com/);
		expect(mergedXml).toMatch(/Task Notification/);
	});

	// Phase 2: Boundary Events
	test('extracts timer boundary event definition', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		const timer = state.elements.boundarytimer1;

		assertDefined(timer);
		assertDefined(timer.timerDefinition);
		expect(timer.timerDefinition.type).toBe('timeDuration');
		expect(timer.timerDefinition.value).toBe('PT5M');
	});

	test('extracts error boundary event definition', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		const error = state.elements.boundaryerror1;

		assertDefined(error);
		expect(error.errorRef).toBe('businessError');
	});

	test('extracts signal boundary event definition', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		const signal = state.elements.boundarysignal1;

		assertDefined(signal);
		expect(signal.signalRef).toBe('alertSignal');
	});

	test('extracts message boundary event definition', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		const message = state.elements.boundarymessage1;

		assertDefined(message);
		expect(message.messageRef).toBe('orderMessage');
	});

	test('merges timer boundary event updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		assertDefined(state.elements.boundarytimer1.timerDefinition);
		state.elements.boundarytimer1.timerDefinition.type = 'timeCycle';
		state.elements.boundarytimer1.timerDefinition.value = 'R5/PT1H';

		const mergedXml = mergeFlowableDocumentXml(legacyBoundaryEventsFixture, legacyBoundaryEventsFixture, state);

		expect(mergedXml).toMatch(/<timeCycle>R5\/PT1H<\/timeCycle>/);
		expect(mergedXml).not.toMatch(/<timeDuration>/);
	});

	test('merges error ref updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		state.elements.boundaryerror1.errorRef = 'updatedError';

		const mergedXml = mergeFlowableDocumentXml(legacyBoundaryEventsFixture, legacyBoundaryEventsFixture, state);

		expect(mergedXml).toMatch(/errorRef="updatedError"/);
	});

	test('merges signal ref updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		state.elements.boundarysignal1.signalRef = 'updatedSignal';

		const mergedXml = mergeFlowableDocumentXml(legacyBoundaryEventsFixture, legacyBoundaryEventsFixture, state);

		expect(mergedXml).toMatch(/signalRef="updatedSignal"/);
	});

	test('merges message ref updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyBoundaryEventsFixture);
		state.elements.boundarymessage1.messageRef = 'updatedMessage';

		const mergedXml = mergeFlowableDocumentXml(legacyBoundaryEventsFixture, legacyBoundaryEventsFixture, state);

		expect(mergedXml).toMatch(/messageRef="updatedMessage"/);
	});

	// Phase 2: Various Event Types
	test('extracts timer start event with timeCycle', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		const timerStart = state.elements.timerstart1;

		assertDefined(timerStart);
		assertDefined(timerStart.timerDefinition);
		expect(timerStart.timerDefinition.type).toBe('timeCycle');
		expect(timerStart.timerDefinition.value).toBe('R3/PT10H');
	});

	test('extracts signal and message start event references', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);

		expect(state.elements.signalstart1.signalRef).toBe('approvalSignal');
		expect(state.elements.messagestart1.messageRef).toBe('startMessage');
	});

	test('extracts intermediate catch event timer with timeDate', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		const timerCatch = state.elements.timercatch1;

		assertDefined(timerCatch);
		assertDefined(timerCatch.timerDefinition);
		expect(timerCatch.timerDefinition.type).toBe('timeDate');
		expect(timerCatch.timerDefinition.value).toBe('2025-12-31T23:59:00Z');
	});

	test('extracts intermediate catch and throw signal/message references', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);

		expect(state.elements.signalcatch1.signalRef).toBe('approvalSignal');
		expect(state.elements.messagecatch1.messageRef).toBe('startMessage');
		expect(state.elements.signalthrow1.signalRef).toBe('approvalSignal');
	});

	test('extracts error end event reference', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		const errorEnd = state.elements.errorend1;

		assertDefined(errorEnd);
		expect(errorEnd.errorRef).toBe('fatalError');
	});

	test('merges timer start event updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		assertDefined(state.elements.timerstart1.timerDefinition);
		state.elements.timerstart1.timerDefinition.type = 'timeDuration';
		state.elements.timerstart1.timerDefinition.value = 'PT30M';

		const mergedXml = mergeFlowableDocumentXml(legacyEventTypesFixture, legacyEventTypesFixture, state);

		expect(mergedXml).toMatch(/<timeDuration>PT30M<\/timeDuration>/);
		expect(mergedXml).not.toMatch(/<timeCycle>R3\/PT10H<\/timeCycle>/);
	});

	test('merges error end event reference updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		state.elements.errorend1.errorRef = 'newFatalError';

		const mergedXml = mergeFlowableDocumentXml(legacyEventTypesFixture, legacyEventTypesFixture, state);

		expect(mergedXml).toMatch(/errorRef="newFatalError"/);
	});

	test('preserves signal and message definitions at process level', () => {
		const state = extractFlowableDocumentState(legacyEventTypesFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyEventTypesFixture, legacyEventTypesFixture, state);

		expect(mergedXml).toMatch(/signal id="approvalSignal"/);
		expect(mergedXml).toMatch(/message id="startMessage"/);
		expect(mergedXml).toMatch(/error id="fatalError"/);
	});

	// Phase 3: Documentation
	test('extracts documentation from elements', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);

		expect(state.elements.phase3Process.documentation).toBe('This is the main process documentation.');
		expect(state.elements.startevent1.documentation).toBe('Start of the order process');
		expect(state.elements.usertask1.documentation).toBe('Reviewer checks the order details');
		expect(state.elements.servicetask1.documentation).toBe('Handles payment processing');
	});

	test('merges documentation updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		state.elements.usertask1.documentation = 'Updated documentation';

		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);

		expect(mergedXml).toMatch(/Updated documentation/);
		expect(mergedXml).toMatch(/This is the main process documentation/);
	});

	// Phase 3: Signal Definitions
	test('extracts signal definitions from document', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);

		expect(state.signalDefinitions.length).toBe(2);
		expect(state.signalDefinitions[0].id).toBe('paymentSignal');
		expect(state.signalDefinitions[0].name).toBe('Payment Received');
		expect(state.signalDefinitions[1].id).toBe('cancelSignal');
		expect(state.signalDefinitions[1].name).toBe('Order Cancelled');
	});

	test('merges signal definition additions into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		state.signalDefinitions.push({ id: 'newSignal', name: 'New Signal', scope: '' });

		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);

		expect(mergedXml).toMatch(/signal id="paymentSignal"/);
		expect(mergedXml).toMatch(/signal id="cancelSignal"/);
		expect(mergedXml).toMatch(/signal id="newSignal"/);
	});

	// Phase 3: Message Definitions
	test('extracts message definitions from document', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);

		expect(state.messageDefinitions.length).toBe(2);
		expect(state.messageDefinitions[0].id).toBe('startMsg');
		expect(state.messageDefinitions[0].name).toBe('Start Order');
		expect(state.messageDefinitions[1].id).toBe('notifyMsg');
		expect(state.messageDefinitions[1].name).toBe('Notify Complete');
	});

	test('merges message definition updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		state.messageDefinitions[0].name = 'Updated Order';

		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);

		expect(mergedXml).toMatch(/message id="startMsg" name="Updated Order"/);
	});

	// Phase 3: Event Listeners
	test('extracts process-level event listeners', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);

		expect(state.eventListeners.length).toBe(5);

		const classListener = state.eventListeners[0];
		expect(classListener.events).toBe('ENTITY_CREATED');
		expect(classListener.implementationType).toBe('class');
		expect(classListener.implementation).toBe('com.example.AuditListener');
		expect(classListener.entityType).toBe('task');

		const delegateListener = state.eventListeners[1];
		expect(delegateListener.implementationType).toBe('delegateExpression');
		expect(delegateListener.implementation).toBe('${completionHandler}');

		const signalListener = state.eventListeners[2];
		expect(signalListener.implementationType).toBe('throwSignalEvent');
		expect(signalListener.implementation).toBe('paymentSignal');

		const messageListener = state.eventListeners[3];
		expect(messageListener.implementationType).toBe('throwMessageEvent');
		expect(messageListener.implementation).toBe('completionMessage');

		const errorListener = state.eventListeners[4];
		expect(errorListener.implementationType).toBe('throwErrorEvent');
		expect(errorListener.implementation).toBe('ERR-CLEANUP');
	});

	test('merges event listener additions into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		state.eventListeners.push({
			id: 'new-listener',
			events: 'TASK_CREATED',
			implementationType: 'class',
			implementation: 'com.example.NewListener',
			entityType: '',
		});

		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);

		expect(mergedXml).toMatch(/activiti:eventListener/);
		expect(mergedXml).toMatch(/com\.example\.AuditListener/);
		expect(mergedXml).toMatch(/com\.example\.NewListener/);
	});

	// Phase 3: Default flow preserved
	test('extracts gateway default flow attribute', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		const gateway = state.elements.gateway1;

		assertDefined(gateway);
		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);
		expect(mergedXml).toMatch(/exclusiveGateway id="gateway1"[^>]*default="flow3"/);
	});

	// Phase 3: General round-trip preservation
	test('round-trips phase 3 features without data loss', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);

		// Documentation preserved
		expect(mergedXml).toMatch(/This is the main process documentation/);
		expect(mergedXml).toMatch(/Start of the order process/);

		// Signal/message definitions preserved
		expect(mergedXml).toMatch(/signal id="paymentSignal"/);
		expect(mergedXml).toMatch(/message id="startMsg"/);

		// Event listeners preserved
		expect(mergedXml).toMatch(/activiti:eventListener/);
		expect(mergedXml).toMatch(/com\.example\.AuditListener/);

		// Text annotation preserved
		expect(mergedXml).toMatch(/This process handles order review and payment/);
	});

	// Phase 4: Target Namespace
	test('extracts target namespace from definitions', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);
		expect(state.targetNamespace).toBe('http://www.activiti.org/processdef');
	});

	test('merges target namespace updates into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);
		state.targetNamespace = 'http://example.com/custom';

		const mergedXml = mergeFlowableDocumentXml(legacyPhase4Fixture, legacyPhase4Fixture, state);

		expect(mergedXml).toMatch(/targetNamespace="http:\/\/example\.com\/custom"/);
	});

	// Phase 4: Localizations
	test('extracts localizations from process extension elements', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);

		expect(state.localizations.length).toBe(3);

		expect(state.localizations[0].locale).toBe('en');
		expect(state.localizations[0].name).toBe('Phase 4 Test Process EN');
		expect(state.localizations[0].description).toBe('English description of the process');

		expect(state.localizations[1].locale).toBe('fr');
		expect(state.localizations[1].name).toBe('Processus de test Phase 4');
		expect(state.localizations[1].description).toBe('Description française du processus');

		expect(state.localizations[2].locale).toBe('de');
		expect(state.localizations[2].name).toBe('Phase 4 Testprozess');
		expect(state.localizations[2].description).toBe('');
	});

	test('merges localization additions into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);
		state.localizations.push({ id: 'loc-es', locale: 'es', name: 'Proceso de prueba', description: 'Descripción en español' });

		const mergedXml = mergeFlowableDocumentXml(legacyPhase4Fixture, legacyPhase4Fixture, state);

		expect(mergedXml).toMatch(/activiti:localization/);
		expect(mergedXml).toMatch(/locale="en"/);
		expect(mergedXml).toMatch(/locale="fr"/);
		expect(mergedXml).toMatch(/locale="es"/);
		expect(mergedXml).toMatch(/Proceso de prueba/);
	});

	test('uses activiti documentation when adding a localization description', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/localization">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:localization locale="de" name="Name"/>
    </extensionElements>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.localizations[0].description = 'Beschreibung';

		const mergedXml = mergeFlowableDocumentXml(originalXml, originalXml, state);

		expect(mergedXml).toContain('<activiti:documentation>Beschreibung</activiti:documentation>');
		expect(mergedXml).not.toContain('<documentation>Beschreibung</documentation>');
	});

	test('normalizes legacy localization documentation to activiti documentation when edited', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/localization">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:localization locale="de" name="Name">
        <documentation>Alt</documentation>
      </activiti:localization>
    </extensionElements>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.localizations[0].description = 'Neu';

		const mergedXml = mergeFlowableDocumentXml(originalXml, originalXml, state);

		expect(mergedXml).toContain('<activiti:documentation>Neu</activiti:documentation>');
		expect(mergedXml).not.toContain('<documentation>Neu</documentation>');
	});

	// Phase 4: Subprocess
	test('extracts embedded subprocess elements', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);

		const subprocess = state.elements.subprocess1;
		assertDefined(subprocess);
		expect(subprocess.type).toBe('subProcess');

		// Sub-elements should also be extracted
		assertDefined(state.elements.subTask1);
		expect(state.elements.subTask1.activitiAttributes.async).toBe('true');
	});

	test('extracts event subprocess with triggeredByEvent', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);

		const eventSub = state.elements.eventSubprocess1;
		assertDefined(eventSub);
		// triggeredByEvent is a standard BPMN attribute preserved as-is by bpmn-js
	});

	test('extracts transaction elements', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);

		const transaction = state.elements.transaction1;
		assertDefined(transaction);
		expect(transaction.type).toBe('transaction');

		// Transaction inner service task with async
		const txTask = state.elements.txTask1;
		assertDefined(txTask);
		expect(txTask.activitiAttributes.class).toBe('com.example.PaymentService');
		expect(txTask.activitiAttributes.async).toBe('true');
	});

	// Phase 4: Pool & Lane
	test('extracts pool and lane elements from collaboration', () => {
		const state = extractFlowableDocumentState(legacyPoolLanesFixture);

		// Pool (participant)
		const pool = state.elements.pool1;
		assertDefined(pool);
		expect(pool.type).toBe('participant');

		// Lanes
		const lane1 = state.elements.lane1;
		assertDefined(lane1);
		expect(lane1.type).toBe('lane');

		const lane2 = state.elements.lane2;
		assertDefined(lane2);
		expect(lane2.type).toBe('lane');
	});

	test('preserves pool and lane structure on round-trip', () => {
		const state = extractFlowableDocumentState(legacyPoolLanesFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyPoolLanesFixture, legacyPoolLanesFixture, state);

		// Pool and lanes preserved
		expect(mergedXml).toMatch(/participant id="pool1"/);
		expect(mergedXml).toMatch(/lane id="lane1"/);
		expect(mergedXml).toMatch(/lane id="lane2"/);
		expect(mergedXml).toMatch(/collaboration id="collaboration1"/);
	});

	// Phase 4: General round-trip
	test('round-trips phase 4 features without data loss', () => {
		const state = extractFlowableDocumentState(legacyPhase4Fixture);
		const mergedXml = mergeFlowableDocumentXml(legacyPhase4Fixture, legacyPhase4Fixture, state);

		// Target namespace
		expect(mergedXml).toMatch(/targetNamespace="http:\/\/www\.activiti\.org\/processdef"/);

		// Localizations
		expect(mergedXml).toMatch(/activiti:localization/);
		expect(mergedXml).toMatch(/locale="en"/);
		expect(mergedXml).toMatch(/English description of the process/);

		// Subprocess elements
		expect(mergedXml).toMatch(/subProcess id="subprocess1"/);
		expect(mergedXml).toMatch(/subProcess id="eventSubprocess1"/);
		expect(mergedXml).toMatch(/triggeredByEvent="true"/);
		expect(mergedXml).toMatch(/transaction id="transaction1"/);
	});

	// Phase 5: BPMN Validation
	test('validates a well-formed BPMN document with no errors', () => {
		const issues = validateBpmnXml(legacyUserTaskFixture);
		const errors = issues.filter(i => i.severity === 'error');
		expect(errors.length).toBe(0);
	});

	test('reports missing process element', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.message.includes('No <process> element')));
	});

	test('reports missing start event', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <endEvent id="end1"></endEvent>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.message.includes('no start event')));
	});

	test('reports missing end event', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <startEvent id="start1"></startEvent>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.message.includes('no end event')));
	});

	test('reports sequence flow with non-existent source or target', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <startEvent id="start1"></startEvent>
    <endEvent id="end1"></endEvent>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="end1"></sequenceFlow>
    <sequenceFlow id="flow2" sourceRef="start1" targetRef="nonExistent"></sequenceFlow>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.elementId === 'flow2' && i.message.includes('non-existent target')));
	});

	test('warns about service task without implementation', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <startEvent id="start1"></startEvent>
    <serviceTask id="svc1" name="Empty Service"></serviceTask>
    <endEvent id="end1"></endEvent>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="svc1"></sequenceFlow>
    <sequenceFlow id="f2" sourceRef="svc1" targetRef="end1"></sequenceFlow>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.elementId === 'svc1' && i.message.includes('no implementation')));
	});

	test('warns about user task without assignee', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <startEvent id="start1"></startEvent>
    <userTask id="ut1" name="Unassigned Task"></userTask>
    <endEvent id="end1"></endEvent>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="ut1"></sequenceFlow>
    <sequenceFlow id="f2" sourceRef="ut1" targetRef="end1"></sequenceFlow>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.elementId === 'ut1' && i.message.includes('no assignee')));
	});

	test('warns about unreachable nodes', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs1">
  <process id="proc1" isExecutable="true">
    <startEvent id="start1"></startEvent>
    <endEvent id="end1"></endEvent>
    <userTask id="orphan1" name="Orphan"></userTask>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="end1"></sequenceFlow>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		assertDefined(issues.some(i => i.elementId === 'orphan1' && i.message.includes('no incoming')));
		assertDefined(issues.some(i => i.elementId === 'orphan1' && i.message.includes('no outgoing')));
	});

	test('reports invalid XML as error', () => {
		const issues = validateBpmnXml('not xml at all');
		assertDefined(issues.some(i => i.severity === 'error'));
	});

	test('validates pool/lane documents without false process error', () => {
		const issues = validateBpmnXml(legacyPoolLanesFixture);
		// Should not report "no process" since it has collaboration with participants
		assertDefined(!issues.some(i => i.message.includes('No <process> element')));
	});

	// Phase 6: Send Task tests
	test('extracts send task with class implementation', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const sendTask = state.elements.sendTask1;
		assertDefined(sendTask);
		expect(sendTask.activitiAttributes.class).toBe('com.example.SendDelegate');
		expect(sendTask.activitiAttributes.resultVariableName).toBe('sendResult');
		expect(sendTask.activitiAttributes.skipExpression).toBe('${skip}');
		expect(sendTask.activitiAttributes.async).toBe('true');
		expect(sendTask.activitiAttributes.exclusive).toBe('true');
		expect(sendTask.documentation).toBe('Send task documentation');
	});

	test('extracts send task field extensions', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const sendTask = state.elements.sendTask1;
		assertDefined(sendTask);
		expect(sendTask.fieldExtensions.length).toBe(2);
		const endpoint = sendTask.fieldExtensions.find(f => f.name === 'endpoint');
		assertDefined(endpoint);
		expect(endpoint.value).toBe('http://example.com/notify');
		expect(endpoint.valueType).toBe('string');
		const method = sendTask.fieldExtensions.find(f => f.name === 'method');
		assertDefined(method);
		expect(method.value).toBe('${httpMethod}');
		expect(method.valueType).toBe('expression');
	});

	test('extracts send task with expression implementation', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const sendTask2 = state.elements.sendTask2;
		assertDefined(sendTask2);
		expect(sendTask2.activitiAttributes.expression).toBe('${emailService.send(execution)}');
		expect(sendTask2.activitiAttributes.async).toBe('false');
	});

	test('extracts send task with delegate expression', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const sendTask3 = state.elements.sendTask3;
		assertDefined(sendTask3);
		expect(sendTask3.activitiAttributes.delegateExpression).toBe('${sendDelegate}');
	});

	test('extracts send task execution listeners', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const sendTask = state.elements.sendTask1;
		assertDefined(sendTask);
		expect(sendTask.executionListeners.length).toBe(1);
		expect(sendTask.executionListeners[0].event).toBe('start');
		expect(sendTask.executionListeners[0].implementation).toBe('com.example.SendStartListener');
	});

	// Phase 6: Receive Task tests
	test('extracts receive task attributes', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const receiveTask = state.elements.receiveTask1;
		assertDefined(receiveTask);
		expect(receiveTask.activitiAttributes.async).toBe('true');
		expect(receiveTask.activitiAttributes.exclusive).toBe('false');
		expect(receiveTask.documentation).toBe('Receive task - waits for signal');
	});

	// Phase 6: Manual Task tests
	test('extracts manual task attributes', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const manualTask = state.elements.manualTask1;
		assertDefined(manualTask);
		expect(manualTask.activitiAttributes.async).toBe('false');
		expect(manualTask.activitiAttributes.exclusive).toBe('true');
		expect(manualTask.documentation).toBe('Manual task for human approval');
	});

	test('extracts manual task execution listeners', () => {
		const state = extractFlowableDocumentState(legacyPhase6Fixture);
		const manualTask = state.elements.manualTask1;
		assertDefined(manualTask);
		expect(manualTask.executionListeners.length).toBe(1);
		expect(manualTask.executionListeners[0].event).toBe('end');
		expect(manualTask.executionListeners[0].implementationType).toBe('delegateExpression');
		expect(manualTask.executionListeners[0].implementation).toBe('${approvalLogger}');
	});

	// Phase 6: Round-trip tests
	test('round-trip preserves send task properties', () => {
		const originalState = extractFlowableDocumentState(legacyPhase6Fixture);
		const mergedXml = mergeFlowableDocumentXml(legacyPhase6Fixture, legacyPhase6Fixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		const sendTask = restoredState.elements.sendTask1;
		assertDefined(sendTask);
		expect(sendTask.activitiAttributes.class).toBe('com.example.SendDelegate');
		expect(sendTask.activitiAttributes.resultVariableName).toBe('sendResult');
		expect(sendTask.fieldExtensions.length).toBe(2);
		expect(sendTask.documentation).toBe('Send task documentation');
	});

	test('round-trip preserves receive and manual task properties', () => {
		const originalState = extractFlowableDocumentState(legacyPhase6Fixture);
		const mergedXml = mergeFlowableDocumentXml(legacyPhase6Fixture, legacyPhase6Fixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		const receiveTask = restoredState.elements.receiveTask1;
		assertDefined(receiveTask);
		expect(receiveTask.activitiAttributes.async).toBe('true');

		const manualTask = restoredState.elements.manualTask1;
		assertDefined(manualTask);
		expect(manualTask.activitiAttributes.exclusive).toBe('true');
		expect(manualTask.executionListeners.length).toBe(1);
	});

	test('validation passes for phase 6 fixture', () => {
		const issues = validateBpmnXml(legacyPhase6Fixture);
		// Should have no errors (all tasks are correctly connected)
		const errors = issues.filter(i => i.severity === 'error');
		expect(errors.length).toBe(0);
	});

	test('extracts terminateAll from terminate end events', () => {
		const state = extractFlowableDocumentState(legacyTerminateAllFixture);

		const terminateAllEnd = state.elements.endevent2;
		assertDefined(terminateAllEnd);
		expect(terminateAllEnd.terminateAll).toBe('true');

		const terminateNoAllEnd = state.elements.endevent3;
		assertDefined(terminateNoAllEnd);
		expect(terminateNoAllEnd.terminateAll).toBe('');

		const normalEnd = state.elements.endevent1;
		assertDefined(normalEnd);
		expect(normalEnd.terminateAll).toBe('');
	});

	test('round-trip preserves terminateAll attribute', () => {
		const originalState = extractFlowableDocumentState(legacyTerminateAllFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyTerminateAllFixture, legacyTerminateAllFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(restoredState.elements.endevent2.terminateAll).toBe('true');
		expect(restoredState.elements.endevent3.terminateAll).toBe('');
	});

	test('merge can set terminateAll on terminate end event', () => {
		const state = extractFlowableDocumentState(legacyTerminateAllFixture);
		// Enable terminateAll on the one that didn't have it
		state.elements.endevent3.terminateAll = 'true';
		const mergedXml = mergeFlowableDocumentXml(legacyTerminateAllFixture, legacyTerminateAllFixture, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(restoredState.elements.endevent3.terminateAll).toBe('true');
	});

	test('extracts compensation and isForCompensation attributes', () => {
		const state = extractFlowableDocumentState(legacyCompensationCancelFixture);

		const throwEvent = state.elements.throwcompensation1;
		assertDefined(throwEvent);
		expect(throwEvent.compensateActivityRef).toBe('servicetask1');

		const compensationHandler = state.elements.compensate_servicetask1;
		assertDefined(compensationHandler);
		expect(compensationHandler.isForCompensation).toBe('true');

		const normalTask = state.elements.servicetask1;
		assertDefined(normalTask);
		expect(normalTask.isForCompensation).toBe('');
	});

	test('round-trip preserves compensation and isForCompensation', () => {
		const originalState = extractFlowableDocumentState(legacyCompensationCancelFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyCompensationCancelFixture, legacyCompensationCancelFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(restoredState.elements.throwcompensation1.compensateActivityRef).toBe('servicetask1');
		expect(restoredState.elements.compensate_servicetask1.isForCompensation).toBe('true');
		expect(restoredState.elements.servicetask1.isForCompensation).toBe('');
	});

	test('extracts http task field extensions', () => {
		const state = extractFlowableDocumentState(legacyHttpTaskFixture);

		const httpTask = state.elements.httptask1;
		assertDefined(httpTask);
		const getField = (name: string) => httpTask.fieldExtensions.find((f) => f.name === name);
		expect(getField('requestMethod')?.value).toBe('GET');
		expect(getField('requestUrl')?.value).toBe('https://api.example.com/data');
		expect(getField('requestHeaders')?.value).toBe('Content-Type: application/json');
		expect(getField('requestTimeout')?.value).toBe('5000');
		expect(getField('failStatusCodes')?.value).toBe('400,500');
		expect(getField('saveResponseParameters')?.value).toBe('true');

		const postTask = state.elements.httptask2;
		assertDefined(postTask);
		const getPostField = (name: string) => postTask.fieldExtensions.find((f) => f.name === name);
		expect(getPostField('requestMethod')?.value).toBe('POST');
		expect(getPostField('requestBody')?.value).toBe('{"key": "value"}');
	});

	test('round-trip preserves http task fields', () => {
		const originalState = extractFlowableDocumentState(legacyHttpTaskFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyHttpTaskFixture, legacyHttpTaskFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		const httpTask = restoredState.elements.httptask1;
		assertDefined(httpTask);
		expect(httpTask.fieldExtensions.find((f) => f.name === 'requestMethod')?.value).toBe('GET');
		expect(httpTask.fieldExtensions.find((f) => f.name === 'requestUrl')?.value).toBe('https://api.example.com/data');
	});

	test('extracts shell task field extensions', () => {
		const state = extractFlowableDocumentState(legacyShellTaskFixture);

		const shellTask = state.elements.shelltask1;
		assertDefined(shellTask);
		const getField = (name: string) => shellTask.fieldExtensions.find((f) => f.name === name);
		expect(getField('command')?.value).toBe('/usr/bin/env');
		expect(getField('arg1')?.value).toBe('bash');
		expect(getField('arg2')?.value).toBe('-c');
		expect(getField('arg3')?.value).toBe('echo hello');
		expect(getField('wait')?.value).toBe('true');
		expect(getField('redirectError')?.value).toBe('true');
		expect(getField('cleanEnv')?.value).toBe('false');
		expect(getField('outputVariable')?.value).toBe('shellOutput');
		expect(getField('errorCodeVariable')?.value).toBe('shellError');
		expect(getField('directory')?.value).toBe('/tmp');
	});

	test('round-trip preserves shell task fields', () => {
		const originalState = extractFlowableDocumentState(legacyShellTaskFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyShellTaskFixture, legacyShellTaskFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		const shellTask = restoredState.elements.shelltask1;
		assertDefined(shellTask);
		expect(shellTask.fieldExtensions.find((f) => f.name === 'command')?.value).toBe('/usr/bin/env');
		expect(shellTask.fieldExtensions.find((f) => f.name === 'wait')?.value).toBe('true');
	});

	test('extracts external worker task topic field', () => {
		const state = extractFlowableDocumentState(legacyExternalWorkerFixture);

		const ewTask = state.elements.externalworkertask1;
		assertDefined(ewTask);
		expect(ewTask.fieldExtensions.find((f) => f.name === 'topic')?.value).toBe('order-processing');
	});

	test('round-trip preserves external worker task fields', () => {
		const originalState = extractFlowableDocumentState(legacyExternalWorkerFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyExternalWorkerFixture, legacyExternalWorkerFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		const ewTask = restoredState.elements.externalworkertask1;
		assertDefined(ewTask);
		expect(ewTask.fieldExtensions.find((f) => f.name === 'topic')?.value).toBe('order-processing');
	});

	test('extracts triggerable and failedJobRetryTimeCycle', () => {
		const state = extractFlowableDocumentState(legacyAsyncRetryFixture);

		const asyncTask = state.elements.servicetask1;
		assertDefined(asyncTask);
		expect(asyncTask.activitiAttributes.async).toBe('true');
		expect(asyncTask.activitiAttributes.exclusive).toBe('true');
		expect(asyncTask.activitiAttributes.triggerable).toBe('true');
		expect(asyncTask.failedJobRetryTimeCycle).toBe('R3/PT10M');

		const noRetryTask = state.elements.servicetask2;
		assertDefined(noRetryTask);
		expect(noRetryTask.activitiAttributes.async).toBe('true');
		expect(noRetryTask.failedJobRetryTimeCycle).toBe('');
	});

	test('round-trip preserves triggerable and failedJobRetryTimeCycle', () => {
		const originalState = extractFlowableDocumentState(legacyAsyncRetryFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyAsyncRetryFixture, legacyAsyncRetryFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(restoredState.elements.servicetask1.activitiAttributes.triggerable).toBe('true');
		expect(restoredState.elements.servicetask1.failedJobRetryTimeCycle).toBe('R3/PT10M');
		expect(restoredState.elements.servicetask2.failedJobRetryTimeCycle).toBe('');
	});

	test('merge can add failedJobRetryTimeCycle to element', () => {
		const state = extractFlowableDocumentState(legacyAsyncRetryFixture);
		// Add retry to the task that doesn't have it
		state.elements.servicetask2.failedJobRetryTimeCycle = 'R5/PT5M';
		const mergedXml = mergeFlowableDocumentXml(legacyAsyncRetryFixture, legacyAsyncRetryFixture, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(restoredState.elements.servicetask2.failedJobRetryTimeCycle).toBe('R5/PT5M');
	});

	test('removing async attribute from incoming state removes it from merged XML', () => {
		const originalState = extractFlowableDocumentState(legacyNestedCollapsedSubprocessFixture);

		// Verify the fixture has async="true" on the user task
		const userTask = originalState.elements.usertask1;
		assertDefined(userTask);
		expect(userTask.activitiAttributes.async).toBe('true');

		// Simulate toggling async off: delete the key (matches updateFlowableAttribute behaviour)
		const incomingState = extractFlowableDocumentState(legacyNestedCollapsedSubprocessFixture);
		delete incomingState.elements.usertask1.activitiAttributes.async;

		const mergedXml = mergeFlowableDocumentXml(
			legacyNestedCollapsedSubprocessFixture,
			legacyNestedCollapsedSubprocessFixture,
			incomingState,
		);

		// The merged XML must NOT contain activiti:async on usertask12
		const restoredState = extractFlowableDocumentState(mergedXml);
		expect(restoredState.elements.usertask1.activitiAttributes.async).toBeUndefined();
		expect(mergedXml).not.toMatch(/usertask1[^>]*activiti:async/);

		// Other attributes should still be preserved
		expect(restoredState.elements.usertask1.activitiAttributes.exclusive).toBe('true');
	});

	test('extracts signal scope', () => {
		const state = extractFlowableDocumentState(legacyDataSignalExceptionsFixture);

		const alertSignal = state.signalDefinitions.find((s) => s.id === 'alertSignal');
		assertDefined(alertSignal);
		expect(alertSignal.name).toBe('Alert Signal');
		expect(alertSignal.scope).toBe('processInstance');

		const globalSignal = state.signalDefinitions.find((s) => s.id === 'globalSignal');
		assertDefined(globalSignal);
		expect(globalSignal.name).toBe('Global Signal');
		expect(globalSignal.scope).toBe('');
	});

	test('extracts data objects', () => {
		const state = extractFlowableDocumentState(legacyDataSignalExceptionsFixture);

		expect(state.dataObjects.length).toBe(2);

		const strObj = state.dataObjects.find((d) => d.id === 'dataObj1');
		assertDefined(strObj);
		expect(strObj.name).toBe('myVar');
		expect(strObj.itemSubjectRef).toBe('xsd:string');
		expect(strObj.defaultValue).toBe('hello world');

		const intObj = state.dataObjects.find((d) => d.id === 'dataObj2');
		assertDefined(intObj);
		expect(intObj.name).toBe('myCount');
		expect(intObj.itemSubjectRef).toBe('xsd:int');
		expect(intObj.defaultValue).toBe('42');
	});

	test('extracts exception maps', () => {
		const state = extractFlowableDocumentState(legacyDataSignalExceptionsFixture);

		const svc = state.elements.servicetask1;
		assertDefined(svc);
		expect(svc.exceptionMaps.length).toBe(2);

		expect(svc.exceptionMaps[0].errorCode).toBe('ERR-001');
		expect(svc.exceptionMaps[0].className).toBe('com.example.BusinessException');
		expect(svc.exceptionMaps[0].includeChildExceptions).toBe(true);

		expect(svc.exceptionMaps[1].errorCode).toBe('ERR-002');
		expect(svc.exceptionMaps[1].className).toBe('com.example.TechnicalException');
		expect(svc.exceptionMaps[1].includeChildExceptions).toBe(false);
	});

	test('round-trip preserves signal scope, data objects, and exception maps', () => {
		const originalState = extractFlowableDocumentState(legacyDataSignalExceptionsFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyDataSignalExceptionsFixture, legacyDataSignalExceptionsFixture, originalState);
		const restoredState = extractFlowableDocumentState(mergedXml);

		// Signal scope
		const alertSignal = restoredState.signalDefinitions.find((s) => s.id === 'alertSignal');
		assertDefined(alertSignal);
		expect(alertSignal.scope).toBe('processInstance');
		const globalSignal = restoredState.signalDefinitions.find((s) => s.id === 'globalSignal');
		assertDefined(globalSignal);
		expect(globalSignal.scope).toBe('');

		// Data objects
		expect(restoredState.dataObjects.length).toBe(2);
		const strObj = restoredState.dataObjects.find((d) => d.id === 'dataObj1');
		assertDefined(strObj);
		expect(strObj.defaultValue).toBe('hello world');

		// Exception maps
		const svc = restoredState.elements.servicetask1;
		expect(svc.exceptionMaps.length).toBe(2);
		expect(svc.exceptionMaps[0].errorCode).toBe('ERR-001');
		expect(svc.exceptionMaps[0].className).toBe('com.example.BusinessException');
	});

	test('validates gateway without default flow warns when conditional flows exist', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://test">
  <process id="p1" isExecutable="true">
    <startEvent id="start1"/>
    <exclusiveGateway id="gw1"/>
    <endEvent id="end1"/>
    <endEvent id="end2"/>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="gw1"/>
    <sequenceFlow id="f2" sourceRef="gw1" targetRef="end1">
      <conditionExpression>\${x &gt; 5}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f3" sourceRef="gw1" targetRef="end2">
      <conditionExpression>\${x &lt;= 5}</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		const gwWarning = issues.find((i) => i.elementId === 'gw1' && i.message.includes('no default flow'));
		expect(gwWarning, 'Expected warning about missing default flow on gateway').toBeTruthy();
	});

	test('validates gateway with default flow does not warn', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://test">
  <process id="p1" isExecutable="true">
    <startEvent id="start1"/>
    <exclusiveGateway id="gw1" default="f3"/>
    <endEvent id="end1"/>
    <endEvent id="end2"/>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="gw1"/>
    <sequenceFlow id="f2" sourceRef="gw1" targetRef="end1">
      <conditionExpression>\${x &gt; 5}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f3" sourceRef="gw1" targetRef="end2"/>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		const gwWarning = issues.find((i) => i.elementId === 'gw1' && i.message.includes('no default flow'));
		expect(!gwWarning, 'Should not warn when default flow is set').toBeTruthy();
	});

	test('validates transaction subprocess without cancel boundary event', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://test">
  <process id="p1" isExecutable="true">
    <startEvent id="start1"/>
    <transaction id="tx1">
      <startEvent id="txStart"/>
      <endEvent id="txEnd"/>
      <sequenceFlow id="txFlow" sourceRef="txStart" targetRef="txEnd"/>
    </transaction>
    <endEvent id="end1"/>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="tx1"/>
    <sequenceFlow id="f2" sourceRef="tx1" targetRef="end1"/>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		const txWarning = issues.find((i) => i.elementId === 'tx1' && i.message.includes('cancel boundary event'));
		expect(txWarning, 'Expected warning about missing cancel boundary event on transaction').toBeTruthy();
	});

	test('validates failedJobRetryTimeCycle ISO 8601 pattern', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://test">
  <process id="p1" isExecutable="true">
    <startEvent id="start1"/>
    <serviceTask id="svc1" activiti:async="true" activiti:class="com.example.Foo">
      <extensionElements>
        <activiti:failedJobRetryTimeCycle>INVALID</activiti:failedJobRetryTimeCycle>
      </extensionElements>
    </serviceTask>
    <endEvent id="end1"/>
    <sequenceFlow id="f1" sourceRef="start1" targetRef="svc1"/>
    <sequenceFlow id="f2" sourceRef="svc1" targetRef="end1"/>
  </process>
</definitions>`;
		const issues = validateBpmnXml(xml);
		const retryWarning = issues.find((i) => i.elementId === 'svc1' && i.message.includes('failedJobRetryTimeCycle'));
		expect(retryWarning, 'Expected warning about invalid retry pattern').toBeTruthy();

		// Valid pattern should not warn
		const validXml = xml.replace('INVALID', 'R3/PT10M');
		const validIssues = validateBpmnXml(validXml);
		const noRetryWarning = validIssues.find((i) => i.elementId === 'svc1' && i.message.includes('failedJobRetryTimeCycle'));
		expect(!noRetryWarning, 'Should not warn for valid ISO 8601 pattern').toBeTruthy();
	});

        test('parseXmlDocument rejects DOCTYPE declarations', () => {
				expect(() => parseXmlDocument('<!DOCTYPE foo><root/>')).toThrow('DOCTYPE declarations are not supported');
        });

        test('parseXmlDocument throws on malformed XML', () => {
				expect(() => parseXmlDocument('<root><unclosed>')).toThrow();
        });

        test('parseXmlDocument parses valid XML', () => {
                const doc = parseXmlDocument('<root><child/></root>');
                expect(doc.documentElement?.tagName).toBe('root');
        });

	// Subprocess fixtures
	test('extracts embedded subprocess and its child elements', () => {
		const state = extractFlowableDocumentState(legacySubprocessFixture);

		const subprocess = state.elements.subprocess1;
		assertDefined(subprocess);
		expect(subprocess.type).toBe('subProcess');

		const userTask = state.elements.usertask1;
		assertDefined(userTask);
		expect(userTask.activitiAttributes.assignee).toBe('${initiator}');
		expect(userTask.documentation).toBe('Review the incoming request and approve or reject.');

		const serviceTask = state.elements.servicetask1;
		assertDefined(serviceTask);
		expect(serviceTask.activitiAttributes.class).toBe('com.example.flowable.ReviewDelegate');
	});

	test('validates expanded subprocess fixture with no errors', () => {
		const issues = validateBpmnXml(legacySubprocessFixture);
		const errors = issues.filter(i => i.severity === 'error');
		expect(errors.length).toBe(0);
	});

	test('round-trips expanded subprocess without data loss', () => {
		const state = extractFlowableDocumentState(legacySubprocessFixture);
		const mergedXml = mergeFlowableDocumentXml(legacySubprocessFixture, legacySubprocessFixture, state);

		expect(mergedXml).toMatch(/subProcess id="subprocess1"/);
		expect(mergedXml).toMatch(/activiti:assignee="\$\{initiator\}"/);
		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.ReviewDelegate"/);
		expect(mergedXml).toMatch(/Review the incoming request and approve or reject\./);
	});

	test('merges updated subprocess child attributes into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacySubprocessFixture);
		state.elements.usertask1.activitiAttributes.assignee = 'admin';
		state.elements.servicetask1.activitiAttributes.class = 'com.example.flowable.UpdatedDelegate';

		const strippedXml = legacySubprocessFixture
			.replace(' activiti:assignee="${initiator}"', '')
			.replace(' activiti:class="com.example.flowable.ReviewDelegate"', '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacySubprocessFixture, state);

		expect(mergedXml).toMatch(/activiti:assignee="admin"/);
		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.UpdatedDelegate"/);
	});

	// Collapsed subprocess (multi-diagram plane) fixtures
	test('extracts collapsed subprocess and its child elements', () => {
		const state = extractFlowableDocumentState(legacyCollapsedSubprocessFixture);

		const subprocess = state.elements.subprocess1;
		assertDefined(subprocess);
		expect(subprocess.type).toBe('subProcess');

		const userTask = state.elements.usertask1;
		assertDefined(userTask);
		expect(userTask.activitiAttributes.assignee).toBe('${initiator}');
		expect(userTask.documentation).toBe('Approve or reject the incoming request.');

		const approvalTask = state.elements.servicetask1;
		assertDefined(approvalTask);
		expect(approvalTask.activitiAttributes.class).toBe('com.example.flowable.ApprovalDelegate');

		const rejectionTask = state.elements.servicetask2;
		assertDefined(rejectionTask);
		expect(rejectionTask.activitiAttributes.class).toBe('com.example.flowable.RejectionDelegate');
	});

	test('extracts condition expressions from collapsed subprocess flows', () => {
		const state = extractFlowableDocumentState(legacyCollapsedSubprocessFixture);

		const yesFlow = state.elements.subflow3;
		assertDefined(yesFlow);
		expect(yesFlow.conditionExpression).toBe('${approved == true}');

		const noFlow = state.elements.subflow4;
		assertDefined(noFlow);
		expect(noFlow.conditionExpression).toBe('${approved == false}');
	});

	test('validates collapsed subprocess fixture with no errors', () => {
		const issues = validateBpmnXml(legacyCollapsedSubprocessFixture);
		const errors = issues.filter(i => i.severity === 'error');
		expect(errors.length).toBe(0);
	});

	test('round-trips collapsed subprocess without data loss', () => {
		const state = extractFlowableDocumentState(legacyCollapsedSubprocessFixture);
		const mergedXml = mergeFlowableDocumentXml(legacyCollapsedSubprocessFixture, legacyCollapsedSubprocessFixture, state);

		expect(mergedXml).toMatch(/subProcess id="subprocess1"/);
		expect(mergedXml).toMatch(/activiti:assignee="\$\{initiator\}"/);
		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.ApprovalDelegate"/);
		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.RejectionDelegate"/);
		expect(mergedXml).toMatch(/Approve or reject the incoming request\./);

		// Verify multi-diagram structure is preserved
		expect(mergedXml).toMatch(/BPMNDiagram id="BPMNDiagram_legacyCollapsedSubprocessProcess"/);
		expect(mergedXml).toMatch(/BPMNDiagram id="BPMNDiagram_subprocess1"/);
		expect(mergedXml).toMatch(/isExpanded="false"/);
	});

	test('merges updated collapsed subprocess child attributes into BPMN XML', () => {
		const state = extractFlowableDocumentState(legacyCollapsedSubprocessFixture);
		state.elements.usertask1.activitiAttributes.assignee = 'manager';
		state.elements.servicetask1.activitiAttributes.class = 'com.example.flowable.NewApprovalDelegate';
		state.elements.subflow3.conditionExpression = '${status == "approved"}';

		const strippedXml = legacyCollapsedSubprocessFixture
			.replace(' activiti:assignee="${initiator}"', '')
			.replace(' activiti:class="com.example.flowable.ApprovalDelegate"', '');

		const mergedXml = mergeFlowableDocumentXml(strippedXml, legacyCollapsedSubprocessFixture, state);

		expect(mergedXml).toMatch(/activiti:assignee="manager"/);
		expect(mergedXml).toMatch(/activiti:class="com.example.flowable.NewApprovalDelegate"/);
		expect(mergedXml).toMatch(/\$\{status == "approved"\}/);
	});

	test('preserves comments and lexical order on no-op round-trip', () => {
		const state = extractFlowableDocumentState(lexicalPreservationFixture);
		const mergedXml = mergeFlowableDocumentXml(lexicalPreservationFixture, lexicalPreservationFixture, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const mergedDefinitions = mergedDoc.documentElement!;
		const mergedProcess = mergedDefinitions.getElementsByTagName('process')[0];
		const mergedPlane = mergedDoc.getElementsByTagName('bpmndi:BPMNPlane')[0];

		expect(mergedXml).toContain('<!-- between start and review -->');
		expect(mergedXml).toContain('<!-- extension comment -->');
		expect(mergedXml).toContain('<!-- before diagram -->');
		expect(directChildElementNames(mergedDefinitions)).toEqual(['signal', 'message', 'process', 'BPMNDiagram']);
		expect(directChildElementIds(mergedProcess)).toEqual(['documentation', 'start1', 'reviewTask', 'flow1', 'end1', 'flow2']);
		expect(directChildElementIds(mergedPlane)).toEqual([
			'BPMNShape_start1',
			'BPMNShape_reviewTask',
			'BPMNShape_end1',
			'BPMNEdge_flow1',
			'BPMNEdge_flow2',
		]);
		expect(mergedXml).toMatch(/<userTask id="reviewTask" name="Review" activiti:assignee="\$\{initiator\}" activiti:formKey="reviewForm" custom:alpha="1">/);
	});

	test('preserves comments and existing order when serialized BPMN is reordered', () => {
		const state = extractFlowableDocumentState(lexicalPreservationFixture);
		const reorderedSerializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:activiti="http://activiti.org/bpmn" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/lexical">
  <process custom:processFlag="on" isExecutable="true" name="Lexical Process" id="lexicalProcess">
    <sequenceFlow targetRef="reviewTask" id="flow1" sourceRef="start1"/>
    <userTask custom:alpha="1" activiti:formKey="reviewForm" activiti:assignee="\${initiator}" name="Review" id="reviewTask">
      <documentation>Review docs</documentation>
    </userTask>
    <startEvent name="Start" id="start1"/>
    <sequenceFlow targetRef="end1" id="flow2" sourceRef="reviewTask"/>
    <endEvent name="End" id="end1"/>
  </process>
  <message name="Start Message" id="startMessage"/>
  <signal name="Approval Signal" id="approvalSignal"/>
  <bpmndi:BPMNDiagram id="BPMNDiagram_lexicalProcess">
    <bpmndi:BPMNPlane bpmnElement="lexicalProcess" id="BPMNPlane_lexicalProcess">
      <bpmndi:BPMNEdge bpmnElement="flow2" id="BPMNEdge_flow2">
        <omgdi:waypoint x="281" y="168"/>
        <omgdi:waypoint x="341" y="168"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape bpmnElement="end1" id="BPMNShape_end1">
        <omgdc:Bounds x="350" y="155" width="35" height="35"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape bpmnElement="reviewTask" id="BPMNShape_reviewTask">
        <omgdc:Bounds x="220" y="145" width="100" height="55"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge bpmnElement="flow1" id="BPMNEdge_flow1">
        <omgdi:waypoint x="116" y="168"/>
        <omgdi:waypoint x="221" y="168"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape bpmnElement="start1" id="BPMNShape_start1">
        <omgdc:Bounds x="81" y="151" width="35" height="35"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

		const mergedXml = mergeFlowableDocumentXml(reorderedSerializedXml, lexicalPreservationFixture, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const mergedDefinitions = mergedDoc.documentElement!;
		const mergedProcess = mergedDefinitions.getElementsByTagName('process')[0];
		const mergedPlane = mergedDoc.getElementsByTagName('bpmndi:BPMNPlane')[0];

		expect(mergedXml).toContain('<!-- between start and review -->');
		expect(mergedXml).toContain('<!-- extension comment -->');
		expect(mergedXml).toContain('<!-- before diagram -->');
		expect(directChildElementNames(mergedDefinitions)).toEqual(['signal', 'message', 'process', 'BPMNDiagram']);
		expect(directChildElementIds(mergedProcess)).toEqual(['documentation', 'start1', 'reviewTask', 'flow1', 'end1', 'flow2']);
		expect(directChildElementIds(mergedPlane)).toEqual([
			'BPMNShape_start1',
			'BPMNShape_reviewTask',
			'BPMNShape_end1',
			'BPMNEdge_flow1',
			'BPMNEdge_flow2',
		]);
		expect(mergedXml).toMatch(/<omgdc:Bounds x="220" y="145" width="100" height="55"\/>/);
		expect(mergedXml).toMatch(/<userTask id="reviewTask" name="Review" activiti:assignee="\$\{initiator\}" activiti:formKey="reviewForm" custom:alpha="1">/);
	});

	test('preserves comments and order while applying Flowable metadata edits', () => {
		const state = extractFlowableDocumentState(lexicalPreservationFixture);
		state.elements.reviewTask.activitiAttributes.assignee = 'manager';
		state.elements.reviewTask.fieldExtensions.push({
			id: 'field-added',
			name: 'region',
			valueType: 'string',
			value: 'emea',
		});

		const mergedXml = mergeFlowableDocumentXml(lexicalPreservationFixture, lexicalPreservationFixture, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const mergedDefinitions = mergedDoc.documentElement!;
		const mergedProcess = mergedDefinitions.getElementsByTagName('process')[0];

		expect(mergedXml).toContain('<!-- between start and review -->');
		expect(mergedXml).toContain('<!-- extension comment -->');
		expect(directChildElementNames(mergedDefinitions)).toEqual(['signal', 'message', 'process', 'BPMNDiagram']);
		expect(directChildElementIds(mergedProcess)).toEqual(['documentation', 'start1', 'reviewTask', 'flow1', 'end1', 'flow2']);
		expect(mergedXml).toMatch(/<userTask id="reviewTask" name="Review" activiti:assignee="manager" activiti:formKey="reviewForm" custom:alpha="1">/);
		expect(mergedXml).toMatch(/<activiti:field name="priority">/);
		expect(mergedXml).toMatch(/<activiti:field name="region">\s*<activiti:string>emea<\/activiti:string>\s*<\/activiti:field>/);
	});

	test('persists reordered existing managed metadata collections', () => {
		const state = extractFlowableDocumentState(legacyPhase3Fixture);
		state.signalDefinitions = [state.signalDefinitions[1], state.signalDefinitions[0]];

		const mergedXml = mergeFlowableDocumentXml(legacyPhase3Fixture, legacyPhase3Fixture, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const definitions = mergedDoc.documentElement!;
		const signalIds = directChildElementIds(definitions).filter((id) => id === 'cancelSignal' || id === 'paymentSignal');

		expect(signalIds).toEqual(['cancelSignal', 'paymentSignal']);
		expect(mergedXml.indexOf('id="cancelSignal"')).toBeLessThan(mergedXml.indexOf('id="paymentSignal"'));
	});

	test('preserves document-level comments and processing instructions', () => {
		const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<!-- top-level comment -->
<?xml-stylesheet type="text/xsl" href="diagram.xsl"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true"/>
</definitions>
<!-- trailing comment -->`;

		const state = extractFlowableDocumentState(fixture);
		const mergedXml = mergeFlowableDocumentXml(fixture, fixture, state);

		expect(mergedXml).toContain('<!-- top-level comment -->');
		expect(mergedXml).toContain('<?xml-stylesheet type="text/xsl" href="diagram.xsl"?>');
		expect(mergedXml).toContain('<!-- trailing comment -->');
		expect(mergedXml.indexOf('<!-- top-level comment -->')).toBeLessThan(mergedXml.indexOf('<definitions'));
		expect(mergedXml.indexOf('<!-- trailing comment -->')).toBeGreaterThan(mergedXml.indexOf('</definitions>'));
	});

	test('preserves comments and processing instructions added by serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <endEvent id="end1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- top-level comment -->
<?xml-stylesheet type="text/xsl" href="diagram.xsl"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <!-- between start and end -->
    <endEvent id="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('<!-- top-level comment -->');
		expect(mergedXml).toContain('<?xml-stylesheet type="text/xsl" href="diagram.xsl"?>');
		expect(mergedXml).toContain('<!-- between start and end -->');
		expect(mergedXml.indexOf('<!-- top-level comment -->')).toBeLessThan(mergedXml.indexOf('<definitions'));
		expect(mergedXml.indexOf('<!-- between start and end -->')).toBeGreaterThan(mergedXml.indexOf('id="start1"'));
		expect(mergedXml.indexOf('<!-- between start and end -->')).toBeLessThan(mergedXml.indexOf('id="end1"'));
	});

	test('preserves existing BPMN diagram comments in nested collapsed subprocess documents', () => {
		const fixtureWithDiagramComments = legacyNestedCollapsedSubprocessFixture
			.replace(
				'  <bpmndi:BPMNDiagram id="BPMNDiagram_nestedCollapsedSubprocessProcess">',
				'  <!-- Main process diagram: subprocess1 shown collapsed -->\n  <bpmndi:BPMNDiagram id="BPMNDiagram_nestedCollapsedSubprocessProcess">',
			)
			.replace(
				'  <bpmndi:BPMNDiagram id="BPMNDiagram_subprocess1">',
				'  <!-- Level 1: contents of subprocess1, with subprocess2 shown collapsed -->\n  <bpmndi:BPMNDiagram id="BPMNDiagram_subprocess1">',
			)
			.replace(
				'  <bpmndi:BPMNDiagram id="BPMNDiagram_subprocess2">',
				'  <!-- Level 2: contents of subprocess2 (innermost) -->\n  <bpmndi:BPMNDiagram id="BPMNDiagram_subprocess2">',
			);
		const state = extractFlowableDocumentState(fixtureWithDiagramComments);
		const mergedXml = mergeFlowableDocumentXml(fixtureWithDiagramComments, fixtureWithDiagramComments, state);

		expect(mergedXml).toContain('<!-- Main process diagram: subprocess1 shown collapsed -->');
		expect(mergedXml).toContain('<!-- Level 1: contents of subprocess1, with subprocess2 shown collapsed -->');
		expect(mergedXml).toContain('<!-- Level 2: contents of subprocess2 (innermost) -->');
	});

	test('preserves element type changes when a replaced element keeps the same id', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/type-swap">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Do work"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/type-swap">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Do work"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('<userTask id="task1" name="Do work"/>');
		expect(mergedXml).not.toContain('<serviceTask id="task1"');
	});

	test('preserves unsupported extension children when an element type changes with the same id', () => {
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:activiti="http://activiti.org/bpmn" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/lexical">
  <signal id="approvalSignal" name="Approval Signal"/>
  <message id="startMessage" name="Start Message"/>
  <process id="lexicalProcess" name="Lexical Process" isExecutable="true" custom:processFlag="on">
    <documentation>Process level documentation</documentation>
    <startEvent id="start1" name="Start"/>
    <serviceTask id="reviewTask" name="Review"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="reviewTask"/>
    <endEvent id="end1" name="End"/>
    <sequenceFlow id="flow2" sourceRef="reviewTask" targetRef="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(lexicalPreservationFixture);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, lexicalPreservationFixture, state);

		expect(mergedXml).toContain('<serviceTask id="reviewTask" name="Review"');
		expect(mergedXml).toMatch(/<custom:hint code="A"(?:\s+xmlns:custom="http:\/\/example.com\/custom")?\/>/);
	});

	test('preserves new non-activiti namespaced attributes from serialized BPMN', () => {
		const serializedXml = lexicalPreservationFixture.replace(
			'<userTask id="reviewTask" name="Review" activiti:assignee="${initiator}" activiti:formKey="reviewForm" custom:alpha="1">',
			'<userTask id="reviewTask" name="Review" activiti:assignee="${initiator}" activiti:formKey="reviewForm" custom:alpha="1" custom:beta="2">',
		);

		const state = extractFlowableDocumentState(lexicalPreservationFixture);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, lexicalPreservationFixture, state);

		expect(mergedXml).toContain('custom:beta="2"');
	});

	test('preserves element-scoped namespace declarations for serialized prefixed attributes', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/local-scope-prefix">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/local-scope-prefix">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task" xmlns:custom="http://example.com/custom" custom:beta="2"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('custom:beta="2"');
		expect(mergedXml).toContain('xmlns:custom="http://example.com/custom"');
		expect(() => parseXmlDocument(mergedXml)).not.toThrow();
	});

	test('preserves new unsupported activiti attributes from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/activiti-attr">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/activiti-attr">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task" activiti:customFlag="yes"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('activiti:customFlag="yes"');
		expect(() => parseXmlDocument(mergedXml)).not.toThrow();
	});

	test('preserves namespace declarations for brand-new serialized prefixes', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/new-prefix">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/new-prefix">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Task" custom:beta="2"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('xmlns:custom="http://example.com/custom"');
		expect(mergedXml).toContain('custom:beta="2"');
		expect(() => parseXmlDocument(mergedXml)).not.toThrow();
	});

	test('replaces legacy prefixed process event listener implementations cleanly', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/listeners">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_CREATED" activiti:class="com.example.AuditListener"/>
    </extensionElements>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.eventListeners[0].implementationType = 'delegateExpression';
		state.eventListeners[0].implementation = '${handler}';

		const mergedXml = mergeFlowableDocumentXml(originalXml, originalXml, state);

		expect(mergedXml).toContain('delegateExpression="${handler}"');
		expect(mergedXml).not.toContain('activiti:class=');
		expect(mergedXml).not.toContain('class="com.example.AuditListener"');
	});

	test('preserves serialized signal and message definitions when state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <signal id="sig1" name="Approval Signal"/>
  <message id="msg1" name="Review Message"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<signal id="sig1" name="Approval Signal"/>');
		expect(mergedXml).toContain('<message id="msg1" name="Review Message"/>');
	});

	test('preserves unsupported metadata when serialized signal definitions are reordered', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/root-definitions">
  <signal id="sigA" name="Alpha" custom:flag="one"/>
  <signal id="sigB" name="Beta" custom:flag="two"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/root-definitions">
  <signal id="sigB" name="Beta" custom:flag="two"/>
  <signal id="sigA" name="Alpha" custom:flag="one"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml.indexOf('id="sigB"')).toBeLessThan(mergedXml.indexOf('id="sigA"'));
		expect(mergedXml).toContain('<signal id="sigB" name="Beta" custom:flag="two"/>');
		expect(mergedXml).toContain('<signal id="sigA" name="Alpha" custom:flag="one"/>');
	});

	test('preserves serialized removals of signal and message definitions when state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <signal id="sig1" name="Approval Signal"/>
  <message id="msg1" name="Review Message"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('id="sig1"');
		expect(mergedXml).not.toContain('id="msg1"');
	});

	test('preserves lexical content inside managed extension children on round-trip', () => {
		const state = extractFlowableDocumentState(lexicalManagedExtensionChildrenFixture);
		const mergedXml = mergeFlowableDocumentXml(
			lexicalManagedExtensionChildrenFixture,
			lexicalManagedExtensionChildrenFixture,
			state,
		);

		expect(mergedXml).toContain('<!-- field level comment -->');
		expect(mergedXml).toContain('<!-- trailing field comment -->');
		expect(mergedXml).toContain('<custom:hint code="payload-json"/>');
		expect(mergedXml).toContain('<activiti:string>{"status":"ready"}</activiti:string>');
		expect(mergedXml).toContain('<activiti:expression>${tenantResolver.currentTenant()}</activiti:expression>');
	});

	test('preserves process-scoped metadata when a process id is renamed', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-rename">
  <process id="mainProcess" isExecutable="true">
    <startEvent id="mainStart"/>
  </process>
  <process id="secondaryProcess" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" delegateExpression="\${secondaryListener}" entityType="execution"/>
      <activiti:localization locale="de" name="Sekundaerer Prozess">
        <activiti:documentation>Sekundaere Prozessbeschreibung</activiti:documentation>
      </activiti:localization>
    </extensionElements>
    <dataObject id="secondaryPayload" name="secondaryPayload" itemSubjectRef="xsd:string">
      <extensionElements>
        <activiti:value>secondary-value</activiti:value>
      </extensionElements>
    </dataObject>
    <startEvent id="secondaryStart"/>
  </process>
</definitions>`;
		const serializedXml = originalXml.replace(/secondaryProcess/g, 'secondaryProcessRenamed');

		const state = extractFlowableDocumentState(originalXml);
		assertDefined(state.elements.secondaryProcess);
		state.elements.secondaryProcessRenamed = {
			...state.elements.secondaryProcess,
			id: 'secondaryProcessRenamed',
		};
		delete state.elements.secondaryProcess;

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('id="secondaryProcessRenamed"');
		expect(mergedXml).toContain('delegateExpression="${secondaryListener}"');
		expect(mergedXml).toContain('Sekundaere Prozessbeschreibung');
		expect(mergedXml).toContain('<dataObject id="secondaryPayload" name="secondaryPayload" itemSubjectRef="xsd:string">');
		expect(restoredState.eventListeners.map((listener) => listener.processId)).toContain('secondaryProcessRenamed');
		expect(restoredState.localizations.map((localization) => localization.processId)).toContain('secondaryProcessRenamed');
		expect(restoredState.dataObjects.map((dataObject) => dataObject.processId)).toContain('secondaryProcessRenamed');
	});

	test('preserves edited process-scoped metadata when a renamed process also changes structure', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-rename-structure">
  <process id="mainProcess" isExecutable="true">
    <startEvent id="mainStart"/>
  </process>
  <process id="secondaryProcess" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" delegateExpression="\${secondaryListener}" entityType="execution"/>
      <activiti:localization locale="de" name="Sekundaerer Prozess"/>
    </extensionElements>
    <dataObject id="secondaryPayload" name="secondaryPayload" itemSubjectRef="xsd:string"/>
    <startEvent id="secondaryStart"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-rename-structure">
  <process id="mainProcess" isExecutable="true">
    <startEvent id="mainStart"/>
  </process>
  <process id="secondaryProcessRenamed" isExecutable="true">
    <serviceTask id="replacementTask"/>
    <startEvent id="secondaryStart"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		assertDefined(state.elements.secondaryProcess);
		state.elements.secondaryProcessRenamed = {
			...state.elements.secondaryProcess,
			id: 'secondaryProcessRenamed',
		};
		delete state.elements.secondaryProcess;
		state.eventListeners[0].implementation = '${editedListener}';
		state.localizations[0].name = 'Sekundaerer Prozess Bearbeitet';
		state.dataObjects[0].name = 'secondaryPayloadEdited';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('id="secondaryProcessRenamed"');
		expect(mergedXml).toContain('delegateExpression="${editedListener}"');
		expect(mergedXml).toContain('Sekundaerer Prozess Bearbeitet');
		expect(mergedXml).toContain('<dataObject id="secondaryPayload" name="secondaryPayloadEdited" itemSubjectRef="xsd:string"/>');
		expect(mergedXml).toContain('<serviceTask id="replacementTask"/>');
		expect(restoredState.eventListeners).toEqual([
			expect.objectContaining({
				processId: 'secondaryProcessRenamed',
				implementation: '${editedListener}',
			}),
		]);
		expect(restoredState.localizations).toEqual([
			expect.objectContaining({
				processId: 'secondaryProcessRenamed',
				name: 'Sekundaerer Prozess Bearbeitet',
			}),
		]);
		expect(restoredState.dataObjects).toEqual([
			expect.objectContaining({
				processId: 'secondaryProcessRenamed',
				name: 'secondaryPayloadEdited',
			}),
		]);
	});

	test('does not remap deleted process metadata onto an unrelated replacement process', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-replacement">
  <process id="legacyProcess" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" delegateExpression="\${legacyListener}"/>
      <activiti:localization locale="en" name="Legacy Process"/>
    </extensionElements>
    <dataObject id="legacyPayload" name="Legacy Payload" itemSubjectRef="xsd:string"/>
    <startEvent id="legacyStart"/>
  </process>
  <process id="stableProcess" isExecutable="true">
    <startEvent id="stableStart"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-replacement">
  <process id="replacementProcess" isExecutable="true">
    <serviceTask id="replacementTask"/>
  </process>
  <process id="stableProcess" isExecutable="true">
    <startEvent id="stableStart"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('id="replacementProcess"');
		expect(mergedXml).not.toContain('${legacyListener}');
		expect(mergedXml).not.toContain('Legacy Process');
		expect(mergedXml).not.toContain('id="legacyPayload"');
		expect(restoredState.eventListeners).toHaveLength(0);
		expect(restoredState.localizations).toHaveLength(0);
		expect(restoredState.dataObjects).toHaveLength(0);
	});

	test('preserves process-scoped metadata edits when a renamed process survives a count change', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-rename-count-change">
  <process id="legacyProcess" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" delegateExpression="\${legacyListener}"/>
      <activiti:localization locale="en" name="Legacy Process"/>
    </extensionElements>
    <dataObject id="legacyPayload" name="Legacy Payload" itemSubjectRef="xsd:string"/>
    <startEvent id="legacyStart"/>
  </process>
  <process id="removedProcess" isExecutable="true">
    <startEvent id="removedStart"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-rename-count-change">
  <process id="renamedProcess" isExecutable="true">
    <startEvent id="legacyStart"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.eventListeners[0].implementation = '${editedListener}';
		state.localizations[0].name = 'Renamed Process';
		state.dataObjects[0].name = 'legacyPayloadEdited';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('id="renamedProcess"');
		expect(mergedXml).toContain('delegateExpression="${editedListener}"');
		expect(mergedXml).toContain('name="Renamed Process"');
		expect(mergedXml).toContain('<dataObject id="legacyPayload" name="legacyPayloadEdited" itemSubjectRef="xsd:string"/>');
		expect(restoredState.eventListeners).toEqual([
			expect.objectContaining({
				processId: 'renamedProcess',
				implementation: '${editedListener}',
			}),
		]);
		expect(restoredState.localizations).toEqual([
			expect.objectContaining({
				processId: 'renamedProcess',
				name: 'Renamed Process',
			}),
		]);
		expect(restoredState.dataObjects).toEqual([
			expect.objectContaining({
				processId: 'renamedProcess',
				name: 'legacyPayloadEdited',
			}),
		]);
	});

	test('preserves serialized process-scoped listener and localization edits when state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-scoped-serialized">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_CREATED" class="com.example.ListenerA"/>
      <activiti:localization locale="en" name="Old Name"/>
    </extensionElements>
    <startEvent id="start1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-scoped-serialized">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" class="com.example.ListenerB"/>
      <activiti:localization locale="en" name="New Name"/>
    </extensionElements>
    <startEvent id="start1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('events="ENTITY_UPDATED"');
		expect(mergedXml).toContain('class="com.example.ListenerB"');
		expect(mergedXml).toContain('<activiti:localization locale="en" name="New Name"/>');
	});

	test('does not duplicate a process-scoped listener when serialized and sidebar edits overlap', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-listener-overlap">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" class="com.example.ListenerA"/>
    </extensionElements>
    <startEvent id="start1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/process-listener-overlap">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:eventListener events="ENTITY_UPDATED" class="com.example.ListenerB" entityType="execution"/>
    </extensionElements>
    <startEvent id="start1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.eventListeners[0].implementation = '${editedListener}';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml.match(/<activiti:eventListener\b/g)?.length).toBe(1);
		expect(restoredState.eventListeners).toEqual([
			expect.objectContaining({
				processId: 'Process_1',
				events: 'ENTITY_UPDATED',
				implementation: '${editedListener}',
				entityType: 'execution',
			}),
		]);
	});

	test('keeps edited data objects when a serialized process id is renamed', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/renamed-data-object">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data1" name="Old Name" itemSubjectRef="xsd:string"/>
    <startEvent id="start1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/renamed-data-object">
  <process id="Process_2" isExecutable="true">
    <dataObject id="data1" name="Old Name" itemSubjectRef="xsd:string"/>
    <startEvent id="start1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.dataObjects[0].name = 'Edited Name';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('<process id="Process_2" isExecutable="true">');
		expect(mergedXml).toContain('<dataObject id="data1" name="Edited Name" itemSubjectRef="xsd:string"/>');
		expect(restoredState.dataObjects).toEqual([
			expect.objectContaining({
				processId: 'Process_2',
				id: 'data1',
				name: 'Edited Name',
			}),
		]);
	});

	test('preserves service task metadata when a serialized element id is renamed', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/element-rename">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Call service" activiti:class="com.example.OriginalDelegate">
      <extensionElements>
        <activiti:field name="tenantId">
          <activiti:string>acme</activiti:string>
        </activiti:field>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/element-rename">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task2" name="Call service"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('<serviceTask id="task2" name="Call service" activiti:class="com.example.OriginalDelegate">');
		expect(mergedXml).toContain('<activiti:field name="tenantId">');
		expect(restoredState.elements.task2.activitiAttributes.class).toBe('com.example.OriginalDelegate');
		expect(restoredState.elements.task2.fieldExtensions).toEqual([
			expect.objectContaining({
				name: 'tenantId',
				value: 'acme',
			}),
		]);
		expect(restoredState.elements.task1).toBeUndefined();
	});

	test('inserts new data objects after process metadata nodes', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/data-order">
  <process id="Process_1" isExecutable="true">
    <extensionElements>
      <activiti:localization locale="en" name="Process"/>
    </extensionElements>
    <startEvent id="start1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.dataObjects.push({
			id: 'data1',
			processId: 'Process_1',
			name: 'Payload',
			itemSubjectRef: 'xsd:string',
			defaultValue: '',
		});

		const mergedXml = mergeFlowableDocumentXml(originalXml, originalXml, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const processElement = mergedDoc.getElementsByTagName('process')[0];

		assertDefined(processElement);
		expect(directChildElementNames(processElement).slice(0, 3)).toEqual([
			'extensionElements',
			'dataObject',
			'startEvent',
		]);
	});

	test('keeps lexical payload attached to duplicate managed nodes after reorder', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/duplicate-managed">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <activiti:field name="config">
          <!-- first -->
          <activiti:string>A</activiti:string>
          <custom:hint code="first"/>
        </activiti:field>
        <activiti:field name="config">
          <!-- second -->
          <activiti:string>B</activiti:string>
          <custom:hint code="second"/>
        </activiti:field>
      </extensionElements>
    </serviceTask>
  </process>
		</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const serviceTask = state.elements.task1;
		assertDefined(serviceTask);
		serviceTask.fieldExtensions = [serviceTask.fieldExtensions[1], serviceTask.fieldExtensions[0]];

		const mergedXml = mergeFlowableDocumentXml(originalXml, originalXml, state);

		expect(mergedXml).toMatch(/<activiti:field name="config">\s*<!-- second -->\s*<activiti:string>B<\/activiti:string>\s*<custom:hint code="second"\/>\s*<\/activiti:field>/);
		expect(mergedXml).toMatch(/<activiti:field name="config">\s*<!-- first -->\s*<activiti:string>A<\/activiti:string>\s*<custom:hint code="first"\/>\s*<\/activiti:field>/);
		expect(mergedXml.indexOf('<!-- second -->')).toBeLessThan(mergedXml.indexOf('<!-- first -->'));
	});

	test('extracts and round-trips multi-process BPMN fixtures', () => {
		const state = extractFlowableDocumentState(legacyMultiProcessFixture);

		assertDefined(state.elements.mainProcess);
		assertDefined(state.elements.secondaryProcess);
		expect(state.elements.reviewTask.activitiAttributes.assignee).toBe('kermit');
		expect(state.elements.notifyTask.activitiAttributes.class).toBe('com.example.flowable.NotifyDelegate');
		expect(state.elements.notifyTask.fieldExtensions[0]?.name).toBe('channel');
		expect(state.eventListeners.map((listener) => `${listener.processId}:${listener.events}:${listener.implementation}`)).toEqual([
			'mainProcess:TASK_CREATED:com.example.flowable.MainAuditListener',
			'secondaryProcess:ENTITY_UPDATED:${secondaryListener}',
		]);
		expect(state.localizations.map((localization) => `${localization.processId}:${localization.locale}:${localization.name}`)).toEqual([
			'mainProcess:en:Main Process',
			'secondaryProcess:de:Sekundaerer Prozess',
		]);
		expect(state.dataObjects.map((dataObject) => `${dataObject.processId}:${dataObject.id}:${dataObject.defaultValue}`)).toEqual([
			'mainProcess:mainPayload:main-value',
			'secondaryProcess:secondaryPayload:secondary-value',
		]);

		const mergedXml = mergeFlowableDocumentXml(legacyMultiProcessFixture, legacyMultiProcessFixture, state);
		const mergedDoc = parseXmlDocument(mergedXml);
		const mergedDefinitions = mergedDoc.documentElement!;
		const restoredState = extractFlowableDocumentState(mergedXml);
		expect(directChildElementIds(mergedDefinitions).filter((id) => id === 'mainProcess' || id === 'secondaryProcess')).toEqual([
			'mainProcess',
			'secondaryProcess',
		]);
		expect(mergedXml).toContain('<bpmndi:BPMNDiagram id="BPMNDiagram_mainProcess">');
		expect(mergedXml).toContain('<bpmndi:BPMNDiagram id="BPMNDiagram_secondaryProcess">');
		expect(mergedXml).toContain('activiti:assignee="kermit"');
		expect(mergedXml).toContain('activiti:class="com.example.flowable.NotifyDelegate"');
		expect(mergedXml).toContain('class="com.example.flowable.MainAuditListener"');
		expect(mergedXml).toContain('delegateExpression="${secondaryListener}"');
		expect(mergedXml).toContain('Main process localization');
		expect(mergedXml).toContain('Sekundaere Prozessbeschreibung');
		expect(restoredState.eventListeners.map((listener) => `${listener.processId}:${listener.events}:${listener.implementation}`)).toEqual([
			'mainProcess:TASK_CREATED:com.example.flowable.MainAuditListener',
			'secondaryProcess:ENTITY_UPDATED:${secondaryListener}',
		]);
		expect(restoredState.dataObjects.map((dataObject) => `${dataObject.processId}:${dataObject.id}:${dataObject.defaultValue}`)).toEqual([
			'mainProcess:mainPayload:main-value',
			'secondaryProcess:secondaryPayload:secondary-value',
		]);
	});

	test('preserves newly added signal event definitions from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/signal-event">
  <signal id="sig1" name="Approval Signal"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/signal-event">
  <signal id="sig1" name="Approval Signal"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start">
      <signalEventDefinition signalRef="sig1"/>
    </startEvent>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.elements.start1.signalRef = 'sig1';
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<signalEventDefinition signalRef="sig1"/>');
	});

	test('preserves serialized data object additions when state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data1" name="Payload" itemSubjectRef="xsd:string"/>
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<dataObject id="data1" name="Payload" itemSubjectRef="xsd:string"/>');
	});

	test('preserves serialized data object removals when state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data1" name="Payload" itemSubjectRef="xsd:string"/>
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('id="data1"');
	});

	test('preserves new unsupported extension children from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:added flag="yes"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toMatch(/<custom:added flag="yes"(?:\s+xmlns:custom="http:\/\/example.com\/custom")?\/>/);
	});

	test('preserves new unsupported process extension children from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<custom:added flag="yes"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toMatch(/<custom:added flag="yes"(?:\s+xmlns:custom="http:\/\/example.com\/custom")?\/>/);
	});

	test('replaces edited unsupported process extension children from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
			<custom:added flag="old"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
			<custom:added flag="new"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>');
		expect(mergedXml).toMatch(/<custom:added flag="new"(?:\s+xmlns:custom="http:\/\/example.com\/custom")?\/>/);
		expect(mergedXml).not.toContain('flag="old"');
		expect(mergedXml.match(/<custom:added\b/g)?.length).toBe(1);
	});

	test('preserves serialized removals of unsupported process extension children', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
			<custom:first code="A"/>
			<custom:second code="B"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
			<custom:second code="B"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>');
		expect(mergedXml).not.toContain('<custom:first code="A"');
		expect(mergedXml.match(/<custom:second\b/g)?.length).toBe(1);
	});

	test('preserves removal of the last unsupported process extension child', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
			<custom:only code="A"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('<custom:only code="A"');
		expect(mergedXml).toContain('<activiti:eventListener events="PROCESS_COMPLETED" class="com.example.Listener"/>');
	});

	test('honors source-authored removal of the last unsupported process extension child when the container disappears', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<extensionElements>
			<custom:only code="A"/>
		</extensionElements>
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
	<process id="Process_1" isExecutable="true">
		<startEvent id="start1" name="Start"/>
	</process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).not.toContain('<custom:only code="A"');
		expect(mergedXml).not.toContain('<extensionElements>');
	});

	test('replaces edited unsupported extension children from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:added flag="old"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:added flag="new"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toMatch(/<custom:added flag="new"(?:\s+xmlns:custom="http:\/\/example.com\/custom")?\/>/);
		expect(mergedXml).not.toContain('flag="old"');
		expect(mergedXml.match(/<custom:added\b/g)?.length).toBe(1);
	});

	test('preserves serialized removals of unsupported extension children', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:first code="A"/>
        <custom:second code="B"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:second code="B"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('<custom:first code="A"');
		expect(mergedXml.match(/<custom:second\b/g)?.length).toBe(1);
	});

	test('preserves removal of the last unsupported extension child', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
				<activiti:field name="endpoint">
					<activiti:string>https://example.com</activiti:string>
				</activiti:field>
        <custom:only code="A"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
		<serviceTask id="task1" name="Task">
			<extensionElements>
				<activiti:field name="endpoint">
					<activiti:string>https://example.com</activiti:string>
				</activiti:field>
			</extensionElements>
		</serviceTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('<custom:only code="A"');
		expect(mergedXml).toContain('<activiti:field name="endpoint">');
	});

	test('honors source-authored removal of the last unsupported extension child when the container disappears', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task">
      <extensionElements>
        <custom:only code="A"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="http://example.com/custom" targetNamespace="http://example.com/custom-extension">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1" name="Task"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).not.toContain('<custom:only code="A"');
		expect(mergedXml).not.toContain('<extensionElements>');
	});

	test('preserves serialized data object removals while keeping sidebar edits', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data1" name="Payload A" itemSubjectRef="xsd:string"/>
    <dataObject id="data2" name="Payload B" itemSubjectRef="xsd:string"/>
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/data-object">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data2" name="Payload B" itemSubjectRef="xsd:string"/>
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.dataObjects[1].name = 'Payload B Updated';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('id="data1"');
		expect(mergedXml).toContain('<dataObject id="data2" name="Payload B Updated" itemSubjectRef="xsd:string"/>');
	});

	test('preserves serialized signal ordering while applying sidebar edits', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <signal id="sigA" name="Alpha"/>
  <signal id="sigB" name="Beta"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/root-definitions">
  <signal id="sigB" name="Beta"/>
  <signal id="sigA" name="Alpha"/>
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		state.signalDefinitions[0].name = 'Alpha Updated';

		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml.indexOf('id="sigB"')).toBeLessThan(mergedXml.indexOf('id="sigA"'));
		expect(mergedXml).toContain('<signal id="sigA" name="Alpha Updated"/>');
	});

	test('preserves mixed inline documentation content around comments and cdata', () => {
		const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/mixed-content">
  <process id="Process_1" isExecutable="true">
    <documentation>alpha<!-- mid --><![CDATA[<beta>]]>gamma</documentation>
  </process>
</definitions>`;

		const mergedXml = mergeFlowableDocumentXml(fixture, fixture, extractFlowableDocumentState(fixture));
		const mergedDoc = parseXmlDocument(mergedXml);
		const documentation = mergedDoc.getElementsByTagName('documentation')[0];

		expect(mergedXml).toContain('<documentation>alpha<!-- mid --><![CDATA[<beta>]]>gamma</documentation>');
		expect(documentation?.textContent).toBe('alpha<beta>gamma');
	});

	test('preserves serialized documentation additions when sidebar state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/doc">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/doc">
  <process id="Process_1" isExecutable="true">
    <documentation>Added docs</documentation>
    <startEvent id="start1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<documentation>Added docs</documentation>');
	});

	test('preserves serialized condition expression additions when sidebar state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/condition">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="end1"/>
    <endEvent id="end1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/condition">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression">\${approved}</conditionExpression>
    </sequenceFlow>
    <endEvent id="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).toContain('<conditionExpression xsi:type="tFormalExpression">${approved}</conditionExpression>');
	});

	test('preserves serialized condition expression removals when sidebar state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/condition">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="end1">
      <conditionExpression xsi:type="tFormalExpression">\${approved}</conditionExpression>
    </sequenceFlow>
    <endEvent id="end1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://example.com/condition">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="end1"/>
    <endEvent id="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);

		expect(mergedXml).not.toContain('<conditionExpression');
	});

	test('preserves serialized multi-instance removals when sidebar state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/multi-instance">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Review">
      <multiInstanceLoopCharacteristics isSequential="true" activiti:collection="\${reviewers}" activiti:elementVariable="reviewer">
        <loopCardinality>3</loopCardinality>
      </multiInstanceLoopCharacteristics>
    </userTask>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/multi-instance">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1" name="Review"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).not.toContain('<multiInstanceLoopCharacteristics');
		expect(restoredState.elements.task1.multiInstance).toBeNull();
	});

	test('removes stale comments and processing instructions that disappeared from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="diagram-old.xsl"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/comments">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <!-- old between -->
    <endEvent id="end1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="diagram-new.xsl"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/comments">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <!-- new between -->
    <endEvent id="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('<!-- new between -->');
		expect(mergedXml).not.toContain('<!-- old between -->');
		expect(mergedXml).toContain('<?xml-stylesheet type="text/xsl" href="diagram-new.xsl"?>');
		expect(mergedXml).not.toContain('<?xml-stylesheet type="text/xsl" href="diagram-old.xsl"?>');
		expect(mergedXml.match(/<!-- new between -->/g)?.length).toBe(1);
	});

	test('removes the last lexical node when serialized BPMN no longer has any', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/comments">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <!-- stale comment -->
    <endEvent id="end1"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/comments">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1"/>
    <endEvent id="end1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).not.toContain('stale comment');
	});

	test('preserves newly added timer event definitions from serialized BPMN', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/timer-event">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/timer-event">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start">
      <timerEventDefinition>
        <timeDuration>PT5M</timeDuration>
      </timerEventDefinition>
    </startEvent>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).toContain('<timerEventDefinition>');
		expect(mergedXml).toContain('<timeDuration>PT5M</timeDuration>');
		expect(restoredState.elements.start1.timerDefinition).toEqual({ type: 'timeDuration', value: 'PT5M' });
	});

	test('preserves serialized timer event removals when sidebar state is unchanged', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/timer-event">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start">
      <timerEventDefinition>
        <timeDuration>PT5M</timeDuration>
      </timerEventDefinition>
    </startEvent>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/timer-event">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start1" name="Start"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state);
		const restoredState = extractFlowableDocumentState(mergedXml);

		expect(mergedXml).not.toContain('<timerEventDefinition>');
		expect(restoredState.elements.start1.timerDefinition).toBeNull();
	});
});
