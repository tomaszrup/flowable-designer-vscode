import type {
	FlowableEventListener,
	FlowableFieldExtension,
	FlowableFormProperty,
	FlowableIOParameter,
	FlowableListener,
	FlowableLocalization,
	FlowableMultiInstance,
} from '../types';
import { escapeXml } from './xmlUtils';

export function buildFieldExtensionNode(fieldExtension: FlowableFieldExtension): string {
	const tagName = fieldExtension.valueType === 'expression' ? 'activiti:expression' : 'activiti:string';
	return `<activiti:field name="${escapeXml(fieldExtension.name)}"><${tagName}>${escapeXml(fieldExtension.value)}</${tagName}></activiti:field>`;
}

export function buildListenerNode(tagName: 'activiti:taskListener' | 'activiti:executionListener', listener: FlowableListener): string {
	const implementationAttribute = `activiti:${listener.implementationType}`;
	return `<${tagName} event="${escapeXml(listener.event)}" ${implementationAttribute}="${escapeXml(listener.implementation)}"></${tagName}>`;
}

export function buildFormPropertyNode(formProperty: FlowableFormProperty): string {
	return `<activiti:formProperty id="${escapeXml(formProperty.id)}" name="${escapeXml(formProperty.name)}" type="${escapeXml(formProperty.type)}" required="${formProperty.required}" readable="${formProperty.readable}" writable="${formProperty.writable}" default="${escapeXml(formProperty.defaultValue)}"></activiti:formProperty>`;
}

export function buildIOParameterNode(tagName: string, param: FlowableIOParameter): string {
	const attrs: string[] = [];
	if (param.source) {
		attrs.push(`source="${escapeXml(param.source)}"`);
	}
	if (param.sourceExpression) {
		attrs.push(`sourceExpression="${escapeXml(param.sourceExpression)}"`);
	}
	attrs.push(`target="${escapeXml(param.target)}"`);
	return `<${tagName} ${attrs.join(' ')}/>`;
}

export function buildEventListenerNode(listener: FlowableEventListener): string {
	const attrs: string[] = [];
	if (listener.events) {
		attrs.push(`events="${escapeXml(listener.events)}"`);
	}
	if (listener.entityType) {
		attrs.push(`entityType="${escapeXml(listener.entityType)}"`);
	}

	switch (listener.implementationType) {
		case 'class':
			attrs.push(`class="${escapeXml(listener.implementation)}"`);
			break;
		case 'delegateExpression':
			attrs.push(`delegateExpression="${escapeXml(listener.implementation)}"`);
			break;
		case 'throwSignalEvent':
			attrs.push(`signalName="${escapeXml(listener.implementation)}"`);
			break;
		case 'throwGlobalSignalEvent':
			attrs.push(`signalName="${escapeXml(listener.implementation)}" throwGlobalEvent="true"`);
			break;
		case 'throwMessageEvent':
			attrs.push(`messageName="${escapeXml(listener.implementation)}"`);
			break;
		case 'throwErrorEvent':
			attrs.push(`errorCode="${escapeXml(listener.implementation)}"`);
			break;
	}

	return `<activiti:eventListener ${attrs.join(' ')}/>`;
}

export function buildLocalizationNode(localization: FlowableLocalization): string {
	const attrs = [`locale="${escapeXml(localization.locale)}"`];
	if (localization.name) {
		attrs.push(`name="${escapeXml(localization.name)}"`);
	}
	const inner = localization.description
		? `<activiti:documentation>${escapeXml(localization.description)}</activiti:documentation>`
		: '';
	return `<activiti:localization ${attrs.join(' ')}>${inner}</activiti:localization>`;
}

export function buildMultiInstanceNode(mi: FlowableMultiInstance): string {
	const attrs: string[] = [`isSequential="${mi.sequential}"`];
	if (mi.collection) {
		attrs.push(`activiti:collection="${escapeXml(mi.collection)}"`);
	}
	if (mi.elementVariable) {
		attrs.push(`activiti:elementVariable="${escapeXml(mi.elementVariable)}"`);
	}

	let inner = '';
	if (mi.loopCardinality) {
		inner += `<loopCardinality>${escapeXml(mi.loopCardinality)}</loopCardinality>`;
	}
	if (mi.completionCondition) {
		inner += `<completionCondition>${escapeXml(mi.completionCondition)}</completionCondition>`;
	}

	return `<multiInstanceLoopCharacteristics ${attrs.join(' ')}>${inner}</multiInstanceLoopCharacteristics>`;
}