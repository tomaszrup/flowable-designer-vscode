import { describe, test, expect } from 'vitest';
import {
	type BpmnElement,
	getBusinessObject,
	getElementId,
	getElementType,
	getEventDefinitionType,
	isActivity,
	isBoundaryEvent,
	isBusinessRuleTask,
	isCallActivity,
	isEndEvent,
	isEventElement,
	isEventSubProcess,
	isExternalWorkerTask,
	isFlowNode,
	isGateway,
	isGenericServiceTask,
	isHttpTask,
	isIntermediateCatchEvent,
	isIntermediateThrowEvent,
	isLane,
	isMailTask,
	isManualTask,
	isParticipant,
	isProcess,
	isReceiveTask,
	isScriptTask,
	isSendTask,
	isSequenceFlow,
	isServiceTask,
	isShellTask,
	isStartEvent,
	isSubProcess,
	isSubProcessType,
	isTextAnnotation,
	isTransaction,
	isUserTask,
} from '../../webview/bpmnTypeGuards';

function makeElement(type: string, extra: Record<string, unknown> = {}): BpmnElement {
	return {
		id: 'el1',
		type,
		businessObject: { id: 'el1', $type: type, ...extra },
	};
}

function makeServiceTaskWithType(activitiType: string): BpmnElement {
	return {
		id: 'st1',
		type: 'bpmn:ServiceTask',
		businessObject: { id: 'st1', $type: 'bpmn:ServiceTask', 'activiti:type': activitiType },
	};
}

describe('bpmnTypeGuards', () => {
	describe('getBusinessObject', () => {
		test('returns businessObject from element', () => {
			const el = makeElement('bpmn:Task');
			expect(getBusinessObject(el)).toBe(el.businessObject);
		});

		test('falls back to element itself when businessObject is missing', () => {
			const el = { id: 'x', $type: 'bpmn:Task' } as unknown as BpmnElement;
			const bo = getBusinessObject(el);
			expect(bo.$type).toBe('bpmn:Task');
		});
	});

	describe('getElementId / getElementType', () => {
		test('returns id from businessObject', () => {
			expect(getElementId(makeElement('bpmn:Task'))).toBe('el1');
		});

		test('returns type from businessObject', () => {
			expect(getElementType(makeElement('bpmn:UserTask'))).toBe('bpmn:UserTask');
		});

		test('falls back to element.id when businessObject.id is empty', () => {
			const el: BpmnElement = {
				id: 'fallback',
				type: 'bpmn:Task',
				businessObject: { id: '', $type: 'bpmn:Task' },
			};
			expect(getElementId(el)).toBe('fallback');
		});
	});

	describe('simple type checks', () => {
		const cases: Array<[string, (el: BpmnElement) => boolean, string]> = [
			['isUserTask', isUserTask, 'bpmn:UserTask'],
			['isServiceTask', isServiceTask, 'bpmn:ServiceTask'],
			['isStartEvent', isStartEvent, 'bpmn:StartEvent'],
			['isProcess', isProcess, 'bpmn:Process'],
			['isSequenceFlow', isSequenceFlow, 'bpmn:SequenceFlow'],
			['isScriptTask', isScriptTask, 'bpmn:ScriptTask'],
			['isBusinessRuleTask', isBusinessRuleTask, 'bpmn:BusinessRuleTask'],
			['isCallActivity', isCallActivity, 'bpmn:CallActivity'],
			['isSendTask', isSendTask, 'bpmn:SendTask'],
			['isReceiveTask', isReceiveTask, 'bpmn:ReceiveTask'],
			['isManualTask', isManualTask, 'bpmn:ManualTask'],
			['isTextAnnotation', isTextAnnotation, 'bpmn:TextAnnotation'],
			['isParticipant', isParticipant, 'bpmn:Participant'],
			['isLane', isLane, 'bpmn:Lane'],
			['isSubProcess', isSubProcess, 'bpmn:SubProcess'],
			['isTransaction', isTransaction, 'bpmn:Transaction'],
			['isBoundaryEvent', isBoundaryEvent, 'bpmn:BoundaryEvent'],
			['isEndEvent', isEndEvent, 'bpmn:EndEvent'],
			['isIntermediateCatchEvent', isIntermediateCatchEvent, 'bpmn:IntermediateCatchEvent'],
			['isIntermediateThrowEvent', isIntermediateThrowEvent, 'bpmn:IntermediateThrowEvent'],
		];

		for (const [name, fn, matchType] of cases) {
			test(`${name} returns true for ${matchType}`, () => {
				expect(fn(makeElement(matchType))).toBe(true);
			});

			test(`${name} returns false for unrelated type`, () => {
				expect(fn(makeElement('bpmn:Unrelated'))).toBe(false);
			});
		}
	});

	describe('service task subtypes', () => {
		test('isMailTask identifies mail service tasks', () => {
			expect(isMailTask(makeServiceTaskWithType('mail'))).toBe(true);
			expect(isMailTask(makeServiceTaskWithType('http'))).toBe(false);
			expect(isMailTask(makeElement('bpmn:UserTask'))).toBe(false);
		});

		test('isHttpTask identifies http service tasks', () => {
			expect(isHttpTask(makeServiceTaskWithType('http'))).toBe(true);
			expect(isHttpTask(makeServiceTaskWithType('mail'))).toBe(false);
		});

		test('isShellTask identifies shell service tasks', () => {
			expect(isShellTask(makeServiceTaskWithType('shell'))).toBe(true);
			expect(isShellTask(makeServiceTaskWithType('http'))).toBe(false);
		});

		test('isExternalWorkerTask identifies external-worker service tasks', () => {
			expect(isExternalWorkerTask(makeServiceTaskWithType('external-worker'))).toBe(true);
			expect(isExternalWorkerTask(makeServiceTaskWithType('mail'))).toBe(false);
		});

		test('isGenericServiceTask returns true for plain service tasks', () => {
			expect(isGenericServiceTask(makeElement('bpmn:ServiceTask'))).toBe(true);
		});

		test('isGenericServiceTask returns false for typed service tasks', () => {
			expect(isGenericServiceTask(makeServiceTaskWithType('mail'))).toBe(false);
			expect(isGenericServiceTask(makeServiceTaskWithType('http'))).toBe(false);
			expect(isGenericServiceTask(makeServiceTaskWithType('shell'))).toBe(false);
			expect(isGenericServiceTask(makeServiceTaskWithType('external-worker'))).toBe(false);
		});
	});

	describe('composite type checks', () => {
		test('isActivity returns true for all activity types', () => {
			const activityTypes = [
				'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
				'bpmn:BusinessRuleTask', 'bpmn:CallActivity',
				'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask',
				'bpmn:SubProcess', 'bpmn:Transaction',
			];
			for (const type of activityTypes) {
				expect(isActivity(makeElement(type))).toBe(true);
			}
			expect(isActivity(makeElement('bpmn:StartEvent'))).toBe(false);
		});

		test('isGateway returns true for all gateway types', () => {
			const gwTypes = [
				'bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway',
				'bpmn:ParallelGateway', 'bpmn:EventBasedGateway',
				'bpmn:ComplexGateway',
			];
			for (const type of gwTypes) {
				expect(isGateway(makeElement(type))).toBe(true);
			}
			expect(isGateway(makeElement('bpmn:UserTask'))).toBe(false);
		});

		test('isEventElement covers all event types', () => {
			expect(isEventElement(makeElement('bpmn:StartEvent'))).toBe(true);
			expect(isEventElement(makeElement('bpmn:EndEvent'))).toBe(true);
			expect(isEventElement(makeElement('bpmn:BoundaryEvent'))).toBe(true);
			expect(isEventElement(makeElement('bpmn:IntermediateCatchEvent'))).toBe(true);
			expect(isEventElement(makeElement('bpmn:IntermediateThrowEvent'))).toBe(true);
			expect(isEventElement(makeElement('bpmn:UserTask'))).toBe(false);
		});

		test('isFlowNode covers activities, gateways, and events', () => {
			expect(isFlowNode(makeElement('bpmn:UserTask'))).toBe(true);
			expect(isFlowNode(makeElement('bpmn:ExclusiveGateway'))).toBe(true);
			expect(isFlowNode(makeElement('bpmn:StartEvent'))).toBe(true);
			expect(isFlowNode(makeElement('bpmn:EndEvent'))).toBe(true);
			expect(isFlowNode(makeElement('bpmn:SequenceFlow'))).toBe(false);
		});

		test('isSubProcessType covers SubProcess and Transaction', () => {
			expect(isSubProcessType(makeElement('bpmn:SubProcess'))).toBe(true);
			expect(isSubProcessType(makeElement('bpmn:Transaction'))).toBe(true);
			expect(isSubProcessType(makeElement('bpmn:UserTask'))).toBe(false);
		});
	});

	describe('isEventSubProcess', () => {
		test('returns true for subprocess with triggeredByEvent', () => {
			const el = makeElement('bpmn:SubProcess', { triggeredByEvent: true });
			expect(isEventSubProcess(el)).toBe(true);
		});

		test('returns false for regular subprocess', () => {
			expect(isEventSubProcess(makeElement('bpmn:SubProcess'))).toBe(false);
		});

		test('returns false for non-subprocess', () => {
			expect(isEventSubProcess(makeElement('bpmn:UserTask'))).toBe(false);
		});
	});

	describe('getEventDefinitionType', () => {
		test('returns null when no event definitions', () => {
			expect(getEventDefinitionType(makeElement('bpmn:StartEvent'))).toBeNull();
		});

		test('returns null for empty event definitions array', () => {
			const el = makeElement('bpmn:StartEvent', { eventDefinitions: [] });
			expect(getEventDefinitionType(el)).toBeNull();
		});

		test('returns the type of the first event definition', () => {
			const el = makeElement('bpmn:BoundaryEvent', {
				eventDefinitions: [{ $type: 'bpmn:TimerEventDefinition' }],
			});
			expect(getEventDefinitionType(el)).toBe('bpmn:TimerEventDefinition');
		});

		test('returns first type when multiple definitions exist', () => {
			const el = makeElement('bpmn:EndEvent', {
				eventDefinitions: [
					{ $type: 'bpmn:ErrorEventDefinition' },
					{ $type: 'bpmn:SignalEventDefinition' },
				],
			});
			expect(getEventDefinitionType(el)).toBe('bpmn:ErrorEventDefinition');
		});
	});
});
