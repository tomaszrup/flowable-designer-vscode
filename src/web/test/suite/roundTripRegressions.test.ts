import { describe, expect, test } from 'vitest';
import { extractFlowableDocumentState, mergeFlowableDocumentXml } from '../../flowable/roundTrip';
import { parseXmlDocument } from '../../flowable/xmlParser';
import { validateBpmnXml } from '../../flowable/validation';

describe('round-trip regressions', () => {
	test('normalizes legacy unprefixed Flowable attributes into managed activiti attributes', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start"/>
    <serviceTask id="task1" class="com.example.LegacyDelegate" async="true" exclusive="false"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		expect(state.elements.task1?.activitiAttributes.class).toBe('com.example.LegacyDelegate');
		expect(state.elements.task1?.activitiAttributes.async).toBe('true');
		expect(state.elements.task1?.activitiAttributes.exclusive).toBe('false');

		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);
		expect(mergedXml).toContain('activiti:class="com.example.LegacyDelegate"');
		expect(mergedXml).toContain('activiti:async="true"');
		expect(mergedXml).toContain('activiti:exclusive="false"');
		expect(mergedXml).not.toContain(' class="com.example.LegacyDelegate"');
		expect(mergedXml).not.toContain(' async="true"');
		expect(mergedXml).not.toContain(' exclusive="false"');
	});

	test('parses legacy listener implementation attributes and removes stale unqualified attributes on patch', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <userTask id="task1">
      <extensionElements>
        <activiti:taskListener event="create" class="com.example.LegacyListener"/>
      </extensionElements>
    </userTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		expect(state.elements.task1?.taskListeners[0]?.implementationType).toBe('class');
		expect(state.elements.task1?.taskListeners[0]?.implementation).toBe('com.example.LegacyListener');

		state.elements.task1.taskListeners[0] = {
			...state.elements.task1.taskListeners[0],
			implementationType: 'expression',
			implementation: '${listenerBean}',
		};

		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);
		expect(mergedXml).toContain('activiti:expression="${listenerBean}"');
		expect(mergedXml).not.toContain('class="com.example.LegacyListener"');
	});

	test('adds the activiti namespace for managed extension types without existing activiti declarations', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		state.elements.task1.inputParameters.push({ id: 'in-1', source: 'sourceVar', sourceExpression: '', target: 'targetVar' });
		state.elements.task1.failedJobRetryTimeCycle = 'R3/PT10M';
		state.elements.task1.exceptionMaps.push({ id: 'ex-1', errorCode: 'ERR', className: 'com.example.ExceptionMapper', includeChildExceptions: true });

		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);
		expect(mergedXml).toContain('xmlns:activiti="http://activiti.org/bpmn"');
		expect(mergedXml).toContain('<activiti:in source="sourceVar" target="targetVar"/>');
		expect(mergedXml).toContain('<activiti:failedJobRetryTimeCycle>R3/PT10M</activiti:failedJobRetryTimeCycle>');
		expect(mergedXml).toContain('<activiti:mapException errorCode="ERR" includeChildExceptions="true">com.example.ExceptionMapper</activiti:mapException>');
	});

	test('remaps stored compensate references when source XML renames the referenced activity', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start"/>
    <serviceTask id="task1"/>
    <intermediateThrowEvent id="compensateEvent">
      <compensateEventDefinition activityRef="task1"/>
    </intermediateThrowEvent>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="compensateEvent"/>
    <sequenceFlow id="flow3" sourceRef="compensateEvent" targetRef="end"/>
  </process>
</definitions>`;
		const serializedXml = originalXml
			.replace('id="task1"', 'id="taskRenamed"')
			.replace('activityRef="task1"', 'activityRef="taskRenamed"')
			.replace('sourceRef="start" targetRef="task1"', 'sourceRef="start" targetRef="taskRenamed"')
			.replace('sourceRef="task1" targetRef="compensateEvent"', 'sourceRef="taskRenamed" targetRef="compensateEvent"');

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'source' });

		expect(mergedXml).toContain('activityRef="taskRenamed"');
		expect(mergedXml).not.toContain('activityRef="task1"');
	});

	test('preserves custom namespaced value nodes under data object extension elements', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:foo="http://example.com/foo" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <dataObject id="data1" name="Data">
      <extensionElements>
        <foo:value>custom-default</foo:value>
      </extensionElements>
    </dataObject>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		expect(state.dataObjects[0]?.defaultValue).toBe('');

		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);
		expect(mergedXml).toMatch(/<foo:value(?:\s+xmlns:foo="http:\/\/example\.com\/foo")?>custom-default<\/foo:value>/);
		expect(mergedXml).not.toContain('<activiti:value>');
	});

	test('preserves mixed-content extension XML without injected formatting changes', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:foo="http://example.com/foo" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <serviceTask id="task1">
      <extensionElements>
        <foo:custom>text <foo:child/> tail</foo:custom>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);

		expect(mergedXml).toMatch(/<foo:custom(?:\s+xmlns:foo="http:\/\/example\.com\/foo")?>text <foo:child(?:\s+xmlns:foo="http:\/\/example\.com\/foo")?\/?> tail<\/foo:custom>/);
	});

	test('adds the xsd namespace when managed data objects reference xsd QNames', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true"/>
</definitions>`;

		const state = extractFlowableDocumentState(xml);
		state.dataObjects.push({ id: 'data1', processId: 'Process_1', name: 'Status', itemSubjectRef: 'xsd:string', defaultValue: '' });

		const mergedXml = mergeFlowableDocumentXml(xml, xml, state);
		expect(mergedXml).toContain('xmlns:xsd="http://www.w3.org/2001/XMLSchema"');
		expect(mergedXml).toContain('itemSubjectRef="xsd:string"');
	});

	test('allows comment text containing doctype markers while still rejecting real doctype declarations', () => {
		const commentXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <!-- literal <!DOCTYPE sample> text for documentation -->
  <process id="Process_1" isExecutable="true"/>
</definitions>`;

		expect(() => parseXmlDocument(commentXml)).not.toThrow();
		expect(() => parseXmlDocument(`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE definitions><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"/>`)).toThrow(/DOCTYPE/);
	});

	test('preserves existing comments for designer-origin merges when serialized BPMN omits lexical nodes', () => {
		const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start" name="Start"/>
    <!-- keep this comment -->
    <endEvent id="end" name="End"/>
  </process>
</definitions>`;
		const serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start" name="Renamed Start"/>
    <endEvent id="end" name="End"/>
  </process>
</definitions>`;

		const state = extractFlowableDocumentState(originalXml);
		const mergedXml = mergeFlowableDocumentXml(serializedXml, originalXml, state, { origin: 'designer' });

		expect(mergedXml).toContain('<!-- keep this comment -->');
		expect(mergedXml).toContain('name="Renamed Start"');
	});

	test('reports duplicate flow node ids during validation', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <startEvent id="start"/>
    <userTask id="dup"/>
    <serviceTask id="dup"/>
    <endEvent id="end"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="dup"/>
    <sequenceFlow id="flow2" sourceRef="dup" targetRef="end"/>
  </process>
</definitions>`;

		const issues = validateBpmnXml(xml);
		expect(issues.some((issue) => issue.elementId === 'dup' && issue.message.includes('Duplicate flow node id'))).toBe(true);
	});

	test('keeps nested subprocess events from satisfying top-level process start/end counts', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://example.com/test">
  <process id="Process_1" isExecutable="true">
    <subProcess id="sub1">
      <startEvent id="subStart"/>
      <endEvent id="subEnd"/>
      <sequenceFlow id="subFlow" sourceRef="subStart" targetRef="subEnd"/>
    </subProcess>
  </process>
</definitions>`;

		const issues = validateBpmnXml(xml);
		expect(issues.some((issue) => issue.elementId === 'Process_1' && issue.message.includes('no start event'))).toBe(true);
		expect(issues.some((issue) => issue.elementId === 'Process_1' && issue.message.includes('no end event'))).toBe(true);
	});
});