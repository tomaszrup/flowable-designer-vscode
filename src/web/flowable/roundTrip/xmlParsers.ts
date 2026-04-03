import type { Element as XmlElement } from '@xmldom/xmldom';
import type {
	FlowableEventListener,
	FlowableEventListenerImplType,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableMultiInstance,
	FlowableTimerDefinition,
	TimerDefinitionType,
} from '../types';
import { buildXmlIdentity, findDirectChild, getActivitiAttribute, getElementChildren, getLocalName } from './xmlUtils';

function resolveListenerImplementationType(element: XmlElement): FlowableListener['implementationType'] {
	if (getActivitiAttribute(element, 'class') || element.getAttribute('class')) {
		return 'class';
	}

	if (getActivitiAttribute(element, 'expression') || element.getAttribute('expression')) {
		return 'expression';
	}

	return 'delegateExpression';
}

export function parseFieldExtension(element: XmlElement): FlowableFieldExtension {
	const name = element.getAttribute('name') || '';
	const valueElement = getElementChildren(element)[0];
	const valueType = valueElement && getLocalName(valueElement) === 'expression' ? 'expression' : 'string';
	const value = valueElement?.textContent || '';

	return {
		id: `${name || 'field'}-${valueType}-${value}`,
		name,
		valueType,
		value,
		xmlIdentity: buildXmlIdentity('fieldExtension', element),
	};
}

export function parseListener(element: XmlElement): FlowableListener {
	const implementationType = resolveListenerImplementationType(element);
	const implementation =
		getActivitiAttribute(element, implementationType) ||
		element.getAttribute('class') ||
		element.getAttribute('expression') ||
		element.getAttribute('delegateExpression') ||
		'';

	return {
		id: `${element.nodeName}-${element.getAttribute('event') || 'event'}-${implementation}`,
		event: (element.getAttribute('event') || 'start') as FlowableListener['event'],
		implementationType,
		implementation,
		xmlIdentity: buildXmlIdentity('listener', element),
	};
}

export function parseFormProperty(element: XmlElement): FlowableFormProperty {
	return {
		id: element.getAttribute('id') || '',
		name: element.getAttribute('name') || '',
		type: (element.getAttribute('type') || 'string') as FlowableFormProperty['type'],
		required: (element.getAttribute('required') || '').toLowerCase() === 'true',
		readable: (element.getAttribute('readable') || 'true').toLowerCase() !== 'false',
		writable: (element.getAttribute('writable') || 'true').toLowerCase() !== 'false',
		defaultValue: element.getAttribute('default') || '',
		xmlIdentity: buildXmlIdentity('formProperty', element),
	};
}

export function parseIOParameter(element: XmlElement): FlowableIOParameter {
	return {
		id: `io-${element.getAttribute('source') || element.getAttribute('sourceExpression') || ''}-${element.getAttribute('target') || ''}`,
		source: element.getAttribute('source') || '',
		sourceExpression: element.getAttribute('sourceExpression') || '',
		target: element.getAttribute('target') || '',
		xmlIdentity: buildXmlIdentity('ioParameter', element),
	};
}

export function parseMultiInstance(element: XmlElement): FlowableMultiInstance {
	const loopCardinality = findDirectChild(element, 'loopCardinality');
	const completionCondition = findDirectChild(element, 'completionCondition');
	return {
		sequential: element.getAttribute('isSequential') === 'true',
		loopCardinality: loopCardinality?.textContent || '',
		collection: getActivitiAttribute(element, 'collection') || element.getAttribute('collection') || '',
		elementVariable: getActivitiAttribute(element, 'elementVariable') || element.getAttribute('elementVariable') || '',
		completionCondition: completionCondition?.textContent || '',
	};
}

export function parseTimerDefinition(element: XmlElement): FlowableTimerDefinition | null {
	const timerTypes: TimerDefinitionType[] = ['timeDuration', 'timeDate', 'timeCycle'];
	for (const type of timerTypes) {
		const child = findDirectChild(element, type);
		if (child) {
			return { type, value: child.textContent || '' };
		}
	}

	return { type: 'timeDuration', value: '' };
}

export function parseEventListener(element: XmlElement): FlowableEventListener {
	const events = element.getAttribute('events') || '';
	const className = element.getAttribute('class') || getActivitiAttribute(element, 'class') || '';
	const delegateExpr = element.getAttribute('delegateExpression') || getActivitiAttribute(element, 'delegateExpression') || '';
	const throwSignal = element.getAttribute('signalName') || '';
	const throwMessage = element.getAttribute('messageName') || '';
	const throwError = element.getAttribute('errorCode') || '';

	let implementationType: FlowableEventListenerImplType;
	let implementation = '';

	if (throwSignal) {
		const isGlobal = element.getAttribute('throwGlobalEvent') === 'true';
		implementationType = isGlobal ? 'throwGlobalSignalEvent' : 'throwSignalEvent';
		implementation = throwSignal;
	} else if (throwMessage) {
		implementationType = 'throwMessageEvent';
		implementation = throwMessage;
	} else if (throwError) {
		implementationType = 'throwErrorEvent';
		implementation = throwError;
	} else if (delegateExpr) {
		implementationType = 'delegateExpression';
		implementation = delegateExpr;
	} else {
		implementationType = 'class';
		implementation = className;
	}

	return {
		id: `eventListener-${events}-${implementation}`,
		events,
		implementationType,
		implementation,
		entityType: element.getAttribute('entityType') || '',
		xmlIdentity: buildXmlIdentity('processEventListener', element),
	};
}