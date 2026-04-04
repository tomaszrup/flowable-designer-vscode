import { describe, expect, it } from 'vitest';
import { extractFlowableDocumentState, mergeFlowableDocumentXml } from '../../flowable/roundTrip';
import { validateBpmnXml } from '../../flowable/validation';

const namespacedFlowableXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
	xmlns:flowable="http://activiti.org/bpmn"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	targetNamespace="urn:test">
	<bpmn:process id="Process_1" name="Namespaced Process" flowable:candidateStarterUsers="kermit">
		<bpmn:startEvent id="start" />
		<bpmn:serviceTask id="serviceTask" name="Call" flowable:class="com.example.LegacyDelegate">
			<bpmn:extensionElements>
				<flowable:field name="endpoint"><flowable:string>http://old</flowable:string></flowable:field>
			</bpmn:extensionElements>
		</bpmn:serviceTask>
		<bpmn:endEvent id="end" />
		<bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="serviceTask" />
		<bpmn:sequenceFlow id="flow2" sourceRef="serviceTask" targetRef="end" />
	</bpmn:process>
</bpmn:definitions>`;

describe('namespace-aware Flowable XML handling', () => {
	it('validates prefixed BPMN documents without missing-process errors', () => {
		const issues = validateBpmnXml(namespacedFlowableXml);
		expect(issues.some((issue) => issue.message.includes('No <process> element found'))).toBe(false);
		expect(issues.some((issue) => issue.message.includes('has no implementation'))).toBe(false);
	});

	it('extracts Flowable attributes from alternate namespace aliases', () => {
		const state = extractFlowableDocumentState(namespacedFlowableXml);
		expect(state.elements.Process_1?.activitiAttributes.candidateStarterUsers).toBe('kermit');
		expect(state.elements.serviceTask?.activitiAttributes.class).toBe('com.example.LegacyDelegate');
		expect(state.elements.serviceTask?.fieldExtensions[0]?.name).toBe('endpoint');
	});

	it('updates managed Flowable extension elements without duplicating aliased nodes', () => {
		const state = extractFlowableDocumentState(namespacedFlowableXml);
		state.elements.serviceTask.fieldExtensions[0].value = 'http://updated';

		const mergedXml = mergeFlowableDocumentXml(namespacedFlowableXml, namespacedFlowableXml, state, { origin: 'designer' });

		expect(mergedXml.match(/<(?:flowable|activiti):field\b/g)).toHaveLength(1);
		expect(mergedXml).toContain('http://updated');
	});
});