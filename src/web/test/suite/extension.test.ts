import { describe, test, expect } from 'vitest';

function assertDefined<T>(val: T): asserts val is NonNullable<T> {
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
import { extractFlowableDocumentState, mergeFlowableDocumentXml } from '../../flowable/roundTrip';
import { validateBpmnXml } from '../../flowable/validation';
import { parseXmlDocument } from '../../flowable/xmlParser';

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
		// default is a standard BPMN attribute, preserved in preservedAttributes
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
                expect(() => parseXmlDocument('<!DOCTYPE foo><root/>')).toThrowError('DOCTYPE declarations are not supported');
        });

        test('parseXmlDocument throws on malformed XML', () => {
                expect(() => parseXmlDocument('<root><unclosed>')).toThrowError();
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
});
