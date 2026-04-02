import { XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import { parseXmlDocument } from './xmlParser';
import {
	cloneFlowableState,
	createEmptyFlowableState,
	FLOWABLE_ATTRIBUTE_KEYS,
	type FlowableAttributeKey,
	type FlowableDataObject,
	type FlowableDocumentState,
	type FlowableElementState,
	type FlowableEventListener,
	type FlowableEventListenerImplType,
	type FlowableExceptionMap,
	type FlowableFieldExtension,
	type FlowableFormProperty,
	type FlowableIOParameter,
	type FlowableListener,
	type FlowableLocalization,
	type FlowableMessageDefinition,
	type FlowableMultiInstance,
	type FlowableSignalDefinition,
	type FlowableTimerDefinition,
	type TimerDefinitionType,
	type XmlIdentified,
} from './types';

const ACTIVITI_NAMESPACE = 'http://activiti.org/bpmn';
const BPMN_MODEL_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';

const editableActivitiAttributes = new Set(FLOWABLE_ATTRIBUTE_KEYS.map((key) => `activiti:${key}`));
const serializer = new XMLSerializer();

const overlayManagedChildNames = new Set([
	'extensionElements',
	'documentation',
	'conditionExpression',
	'script',
	'multiInstanceLoopCharacteristics',
]);

const managedExtensionChildNames = new Set([
	'activiti:field',
	'activiti:in',
	'activiti:out',
	'activiti:taskListener',
	'activiti:executionListener',
	'activiti:formProperty',
	'activiti:failedJobRetryTimeCycle',
	'activiti:mapException',
	'activiti:eventListener',
	'activiti:localization',
]);

function getElementChildren(element: XmlElement): XmlElement[] {
	return Array.from(element.childNodes).filter((node): node is XmlElement => node.nodeType === node.ELEMENT_NODE);
}

function getLocalName(node: XmlNode): string {
	return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function isSameElementType(left: XmlElement, right: XmlElement): boolean {
	return getLocalName(left) === getLocalName(right) && (left.namespaceURI || '') === (right.namespaceURI || '');
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function escapeXmlText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function buildNamespaceWrapper(namespaces: Record<string, string>): string {
	const namespaceAttributes = Object.entries(namespaces)
		.map(([prefix, uri]) => `xmlns:${prefix}="${escapeXml(uri)}"`)
		.join(' ');

	return `<root xmlns="${BPMN_MODEL_NAMESPACE}" ${namespaceAttributes}>`;
}

function getNodeDocument(node: XmlNode): XmlDocument {
	return (node.ownerDocument || node) as XmlDocument;
}

function parseXmlFragment(xml: string, namespaces: Record<string, string>): XmlElement[] {
	const fragmentDocument = parseXmlDocument(`${buildNamespaceWrapper(namespaces)}${xml}</root>`);
	if (!fragmentDocument.documentElement) {
		return [];
	}
	return getElementChildren(fragmentDocument.documentElement);
}

function findDirectChild(element: XmlElement, localName: string): XmlElement | undefined {
	return getElementChildren(element).find((child) => getLocalName(child) === localName);
}

function buildXmlIdentity(scope: string, element: XmlElement): string {
	let index = 0;
	let sibling = element.previousSibling;
	while (sibling) {
		if (sibling.nodeType === sibling.ELEMENT_NODE && (sibling as XmlElement).nodeName === element.nodeName) {
			index++;
		}
		sibling = sibling.previousSibling;
	}
	return `${scope}:${element.nodeName}:${index}`;
}

function buildFieldExtensionNode(fieldExtension: FlowableFieldExtension): string {
	const tagName = fieldExtension.valueType === 'expression' ? 'activiti:expression' : 'activiti:string';
	return `<activiti:field name="${escapeXml(fieldExtension.name)}"><${tagName}>${escapeXml(fieldExtension.value)}</${tagName}></activiti:field>`;
}

function buildListenerNode(tagName: 'activiti:taskListener' | 'activiti:executionListener', listener: FlowableListener): string {
	const implementationAttribute = `activiti:${listener.implementationType}`;
	return `<${tagName} event="${escapeXml(listener.event)}" ${implementationAttribute}="${escapeXml(listener.implementation)}"></${tagName}>`;
}

function buildFormPropertyNode(formProperty: FlowableFormProperty): string {
	return `<activiti:formProperty id="${escapeXml(formProperty.id)}" name="${escapeXml(formProperty.name)}" type="${escapeXml(formProperty.type)}" required="${formProperty.required}" readable="${formProperty.readable}" writable="${formProperty.writable}" default="${escapeXml(formProperty.defaultValue)}"></activiti:formProperty>`;
}

function buildIOParameterNode(tagName: string, param: FlowableIOParameter): string {
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

function buildEventListenerNode(listener: FlowableEventListener): string {
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

function buildLocalizationNode(localization: FlowableLocalization): string {
	const attrs = [`locale="${escapeXml(localization.locale)}"`];
	if (localization.name) {
		attrs.push(`name="${escapeXml(localization.name)}"`);
	}
	const inner = localization.description
		? `<activiti:documentation>${escapeXml(localization.description)}</activiti:documentation>`
		: '';
	return `<activiti:localization ${attrs.join(' ')}>${inner}</activiti:localization>`;
}

function buildMultiInstanceNode(mi: FlowableMultiInstance): string {
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

function parseFieldExtension(element: XmlElement): FlowableFieldExtension {
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

function parseListener(element: XmlElement): FlowableListener {
	const implementationType = element.getAttribute('activiti:class')
		? 'class'
		: element.getAttribute('activiti:expression')
			? 'expression'
			: 'delegateExpression';
	const implementation =
		element.getAttribute(`activiti:${implementationType}`) ||
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

function parseFormProperty(element: XmlElement): FlowableFormProperty {
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

function parseIOParameter(element: XmlElement): FlowableIOParameter {
	return {
		id: `io-${element.getAttribute('source') || element.getAttribute('sourceExpression') || ''}-${element.getAttribute('target') || ''}`,
		source: element.getAttribute('source') || '',
		sourceExpression: element.getAttribute('sourceExpression') || '',
		target: element.getAttribute('target') || '',
		xmlIdentity: buildXmlIdentity('ioParameter', element),
	};
}

function parseMultiInstance(element: XmlElement): FlowableMultiInstance {
	const loopCardinality = findDirectChild(element, 'loopCardinality');
	const completionCondition = findDirectChild(element, 'completionCondition');
	return {
		sequential: element.getAttribute('isSequential') === 'true',
		loopCardinality: loopCardinality?.textContent || '',
		collection: element.getAttribute('activiti:collection') || element.getAttribute('collection') || '',
		elementVariable: element.getAttribute('activiti:elementVariable') || element.getAttribute('elementVariable') || '',
		completionCondition: completionCondition?.textContent || '',
	};
}

function parseTimerDefinition(element: XmlElement): FlowableTimerDefinition | null {
	const timerTypes: TimerDefinitionType[] = ['timeDuration', 'timeDate', 'timeCycle'];
	for (const type of timerTypes) {
		const child = findDirectChild(element, type);
		if (child) {
			return { type, value: child.textContent || '' };
		}
	}
	return { type: 'timeDuration', value: '' };
}

function parseEventListener(element: XmlElement): FlowableEventListener {
	const events = element.getAttribute('events') || '';
	const className = element.getAttribute('class') || element.getAttribute('activiti:class') || '';
	const delegateExpr = element.getAttribute('delegateExpression') || element.getAttribute('activiti:delegateExpression') || '';
	const throwSignal = element.getAttribute('signalName') || '';
	const throwMessage = element.getAttribute('messageName') || '';
	const throwError = element.getAttribute('errorCode') || '';

	let implementationType: FlowableEventListenerImplType = 'class';
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

function createElementState(id: string, type: string): FlowableElementState {
	return {
		id,
		type,
		activitiAttributes: {},
		fieldExtensions: [],
		taskListeners: [],
		executionListeners: [],
		formProperties: [],
		inputParameters: [],
		outputParameters: [],
		multiInstance: null,
		conditionExpression: '',
		script: '',
		timerDefinition: null,
		errorRef: '',
		signalRef: '',
		messageRef: '',
		terminateAll: '',
		compensateActivityRef: '',
		isForCompensation: '',
		failedJobRetryTimeCycle: '',
		exceptionMaps: [],
		documentation: '',
		preservedAttributes: {},
		preservedExtensionElements: [],
	};
}

function mergeElementState(
	originalState: FlowableElementState | undefined,
	incomingState: FlowableElementState | undefined,
): FlowableElementState | undefined {
	if (!originalState && !incomingState) {
		return undefined;
	}

	const base = originalState || incomingState;
	if (!base) {
		return undefined;
	}

	return {
		id: incomingState?.id || originalState?.id || base.id,
		type: incomingState?.type || originalState?.type || base.type,
		activitiAttributes: incomingState
			? { ...incomingState.activitiAttributes }
			: { ...originalState?.activitiAttributes },
		fieldExtensions: incomingState?.fieldExtensions
			? incomingState.fieldExtensions.map((field) => ({ ...field }))
			: originalState?.fieldExtensions.map((field) => ({ ...field })) || [],
		taskListeners: incomingState?.taskListeners
			? incomingState.taskListeners.map((listener) => ({ ...listener }))
			: originalState?.taskListeners.map((listener) => ({ ...listener })) || [],
		executionListeners: incomingState?.executionListeners
			? incomingState.executionListeners.map((listener) => ({ ...listener }))
			: originalState?.executionListeners.map((listener) => ({ ...listener })) || [],
		formProperties: incomingState?.formProperties
			? incomingState.formProperties.map((property) => ({ ...property }))
			: originalState?.formProperties.map((property) => ({ ...property })) || [],
		inputParameters: incomingState?.inputParameters
			? incomingState.inputParameters.map((param) => ({ ...param }))
			: originalState?.inputParameters.map((param) => ({ ...param })) || [],
		outputParameters: incomingState?.outputParameters
			? incomingState.outputParameters.map((param) => ({ ...param }))
			: originalState?.outputParameters.map((param) => ({ ...param })) || [],
		multiInstance: incomingState?.multiInstance !== undefined
			? (incomingState.multiInstance ? { ...incomingState.multiInstance } : null)
			: (originalState?.multiInstance ? { ...originalState.multiInstance } : null),
		conditionExpression: incomingState?.conditionExpression !== undefined
			? incomingState.conditionExpression
			: (originalState?.conditionExpression || ''),
		script: incomingState?.script !== undefined
			? incomingState.script
			: (originalState?.script || ''),
		timerDefinition: incomingState?.timerDefinition !== undefined
			? (incomingState.timerDefinition ? { ...incomingState.timerDefinition } : null)
			: (originalState?.timerDefinition ? { ...originalState.timerDefinition } : null),
		errorRef: incomingState?.errorRef !== undefined
			? incomingState.errorRef
			: (originalState?.errorRef || ''),
		signalRef: incomingState?.signalRef !== undefined
			? incomingState.signalRef
			: (originalState?.signalRef || ''),
		messageRef: incomingState?.messageRef !== undefined
			? incomingState.messageRef
			: (originalState?.messageRef || ''),
		terminateAll: incomingState?.terminateAll !== undefined
			? incomingState.terminateAll
			: (originalState?.terminateAll || ''),
		compensateActivityRef: incomingState?.compensateActivityRef !== undefined
			? incomingState.compensateActivityRef
			: (originalState?.compensateActivityRef || ''),
		isForCompensation: incomingState?.isForCompensation !== undefined
			? incomingState.isForCompensation
			: (originalState?.isForCompensation || ''),
		failedJobRetryTimeCycle: incomingState?.failedJobRetryTimeCycle !== undefined
			? incomingState.failedJobRetryTimeCycle
			: (originalState?.failedJobRetryTimeCycle || ''),
		exceptionMaps: incomingState?.exceptionMaps
			? incomingState.exceptionMaps.map((e) => ({ ...e }))
			: originalState?.exceptionMaps.map((e) => ({ ...e })) || [],
		documentation: incomingState?.documentation !== undefined
			? incomingState.documentation
			: (originalState?.documentation || ''),
		preservedAttributes: {
			...(originalState?.preservedAttributes || {}),
			...(incomingState?.preservedAttributes || {}),
		},
		preservedExtensionElements:
			incomingState?.preservedExtensionElements !== undefined && incomingState.preservedExtensionElements.length > 0
				? [...incomingState.preservedExtensionElements]
				: [...(originalState?.preservedExtensionElements || [])],
	};
}

function cloneIdentifiedCollection<T extends XmlIdentified>(items: T[]): T[] {
	return items.map((item) => ({ ...item }));
}

function stripXmlIdentity<T extends XmlIdentified>(item: T): Omit<T, 'xmlIdentity'> {
	const { xmlIdentity: _xmlIdentity, ...rest } = item;
	return rest;
}

function areCollectionsEquivalent<T extends XmlIdentified>(left: T[], right: T[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((item, index) => {
		const other = right[index];
		if (!other) {
			return false;
		}
		return JSON.stringify(stripXmlIdentity(item)) === JSON.stringify(stripXmlIdentity(other));
	});
}

function areItemsEquivalent<T extends XmlIdentified>(left: T | undefined, right: T | undefined): boolean {
	if (!left || !right) {
		return left === right;
	}

	return JSON.stringify(stripXmlIdentity(left)) === JSON.stringify(stripXmlIdentity(right));
}

function areCollectionKeysEquivalent<T extends XmlIdentified>(
	left: T[],
	right: T[],
	getKey: (item: T) => string,
): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((item, index) => getKey(item) === getKey(right[index]!));
}

function mergeSerializedCollectionItem<T extends XmlIdentified>(
	originalItem: T | undefined,
	serializedItem: T | undefined,
	incomingItem: T,
): T {
	const originalRecord = (originalItem || {}) as Record<string, unknown>;
	const serializedRecord = (serializedItem || {}) as Record<string, unknown>;
	const incomingRecord = incomingItem as unknown as Record<string, unknown>;
	const mergedRecord: Record<string, unknown> = {
		...((serializedItem || originalItem || incomingItem) as unknown as Record<string, unknown>),
	};
	const keys = new Set([
		...Object.keys(originalRecord),
		...Object.keys(serializedRecord),
		...Object.keys(incomingRecord),
	]);

	for (const key of keys) {
		if (key === 'xmlIdentity') {
			continue;
		}

		if (!originalItem) {
			mergedRecord[key] = incomingRecord[key];
			continue;
		}

		if (incomingRecord[key] !== originalRecord[key]) {
			mergedRecord[key] = incomingRecord[key];
			continue;
		}

		if (serializedItem && key in serializedRecord) {
			mergedRecord[key] = serializedRecord[key];
			continue;
		}

		mergedRecord[key] = incomingRecord[key];
	}

	mergedRecord.xmlIdentity = incomingItem.xmlIdentity || serializedItem?.xmlIdentity || originalItem?.xmlIdentity;
	return mergedRecord as T;
}

function mergeSerializedCollectionState<T extends XmlIdentified>(
	originalItems: T[],
	serializedItems: T[],
	incomingItems: T[],
	getKey: (item: T) => string,
): T[] {
	if (areCollectionsEquivalent(incomingItems, originalItems)) {
		return cloneIdentifiedCollection(serializedItems);
	}

	const originalByKey = new Map(originalItems.map((item) => [getKey(item), item]));
	const serializedByKey = new Map(serializedItems.map((item) => [getKey(item), item]));
	const incomingByKey = new Map(incomingItems.map((item) => [getKey(item), item]));
	const incomingStructureMatchesOriginal = areCollectionKeysEquivalent(incomingItems, originalItems, getKey);
	const mergedItems: T[] = [];
	const includedKeys = new Set<string>();

	if (incomingStructureMatchesOriginal) {
		for (const serializedItem of serializedItems) {
			const key = getKey(serializedItem);
			const originalItem = originalByKey.get(key);
			const incomingItem = incomingByKey.get(key);

			if (!incomingItem) {
				if (!originalItem) {
					mergedItems.push({ ...serializedItem });
					includedKeys.add(key);
				}
				continue;
			}

			mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedItem, incomingItem));
			includedKeys.add(key);
		}

		for (const incomingItem of incomingItems) {
			const key = getKey(incomingItem);
			if (includedKeys.has(key)) {
				continue;
			}

			const originalItem = originalByKey.get(key);
			if (originalItem && areItemsEquivalent(incomingItem, originalItem)) {
				continue;
			}

			mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedByKey.get(key), incomingItem));
			includedKeys.add(key);
		}

		return mergedItems;
	}

	for (const incomingItem of incomingItems) {
		const key = getKey(incomingItem);
		const originalItem = originalByKey.get(key);
		const serializedItem = serializedByKey.get(key);

		if (!serializedItem && originalItem && areItemsEquivalent(incomingItem, originalItem)) {
			continue;
		}

		mergedItems.push(mergeSerializedCollectionItem(originalItem, serializedItem, incomingItem));
		includedKeys.add(key);
	}

	for (const serializedItem of serializedItems) {
		const key = getKey(serializedItem);
		if (includedKeys.has(key)) {
			continue;
		}

		if (!originalByKey.has(key)) {
			mergedItems.push({ ...serializedItem });
			includedKeys.add(key);
		}
	}

	return mergedItems;
}

function mergePreservedExtensionElements(baseElements: string[], serializedElements: string[]): string[] {
	if (serializedElements.length === 0) {
		return [...baseElements];
	}

	return [...serializedElements];
}

function ensureActivitiNamespace(documentState: FlowableDocumentState): void {
	const needsActivitiNamespace = Object.values(documentState.elements).some((elementState) => {
		return (
			Object.keys(elementState.activitiAttributes).length > 0 ||
			elementState.fieldExtensions.length > 0 ||
			elementState.taskListeners.length > 0 ||
			elementState.executionListeners.length > 0 ||
			elementState.formProperties.length > 0 ||
			(elementState.multiInstance !== null && (elementState.multiInstance.collection || elementState.multiInstance.elementVariable))
		);
	}) || documentState.signalDefinitions.some((signal) => Boolean(signal.scope))
		|| documentState.eventListeners.length > 0
		|| documentState.localizations.length > 0
		|| documentState.dataObjects.some((dataObject) => Boolean(dataObject.defaultValue));

	if (needsActivitiNamespace && !documentState.namespaces.activiti) {
		documentState.namespaces.activiti = ACTIVITI_NAMESPACE;
	}

	const needsXsiNamespace = Object.values(documentState.elements).some((elementState) => Boolean(elementState.conditionExpression));
	if (needsXsiNamespace && !documentState.namespaces.xsi) {
		documentState.namespaces.xsi = XSI_NAMESPACE;
	}
}

export function extractFlowableDocumentState(xml: string): FlowableDocumentState {
	const documentState = createEmptyFlowableState();
	const document = parseXmlDocument(xml);
	const definitions = document.documentElement;
	if (!definitions) {
		return documentState;
	}

	for (const attribute of Array.from(definitions.attributes)) {
		if (attribute.name.startsWith('xmlns:')) {
			documentState.namespaces[attribute.name.slice(6)] = attribute.value;
		}
	}

	documentState.targetNamespace = definitions.getAttribute('targetNamespace') || '';

	for (const child of getElementChildren(definitions)) {
		if (getLocalName(child) === 'signal') {
			const id = child.getAttribute('id');
			if (id) {
				documentState.signalDefinitions.push({
					id,
					name: child.getAttribute('name') || '',
					scope: child.getAttribute('activiti:scope') || '',
					xmlIdentity: buildXmlIdentity('signalDefinition', child),
				});
			}
			continue;
		}

		if (getLocalName(child) === 'message') {
			const id = child.getAttribute('id');
			if (id) {
				documentState.messageDefinitions.push({
					id,
					name: child.getAttribute('name') || '',
					xmlIdentity: buildXmlIdentity('messageDefinition', child),
				});
			}
		}
	}

	for (const processEl of Array.from(document.getElementsByTagName('process'))) {
		const extEl = findDirectChild(processEl as XmlElement, 'extensionElements');
		if (extEl) {
			for (const child of getElementChildren(extEl)) {
				if (child.nodeName === 'activiti:eventListener') {
					documentState.eventListeners.push(parseEventListener(child));
				} else if (child.nodeName === 'activiti:localization') {
					const locale = child.getAttribute('locale') || '';
					const name = child.getAttribute('name') || '';
					const docChild = findDirectChild(child, 'documentation');
					const description = docChild?.textContent || '';
					documentState.localizations.push({
						id: `localization-${locale}`,
						locale,
						name,
						description,
						xmlIdentity: buildXmlIdentity('processLocalization', child),
					});
				}
			}
		}

		for (const dataObjEl of getElementChildren(processEl as XmlElement)) {
			if (getLocalName(dataObjEl) === 'dataObject') {
				const id = dataObjEl.getAttribute('id') || '';
				const name = dataObjEl.getAttribute('name') || '';
				const itemSubjectRef = dataObjEl.getAttribute('itemSubjectRef') || '';
				let defaultValue = '';
				const extEls = findDirectChild(dataObjEl, 'extensionElements');
				if (extEls) {
					for (const extChild of getElementChildren(extEls)) {
						if (getLocalName(extChild) === 'value' || extChild.nodeName === 'activiti:value') {
							defaultValue = extChild.textContent || '';
						}
					}
				}
				if (id) {
					documentState.dataObjects.push({
						id,
						name,
						itemSubjectRef,
						defaultValue,
						xmlIdentity: buildXmlIdentity('dataObject', dataObjEl),
					});
				}
			}
		}
	}

	for (const node of Array.from(document.getElementsByTagName('*'))) {
		const id = node.getAttribute('id');
		if (!id) {
			continue;
		}

		const elementState = createElementState(id, node.nodeName);

		for (const attribute of Array.from(node.attributes)) {
			if (attribute.name.startsWith('xmlns:') || attribute.name === 'id') {
				continue;
			}

			if (editableActivitiAttributes.has(attribute.name)) {
				const key = attribute.name.slice('activiti:'.length) as FlowableAttributeKey;
				elementState.activitiAttributes[key] = attribute.value;
				continue;
			}

			if (attribute.name.includes(':')) {
				elementState.preservedAttributes[attribute.name] = attribute.value;
			}
		}

		const extensionElements = findDirectChild(node, 'extensionElements');
		if (extensionElements) {
			for (const child of getElementChildren(extensionElements)) {
				if (child.nodeName === 'activiti:field') {
					elementState.fieldExtensions.push(parseFieldExtension(child));
					continue;
				}

				if (child.nodeName === 'activiti:taskListener') {
					elementState.taskListeners.push(parseListener(child));
					continue;
				}

				if (child.nodeName === 'activiti:executionListener') {
					elementState.executionListeners.push(parseListener(child));
					continue;
				}

				if (child.nodeName === 'activiti:formProperty') {
					elementState.formProperties.push(parseFormProperty(child));
					continue;
				}

				if (child.nodeName === 'activiti:in') {
					elementState.inputParameters.push(parseIOParameter(child));
					continue;
				}

				if (child.nodeName === 'activiti:out') {
					elementState.outputParameters.push(parseIOParameter(child));
					continue;
				}

				if (child.nodeName === 'activiti:eventListener' || child.nodeName === 'activiti:localization') {
					continue;
				}

				if (child.nodeName === 'activiti:failedJobRetryTimeCycle') {
					elementState.failedJobRetryTimeCycle = child.textContent || '';
					continue;
				}

				if (child.nodeName === 'activiti:mapException') {
					const errorCode = child.getAttribute('errorCode') || '';
					const className = child.textContent || '';
					const includeChildExceptions = child.getAttribute('includeChildExceptions') === 'true';
					elementState.exceptionMaps.push({
						id: `exception-${errorCode}-${className}`,
						errorCode,
						className,
						includeChildExceptions,
						xmlIdentity: buildXmlIdentity('exceptionMap', child),
					});
					continue;
				}

				elementState.preservedExtensionElements.push(serializer.serializeToString(child));
			}
		}

		const documentationEl = findDirectChild(node, 'documentation');
		if (documentationEl) {
			elementState.documentation = documentationEl.textContent || '';
		}

		const conditionExpressionEl = findDirectChild(node, 'conditionExpression');
		if (conditionExpressionEl) {
			elementState.conditionExpression = conditionExpressionEl.textContent || '';
		}

		const scriptEl = findDirectChild(node, 'script');
		if (scriptEl) {
			elementState.script = scriptEl.textContent || '';
		}

		const multiInstanceEl = findDirectChild(node, 'multiInstanceLoopCharacteristics');
		if (multiInstanceEl) {
			elementState.multiInstance = parseMultiInstance(multiInstanceEl);
		}

		const timerEventDefEl = findDirectChild(node, 'timerEventDefinition');
		if (timerEventDefEl) {
			elementState.timerDefinition = parseTimerDefinition(timerEventDefEl);
		}

		const errorEventDefEl = findDirectChild(node, 'errorEventDefinition');
		if (errorEventDefEl) {
			elementState.errorRef = errorEventDefEl.getAttribute('errorRef') || '';
		}

		const signalEventDefEl = findDirectChild(node, 'signalEventDefinition');
		if (signalEventDefEl) {
			elementState.signalRef = signalEventDefEl.getAttribute('signalRef') || '';
		}

		const messageEventDefEl = findDirectChild(node, 'messageEventDefinition');
		if (messageEventDefEl) {
			elementState.messageRef = messageEventDefEl.getAttribute('messageRef') || '';
		}

		const terminateEventDefEl = findDirectChild(node, 'terminateEventDefinition');
		if (terminateEventDefEl) {
			elementState.terminateAll = terminateEventDefEl.getAttribute('activiti:terminateAll') || '';
		}

		const compensateEventDefEl = findDirectChild(node, 'compensateEventDefinition');
		if (compensateEventDefEl) {
			elementState.compensateActivityRef = compensateEventDefEl.getAttribute('activityRef') || '';
		}

		const isForCompensationAttr = node.getAttribute('isForCompensation');
		if (isForCompensationAttr) {
			elementState.isForCompensation = isForCompensationAttr;
		}

		documentState.elements[id] = elementState;
	}

	ensureActivitiNamespace(documentState);
	return documentState;
}

function buildIdMap(document: XmlDocument): Map<string, XmlElement> {
	const elementsById = new Map<string, XmlElement>();
	for (const element of Array.from(document.getElementsByTagName('*'))) {
		const id = element.getAttribute('id');
		if (id) {
			elementsById.set(id, element);
		}
	}
	return elementsById;
}

function collectNamespaceDeclarations(element: XmlElement): Record<string, string> {
	const namespaces: Record<string, string> = {};
	for (const attribute of Array.from(element.attributes)) {
		if (attribute.name.startsWith('xmlns:')) {
			namespaces[attribute.name.slice(6)] = attribute.value;
		}
	}
	return namespaces;
}

function shouldSyncStructuralAttribute(attributeName: string): boolean {
	if (editableActivitiAttributes.has(attributeName)) {
		return false;
	}

	return true;
}

function syncStructuralAttributes(target: XmlElement, source: XmlElement): void {
	const sourceAttributes = new Map<string, string>();
	for (const attribute of Array.from(source.attributes)) {
		if (!shouldSyncStructuralAttribute(attribute.name)) {
			continue;
		}
		sourceAttributes.set(attribute.name, attribute.value);
		if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) {
			target.setAttributeNS(XMLNS_NAMESPACE, attribute.name, attribute.value);
		} else {
			target.setAttribute(attribute.name, attribute.value);
		}
	}

	for (const attribute of Array.from(target.attributes)) {
		if (!shouldSyncStructuralAttribute(attribute.name)) {
			continue;
		}
		if (!sourceAttributes.has(attribute.name)) {
			if (attribute.name === 'xmlns') {
				target.removeAttribute('xmlns');
			} else if (attribute.name.startsWith('xmlns:')) {
				target.removeAttributeNS(XMLNS_NAMESPACE, attribute.localName || attribute.name.slice(6));
			} else {
				target.removeAttribute(attribute.name);
			}
		}
	}
}

function isStructuralChild(parent: XmlElement, child: XmlElement): boolean {
	const childLocalName = getLocalName(child);
	if (overlayManagedChildNames.has(childLocalName)) {
		return false;
	}

	const parentLocalName = getLocalName(parent);
	if (parentLocalName === 'definitions' && (childLocalName === 'signal' || childLocalName === 'message')) {
		return false;
	}

	if (parentLocalName === 'process' && childLocalName === 'dataObject') {
		return false;
	}

	return true;
}

function getStructuralChildKey(parent: XmlElement, child: XmlElement): string {
	const id = child.getAttribute('id');
	if (id) {
		return `id:${child.namespaceURI || ''}:${getLocalName(child)}:${id}`;
	}
	return buildXmlIdentity(`structural:${getLocalName(parent)}`, child);
}

function setTextContentPreservingComments(element: XmlElement, value: string): void {
	const removableNodes = Array.from(element.childNodes).filter((node) => {
		if (node.nodeType === node.TEXT_NODE) {
			return true;
		}
		return node.nodeType === node.CDATA_SECTION_NODE;
	});

	for (const node of removableNodes) {
		element.removeChild(node);
	}

	if (!value) {
		return;
	}

	const firstNonTextChild = Array.from(element.childNodes).find((node) => node.nodeType !== node.TEXT_NODE && node.nodeType !== node.CDATA_SECTION_NODE);
	const textNode = getNodeDocument(element).createTextNode(value);
	if (firstNonTextChild) {
		element.insertBefore(textNode, firstNonTextChild);
	} else {
		element.appendChild(textNode);
	}
}

function maybeSyncLeafText(target: XmlElement, source: XmlElement): void {
	const sourceElements = getElementChildren(source);
	const targetElements = getElementChildren(target);
	if (sourceElements.length > 0 || targetElements.length > 0) {
		return;
	}

	const sourceHasComments = Array.from(source.childNodes).some((node) => node.nodeType === node.COMMENT_NODE || node.nodeType === node.PROCESSING_INSTRUCTION_NODE);
	const targetHasComments = Array.from(target.childNodes).some((node) => node.nodeType === node.COMMENT_NODE || node.nodeType === node.PROCESSING_INSTRUCTION_NODE);
	if (sourceHasComments || targetHasComments) {
		return;
	}

	const sourceText = source.textContent || '';
	const targetText = target.textContent || '';
	if (sourceText !== targetText) {
		setTextContentPreservingComments(target, sourceText);
	}
}

function insertAfter(parent: XmlNode, newNode: XmlNode, referenceNode: XmlNode): void {
	if (referenceNode.nextSibling) {
		parent.insertBefore(newNode, referenceNode.nextSibling);
	} else {
		parent.appendChild(newNode);
	}
}

function indexNodeById(idMap: Map<string, XmlElement>, node: XmlNode): void {
	if (node.nodeType === node.ELEMENT_NODE) {
		const element = node as XmlElement;
		const id = element.getAttribute('id');
		if (id) {
			idMap.set(id, element);
		}
		for (const child of getElementChildren(element)) {
			indexNodeById(idMap, child);
		}
	}
}

function removeNodeIds(idMap: Map<string, XmlElement>, node: XmlNode): void {
	if (node.nodeType === node.ELEMENT_NODE) {
		const element = node as XmlElement;
		const id = element.getAttribute('id');
		if (id) {
			idMap.delete(id);
		}
		for (const child of getElementChildren(element)) {
			removeNodeIds(idMap, child);
		}
	}
}

interface StructuralMergeContext {
	originalById: Map<string, XmlElement>;
}

function isXmlDeclarationNode(node: XmlNode): boolean {
	return node.nodeType === node.PROCESSING_INSTRUCTION_NODE && node.nodeName.toLowerCase() === 'xml';
}

function isStructuralNonElementNode(node: XmlNode): boolean {
	if (isXmlDeclarationNode(node)) {
		return false;
	}

	if (node.nodeType === node.TEXT_NODE) {
		return (node.nodeValue || '').trim().length > 0;
	}

	return node.nodeType === node.COMMENT_NODE
		|| node.nodeType === node.PROCESSING_INSTRUCTION_NODE
		|| node.nodeType === node.CDATA_SECTION_NODE
		|| node.nodeType === node.DOCUMENT_TYPE_NODE;
}

function isStructuralChildNode(parent: XmlElement, child: XmlNode): boolean {
	if (child.nodeType === child.ELEMENT_NODE) {
		return isStructuralChild(parent, child as XmlElement);
	}

	return isStructuralNonElementNode(child);
}

function getNonElementNodeKey(node: XmlNode): string {
	switch (node.nodeType) {
		case node.TEXT_NODE:
			return `text:${node.nodeValue || ''}`;
		case node.CDATA_SECTION_NODE:
			return `cdata:${node.nodeValue || ''}`;
		case node.COMMENT_NODE:
			return `comment:${node.nodeValue || ''}`;
		case node.PROCESSING_INSTRUCTION_NODE:
			return `pi:${node.nodeName}:${node.nodeValue || ''}`;
		case node.DOCUMENT_TYPE_NODE:
			return `doctype:${serializer.serializeToString(node)}`;
		default:
			return `node:${node.nodeType}:${serializer.serializeToString(node)}`;
	}
}

function getDocumentChildKey(child: XmlNode): string {
	if (child.nodeType === child.ELEMENT_NODE) {
		const element = child as XmlElement;
		return `element:${element.namespaceURI || ''}:${getLocalName(element)}`;
	}

	return getNonElementNodeKey(child);
}

function getStructuralNodeKey(parent: XmlElement, child: XmlNode): string {
	if (child.nodeType === child.ELEMENT_NODE) {
		return getStructuralChildKey(parent, child as XmlElement);
	}

	return getNonElementNodeKey(child);
}

function syncDocumentLexicalNodes(target: XmlDocument, source: XmlDocument): void {
	const sourceChildren = Array.from(source.childNodes).filter((node) => !isXmlDeclarationNode(node));
	const targetChildren = Array.from(target.childNodes).filter((node) => !isXmlDeclarationNode(node));
	const sourceHasLexicalNodes = sourceChildren.some((node) => node.nodeType !== node.ELEMENT_NODE);
	const targetChildrenByKey = new Map<string, XmlNode[]>();

	for (const child of targetChildren) {
		const key = getDocumentChildKey(child);
		const bucket = targetChildrenByKey.get(key) || [];
		bucket.push(child);
		targetChildrenByKey.set(key, bucket);
	}

	const keptChildren = new Set<XmlNode>();
	const placements: Array<{ node: XmlNode; existedHere: boolean }> = [];

	for (const sourceChild of sourceChildren) {
		let targetChild: XmlNode | undefined;
		let existedHere = false;

		if (
			sourceChild.nodeType === sourceChild.ELEMENT_NODE
			&& target.documentElement
			&& sourceChild.nodeType === target.documentElement.nodeType
			&& isSameElementType(target.documentElement, sourceChild as XmlElement)
		) {
			targetChild = target.documentElement;
			existedHere = targetChild.parentNode === target;
		}

		if (!targetChild) {
			const key = getDocumentChildKey(sourceChild);
			const bucket = targetChildrenByKey.get(key);
			targetChild = bucket?.shift();
			existedHere = Boolean(targetChild && targetChild.parentNode === target);
		}

		if (!targetChild) {
			targetChild = target.importNode(sourceChild, true);
		}

		placements.push({ node: targetChild, existedHere });
		keptChildren.add(targetChild);
	}

	for (let index = 0; index < placements.length; index++) {
		const placement = placements[index];
		if (placement.existedHere) {
			continue;
		}

		const nextStable = placements.slice(index + 1).find((candidate) => candidate.existedHere && candidate.node.parentNode === target)?.node;
		if (nextStable) {
			target.insertBefore(placement.node, nextStable);
			continue;
		}

		const previousPlaced = placements.slice(0, index).reverse().find((candidate) => candidate.node.parentNode === target)?.node;
		if (previousPlaced) {
			insertAfter(target, placement.node, previousPlaced);
			continue;
		}

		const firstDocumentChild = Array.from(target.childNodes).find((child) => !isXmlDeclarationNode(child) && child !== placement.node);
		if (firstDocumentChild) {
			target.insertBefore(placement.node, firstDocumentChild);
		} else {
			target.appendChild(placement.node);
		}
	}

	for (const child of Array.from(target.childNodes).filter((node) => !isXmlDeclarationNode(node))) {
		if (!keptChildren.has(child)) {
			if (child.nodeType === child.ELEMENT_NODE || sourceHasLexicalNodes) {
				target.removeChild(child);
			}
		}
	}
}

function reconcileStructuralChildren(target: XmlElement, source: XmlElement, context: StructuralMergeContext): void {
	const sourceChildren = Array.from(source.childNodes).filter((child) => isStructuralChildNode(source, child));
	const targetChildren = Array.from(target.childNodes).filter((child) => isStructuralChildNode(target, child));
	const sourceHasLexicalNodes = sourceChildren.some((child) => child.nodeType !== child.ELEMENT_NODE);
	const targetChildrenByKey = new Map<string, XmlNode[]>();

	for (const child of targetChildren) {
		const key = getStructuralNodeKey(target, child);
		const bucket = targetChildrenByKey.get(key) || [];
		bucket.push(child);
		targetChildrenByKey.set(key, bucket);
	}

	const keptChildren = new Set<XmlNode>();
	const placements: Array<{ node: XmlNode; existedHere: boolean }> = [];

	for (const sourceChild of sourceChildren) {
		const sourceElement = sourceChild.nodeType === sourceChild.ELEMENT_NODE ? sourceChild as XmlElement : undefined;
		const id = sourceElement?.getAttribute('id');
		let targetChild: XmlNode | undefined;
		let existedHere = false;

		if (id && sourceElement) {
			const matchedById = context.originalById.get(id);
			if (matchedById && isSameElementType(matchedById, sourceElement)) {
				targetChild = matchedById;
				existedHere = matchedById.parentNode === target;
			}
		}

		if (!targetChild) {
			const key = getStructuralNodeKey(target, sourceChild);
			const bucket = targetChildrenByKey.get(key);
			targetChild = bucket?.shift();
			existedHere = Boolean(targetChild && targetChild.parentNode === target);
		}

		if (!targetChild) {
			targetChild = getNodeDocument(target).importNode(sourceChild, true);
			indexNodeById(context.originalById, targetChild);
		} else {
			const targetElement = targetChild.nodeType === targetChild.ELEMENT_NODE ? targetChild as XmlElement : undefined;
			if (targetElement && sourceElement) {
				syncStructuralAttributes(targetElement, sourceElement);
				reconcileStructuralChildren(targetElement, sourceElement, context);
				maybeSyncLeafText(targetElement, sourceElement);
			}
		}

		placements.push({ node: targetChild, existedHere });
		keptChildren.add(targetChild);
	}

	for (let index = 0; index < placements.length; index++) {
		const placement = placements[index];
		if (placement.existedHere) {
			continue;
		}

		const nextStable = placements.slice(index + 1).find((candidate) => candidate.existedHere && candidate.node.parentNode === target)?.node;
		if (nextStable) {
			target.insertBefore(placement.node, nextStable);
		} else {
			const previousPlaced = placements.slice(0, index).reverse().find((candidate) => candidate.node.parentNode === target)?.node;
			if (previousPlaced) {
				insertAfter(target, placement.node, previousPlaced);
			} else {
				const firstStructuralChild = Array.from(target.childNodes).find((child) => isStructuralChildNode(target, child) && child !== placement.node);
				if (firstStructuralChild) {
					target.insertBefore(placement.node, firstStructuralChild);
				} else {
					target.appendChild(placement.node);
				}
			}
		}
	}

	for (const child of Array.from(target.childNodes).filter((node) => isStructuralChildNode(target, node))) {
		if (!keptChildren.has(child)) {
			if (child.nodeType === child.ELEMENT_NODE) {
				removeNodeIds(context.originalById, child);
				target.removeChild(child);
				continue;
			}

			if (sourceHasLexicalNodes) {
				target.removeChild(child);
			}
		}
	}
}

function setOptionalAttribute(element: XmlElement, name: string, value: string | undefined): void {
	if (value !== undefined && value !== '') {
		element.setAttribute(name, value);
	} else {
		element.removeAttribute(name);
	}
}

function patchFieldExtensionNode(node: XmlElement, field: FlowableFieldExtension, namespaces: Record<string, string>): void {
	node.setAttribute('name', field.name);
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
	const children = parseXmlFragment(
		field.valueType === 'expression'
			? `<activiti:expression>${escapeXml(field.value)}</activiti:expression>`
			: `<activiti:string>${escapeXml(field.value)}</activiti:string>`,
		namespaces,
	);
	for (const child of children) {
		node.appendChild(getNodeDocument(node).importNode(child, true));
	}
}

function patchListenerNode(node: XmlElement, listener: FlowableListener): void {
	node.setAttribute('event', listener.event);
	node.removeAttribute('activiti:class');
	node.removeAttribute('activiti:expression');
	node.removeAttribute('activiti:delegateExpression');
	node.setAttribute(`activiti:${listener.implementationType}`, listener.implementation);
}

function patchFormPropertyNode(node: XmlElement, formProperty: FlowableFormProperty): void {
	node.setAttribute('id', formProperty.id);
	node.setAttribute('name', formProperty.name);
	node.setAttribute('type', formProperty.type);
	node.setAttribute('required', String(formProperty.required));
	node.setAttribute('readable', String(formProperty.readable));
	node.setAttribute('writable', String(formProperty.writable));
	node.setAttribute('default', formProperty.defaultValue);
}

function patchIoParameterNode(node: XmlElement, parameter: FlowableIOParameter): void {
	setOptionalAttribute(node, 'source', parameter.source);
	setOptionalAttribute(node, 'sourceExpression', parameter.sourceExpression);
	node.setAttribute('target', parameter.target);
}

function patchExceptionMapNode(node: XmlElement, exceptionMap: FlowableExceptionMap): void {
	setOptionalAttribute(node, 'errorCode', exceptionMap.errorCode);
	if (exceptionMap.includeChildExceptions) {
		node.setAttribute('includeChildExceptions', 'true');
	} else {
		node.removeAttribute('includeChildExceptions');
	}
	setTextContentPreservingComments(node, exceptionMap.className);
}

function patchProcessEventListenerNode(node: XmlElement, listener: FlowableEventListener): void {
	setOptionalAttribute(node, 'events', listener.events);
	setOptionalAttribute(node, 'entityType', listener.entityType);
	node.removeAttribute('class');
	node.removeAttribute('activiti:class');
	node.removeAttribute('delegateExpression');
	node.removeAttribute('activiti:delegateExpression');
	node.removeAttribute('signalName');
	node.removeAttribute('messageName');
	node.removeAttribute('errorCode');
	node.removeAttribute('throwGlobalEvent');

	switch (listener.implementationType) {
		case 'class':
			node.setAttribute('class', listener.implementation);
			break;
		case 'delegateExpression':
			node.setAttribute('delegateExpression', listener.implementation);
			break;
		case 'throwSignalEvent':
			node.setAttribute('signalName', listener.implementation);
			break;
		case 'throwGlobalSignalEvent':
			node.setAttribute('signalName', listener.implementation);
			node.setAttribute('throwGlobalEvent', 'true');
			break;
		case 'throwMessageEvent':
			node.setAttribute('messageName', listener.implementation);
			break;
		case 'throwErrorEvent':
			node.setAttribute('errorCode', listener.implementation);
			break;
	}
}

function patchLocalizationNode(node: XmlElement, localization: FlowableLocalization): void {
	node.setAttribute('locale', localization.locale);
	setOptionalAttribute(node, 'name', localization.name);

	const documentation = findDirectChild(node, 'documentation');
	let normalizedDocumentation = documentation;
	if (documentation && (documentation.nodeName !== 'activiti:documentation' || documentation.namespaceURI !== ACTIVITI_NAMESPACE)) {
		normalizedDocumentation = getNodeDocument(node).createElementNS(ACTIVITI_NAMESPACE, 'activiti:documentation');
		while (documentation.firstChild) {
			normalizedDocumentation.appendChild(documentation.firstChild);
		}
		node.replaceChild(normalizedDocumentation, documentation);
	}

	if (localization.description) {
		const documentationNode = normalizedDocumentation || getNodeDocument(node).createElementNS(ACTIVITI_NAMESPACE, 'activiti:documentation');
		setTextContentPreservingComments(documentationNode, localization.description);
		if (!normalizedDocumentation) {
			node.appendChild(documentationNode);
		}
	} else if (normalizedDocumentation) {
		node.removeChild(normalizedDocumentation);
	}
}

function patchSignalDefinitionNode(node: XmlElement, signal: FlowableSignalDefinition): void {
	node.setAttribute('id', signal.id);
	node.setAttribute('name', signal.name);
	setOptionalAttribute(node, 'activiti:scope', signal.scope);
}

function patchMessageDefinitionNode(node: XmlElement, message: FlowableMessageDefinition): void {
	node.setAttribute('id', message.id);
	node.setAttribute('name', message.name);
}

function patchDataObjectNode(node: XmlElement, dataObject: FlowableDataObject, namespaces: Record<string, string>): void {
	node.setAttribute('id', dataObject.id);
	node.setAttribute('name', dataObject.name);
	setOptionalAttribute(node, 'itemSubjectRef', dataObject.itemSubjectRef);

	let extensionElements = findDirectChild(node, 'extensionElements');
	const valueElement = extensionElements ? getElementChildren(extensionElements).find((child) => child.nodeName === 'activiti:value' || getLocalName(child) === 'value') : undefined;

	if (dataObject.defaultValue) {
		if (!extensionElements) {
			extensionElements = getNodeDocument(node).createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
			node.appendChild(extensionElements);
		}
		let valueNode = valueElement;
		if (!valueNode) {
			const fragments = parseXmlFragment(`<activiti:value>${escapeXml(dataObject.defaultValue)}</activiti:value>`, namespaces);
			valueNode = getNodeDocument(node).importNode(fragments[0], true) as XmlElement;
			extensionElements.appendChild(valueNode);
		}
		setTextContentPreservingComments(valueNode, dataObject.defaultValue);
	} else if (valueElement && extensionElements) {
		extensionElements.removeChild(valueElement);
		if (!Array.from(extensionElements.childNodes).some((child) => child.nodeType !== child.TEXT_NODE || (child.textContent || '').trim().length > 0)) {
			node.removeChild(extensionElements);
		}
	}
}

interface CollectionOptions<T extends XmlIdentified> {
	isManagedNode: (node: XmlElement) => boolean;
	createNode: (item: T) => XmlElement;
	patchNode: (node: XmlElement, item: T) => void;
	matchFallback?: (node: XmlElement, item: T) => boolean;
	insertBefore?: (parent: XmlElement) => XmlNode | null;
}

function placeManagedNode(
	parent: XmlElement,
	node: XmlElement,
	lastPlacedNode: XmlNode | null,
	insertionAnchor: XmlNode | null,
	isManagedNode: (node: XmlElement) => boolean,
): void {
	if (lastPlacedNode && lastPlacedNode.parentNode === parent) {
		if (lastPlacedNode.nextSibling !== node) {
			insertAfter(parent, node, lastPlacedNode);
		}
		return;
	}

	if (insertionAnchor && insertionAnchor.parentNode === parent && insertionAnchor !== node) {
		parent.insertBefore(node, insertionAnchor);
		return;
	}

	const firstManagedSibling = Array.from(parent.childNodes).find((child): child is XmlElement => {
		return child !== node && child.nodeType === child.ELEMENT_NODE && isManagedNode(child as XmlElement);
	});

	if (firstManagedSibling) {
		parent.insertBefore(node, firstManagedSibling);
	} else if (node.parentNode !== parent) {
		parent.appendChild(node);
	}
}

function reconcileManagedCollection<T extends XmlIdentified>(
	parent: XmlElement,
	items: T[],
	options: CollectionOptions<T>,
): void {
	const existingNodes = getElementChildren(parent).filter(options.isManagedNode);
	const matchedNodes = new Set<XmlElement>();
	let lastPlacedNode: XmlNode | null = null;
	const insertionAnchor = options.insertBefore?.(parent) || null;

	for (const item of items) {
		let nodeToPlace: XmlElement | undefined;

		if (options.matchFallback) {
			nodeToPlace = existingNodes.find((node) => !matchedNodes.has(node) && options.matchFallback?.(node, item));
		}

		if (!nodeToPlace && item.xmlIdentity) {
			const scope = item.xmlIdentity.slice(0, item.xmlIdentity.indexOf(':'));
			nodeToPlace = existingNodes.find((node) => !matchedNodes.has(node) && item.xmlIdentity === buildXmlIdentity(scope, node));
		}

		if (!nodeToPlace) {
			nodeToPlace = options.createNode(item);
		}

		options.patchNode(nodeToPlace, item);
		placeManagedNode(parent, nodeToPlace, lastPlacedNode, insertionAnchor, options.isManagedNode);
		lastPlacedNode = nodeToPlace;
		matchedNodes.add(nodeToPlace);
	}

	for (const existingNode of existingNodes) {
		if (!matchedNodes.has(existingNode)) {
			parent.removeChild(existingNode);
		}
	}
}

function createElementFromFragment(parent: XmlElement, xml: string, namespaces: Record<string, string>): XmlElement {
	const fragment = parseXmlFragment(xml, namespaces)[0];
	return getNodeDocument(parent).importNode(fragment, true) as XmlElement;
}

function isManagedExtensionChild(node: XmlElement): boolean {
	return managedExtensionChildNames.has(node.nodeName);
}

function appendPreservedExtensionElements(
	extensionElements: XmlElement,
	preservedExtensionElements: string[],
	namespaces: Record<string, string>,
): void {
	const existingPreservedNodes = getElementChildren(extensionElements).filter((child) => !isManagedExtensionChild(child));
	let preservedIndex = 0;

	for (const preservedXml of preservedExtensionElements) {
		for (const fragment of parseXmlFragment(preservedXml, namespaces)) {
			const importedFragment = getNodeDocument(extensionElements).importNode(fragment, true) as XmlElement;
			const existingNode = existingPreservedNodes[preservedIndex];
			if (existingNode) {
				extensionElements.replaceChild(importedFragment, existingNode);
			} else {
				extensionElements.appendChild(importedFragment);
			}
			preservedIndex += 1;
		}
	}

	for (const staleNode of existingPreservedNodes.slice(preservedIndex)) {
		extensionElements.removeChild(staleNode);
	}
}

function ensureExtensionElements(element: XmlElement): XmlElement {
	const existing = findDirectChild(element, 'extensionElements');
	if (existing) {
		return existing;
	}

	const extensionElements = getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
	const documentation = findDirectChild(element, 'documentation');
	if (documentation) {
		insertAfter(element, extensionElements, documentation);
	} else if (element.firstChild) {
		element.insertBefore(extensionElements, element.firstChild);
	} else {
		element.appendChild(extensionElements);
	}
	return extensionElements;
}

function hasMeaningfulChildren(element: XmlElement): boolean {
	return Array.from(element.childNodes).some((child) => {
		if (child.nodeType === child.TEXT_NODE) {
			return (child.textContent || '').trim().length > 0;
		}
		return true;
	});
}

function applyElementOverlay(
	element: XmlElement,
	elementState: FlowableElementState,
	originalElementState: FlowableElementState | undefined,
	namespaces: Record<string, string>,
): void {
	for (const key of FLOWABLE_ATTRIBUTE_KEYS) {
		const attributeName = `activiti:${key}`;
		const value = elementState.activitiAttributes[key]?.trim();
		if (value) {
			element.setAttribute(attributeName, value);
		} else {
			element.removeAttribute(attributeName);
		}
	}

	for (const [attributeName, value] of Object.entries(elementState.preservedAttributes)) {
		if (!element.hasAttribute(attributeName)) {
			element.setAttribute(attributeName, value);
		}
	}

	const managedExtensionItems =
		elementState.fieldExtensions.length +
		elementState.inputParameters.length +
		elementState.outputParameters.length +
		elementState.taskListeners.length +
		elementState.executionListeners.length +
		elementState.formProperties.length +
		elementState.exceptionMaps.length +
		elementState.preservedExtensionElements.length +
		(elementState.failedJobRetryTimeCycle ? 1 : 0);

	let extensionElements = findDirectChild(element, 'extensionElements');
	if (managedExtensionItems > 0) {
		extensionElements = ensureExtensionElements(element);
	}

	if (extensionElements) {
		reconcileManagedCollection(extensionElements, elementState.fieldExtensions, {
			isManagedNode: (node) => node.nodeName === 'activiti:field',
			createNode: (item) => createElementFromFragment(extensionElements!, buildFieldExtensionNode(item), namespaces),
			patchNode: (node, item) => patchFieldExtensionNode(node, item, namespaces),
			matchFallback: (node, item) => node.getAttribute('name') === item.name,
		});

		reconcileManagedCollection(extensionElements, elementState.inputParameters, {
			isManagedNode: (node) => node.nodeName === 'activiti:in',
			createNode: (item) => createElementFromFragment(extensionElements!, buildIOParameterNode('activiti:in', item), namespaces),
			patchNode: patchIoParameterNode,
			matchFallback: (node, item) => node.getAttribute('target') === item.target,
		});

		reconcileManagedCollection(extensionElements, elementState.outputParameters, {
			isManagedNode: (node) => node.nodeName === 'activiti:out',
			createNode: (item) => createElementFromFragment(extensionElements!, buildIOParameterNode('activiti:out', item), namespaces),
			patchNode: patchIoParameterNode,
			matchFallback: (node, item) => node.getAttribute('target') === item.target,
		});

		reconcileManagedCollection(extensionElements, elementState.taskListeners, {
			isManagedNode: (node) => node.nodeName === 'activiti:taskListener',
			createNode: (item) => createElementFromFragment(extensionElements!, buildListenerNode('activiti:taskListener', item), namespaces),
			patchNode: patchListenerNode,
			matchFallback: (node, item) => node.getAttribute('event') === item.event,
		});

		reconcileManagedCollection(extensionElements, elementState.executionListeners, {
			isManagedNode: (node) => node.nodeName === 'activiti:executionListener',
			createNode: (item) => createElementFromFragment(extensionElements!, buildListenerNode('activiti:executionListener', item), namespaces),
			patchNode: patchListenerNode,
			matchFallback: (node, item) => node.getAttribute('event') === item.event,
		});

		reconcileManagedCollection(extensionElements, elementState.formProperties, {
			isManagedNode: (node) => node.nodeName === 'activiti:formProperty',
			createNode: (item) => createElementFromFragment(extensionElements!, buildFormPropertyNode(item), namespaces),
			patchNode: patchFormPropertyNode,
			matchFallback: (node, item) => node.getAttribute('id') === item.id,
		});

		const retryItems = elementState.failedJobRetryTimeCycle ? [{ xmlIdentity: 'failedJobRetryTimeCycle:activiti:failedJobRetryTimeCycle:0', value: elementState.failedJobRetryTimeCycle }] : [];
		reconcileManagedCollection(extensionElements, retryItems, {
			isManagedNode: (node) => node.nodeName === 'activiti:failedJobRetryTimeCycle',
			createNode: (item) => createElementFromFragment(
				extensionElements!,
				`<activiti:failedJobRetryTimeCycle>${escapeXml(item.value)}</activiti:failedJobRetryTimeCycle>`,
				namespaces,
			),
			patchNode: (node, item) => setTextContentPreservingComments(node, item.value),
		});

		reconcileManagedCollection(extensionElements, elementState.exceptionMaps, {
			isManagedNode: (node) => node.nodeName === 'activiti:mapException',
			createNode: (item) => createElementFromFragment(
				extensionElements!,
				`<activiti:mapException${item.errorCode ? ` errorCode="${escapeXml(item.errorCode)}"` : ''}${item.includeChildExceptions ? ' includeChildExceptions="true"' : ''}>${escapeXml(item.className)}</activiti:mapException>`,
				namespaces,
			),
			patchNode: patchExceptionMapNode,
			matchFallback: (node, item) => node.textContent === item.className,
		});

		appendPreservedExtensionElements(extensionElements, elementState.preservedExtensionElements, namespaces);

		if (!hasMeaningfulChildren(extensionElements)) {
			element.removeChild(extensionElements);
			extensionElements = undefined;
		}
	}

	const existingDoc = findDirectChild(element, 'documentation');
	if (elementState.documentation) {
		const documentation = existingDoc || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'documentation');
		const documentationChanged = elementState.documentation !== (originalElementState?.documentation || '');
		if (documentationChanged || !existingDoc) {
			setTextContentPreservingComments(documentation, elementState.documentation);
		}
		if (!existingDoc) {
			if (element.firstChild) {
				element.insertBefore(documentation, element.firstChild);
			} else {
				element.appendChild(documentation);
			}
		}
	} else if (existingDoc) {
		element.removeChild(existingDoc);
	}

	const existingCondition = findDirectChild(element, 'conditionExpression');
	if (elementState.conditionExpression) {
		const condition = existingCondition || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'conditionExpression');
		condition.setAttributeNS(XSI_NAMESPACE, 'xsi:type', 'tFormalExpression');
		const conditionChanged = elementState.conditionExpression !== (originalElementState?.conditionExpression || '');
		if (conditionChanged || !existingCondition) {
			setTextContentPreservingComments(condition, elementState.conditionExpression);
		}
		if (!existingCondition) {
			element.appendChild(condition);
		}
	} else if (existingCondition) {
		element.removeChild(existingCondition);
	}

	const existingScript = findDirectChild(element, 'script');
	if (elementState.script) {
		const script = existingScript || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'script');
		const scriptChanged = elementState.script !== (originalElementState?.script || '');
		if (scriptChanged || !existingScript) {
			setTextContentPreservingComments(script, elementState.script);
		}
		if (!existingScript) {
			element.appendChild(script);
		}
	} else if (existingScript) {
		element.removeChild(existingScript);
	}

	const existingMultiInstance = findDirectChild(element, 'multiInstanceLoopCharacteristics');
	if (elementState.multiInstance) {
		const replacement = createElementFromFragment(element, buildMultiInstanceNode(elementState.multiInstance), namespaces);
		if (existingMultiInstance) {
			element.replaceChild(replacement, existingMultiInstance);
		} else {
			element.appendChild(replacement);
		}
	} else if (existingMultiInstance && elementState.multiInstance === null) {
		element.removeChild(existingMultiInstance);
	}

	const existingTimerDef = findDirectChild(element, 'timerEventDefinition');
	if (elementState.timerDefinition?.value) {
		const timerDef = existingTimerDef || getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, 'timerEventDefinition');
		for (const child of getElementChildren(timerDef)) {
			timerDef.removeChild(child);
		}
		const timerChild = getNodeDocument(element).createElementNS(BPMN_MODEL_NAMESPACE, elementState.timerDefinition.type);
		setTextContentPreservingComments(timerChild, elementState.timerDefinition.value);
		timerDef.appendChild(timerChild);
		if (!existingTimerDef) {
			element.appendChild(timerDef);
		}
	} else if (existingTimerDef && originalElementState?.timerDefinition) {
		element.removeChild(existingTimerDef);
	}

	const existingErrorDef = findDirectChild(element, 'errorEventDefinition');
	if (existingErrorDef) {
		setOptionalAttribute(existingErrorDef, 'errorRef', elementState.errorRef);
	}

	const existingSignalDef = findDirectChild(element, 'signalEventDefinition');
	if (existingSignalDef) {
		setOptionalAttribute(existingSignalDef, 'signalRef', elementState.signalRef);
	}

	const existingMessageDef = findDirectChild(element, 'messageEventDefinition');
	if (existingMessageDef) {
		setOptionalAttribute(existingMessageDef, 'messageRef', elementState.messageRef);
	}

	const existingTerminateDef = findDirectChild(element, 'terminateEventDefinition');
	if (existingTerminateDef) {
		if (elementState.terminateAll === 'true') {
			existingTerminateDef.setAttribute('activiti:terminateAll', 'true');
		} else {
			existingTerminateDef.removeAttribute('activiti:terminateAll');
		}
	}

	const existingCompensateDef = findDirectChild(element, 'compensateEventDefinition');
	if (existingCompensateDef) {
		setOptionalAttribute(existingCompensateDef, 'activityRef', elementState.compensateActivityRef);
	}

	if (elementState.isForCompensation === 'true') {
		element.setAttribute('isForCompensation', 'true');
	} else {
		element.removeAttribute('isForCompensation');
	}
}

function serializeInlineNode(node: XmlNode): string {
	if (node.nodeType === node.TEXT_NODE) {
		return escapeXmlText(node.nodeValue || '');
	}

	if (node.nodeType === node.CDATA_SECTION_NODE) {
		return `<![CDATA[${node.nodeValue || ''}]]>`;
	}

	if (node.nodeType === node.COMMENT_NODE) {
		return `<!--${node.nodeValue || ''}-->`;
	}

	if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE) {
		return `<?${node.nodeName} ${node.nodeValue || ''}?>`;
	}

	return serializer.serializeToString(node);
}

function serializeNode(node: XmlNode, depth: number): string {
	const indent = '  '.repeat(depth);

	if (node.nodeType === node.ELEMENT_NODE) {
		const element = node as XmlElement;
		const attributes = Array.from(element.attributes)
			.map((attribute) => ` ${attribute.name}="${escapeXml(attribute.value)}"`)
			.join('');
		const rawChildNodes = Array.from(element.childNodes);
		const hasElementChildren = rawChildNodes.some((child) => child.nodeType === child.ELEMENT_NODE);

		if (!hasElementChildren) {
			if (rawChildNodes.length === 0) {
				return `${indent}<${element.tagName}${attributes}/>\n`;
			}

			const content = rawChildNodes.map((child) => serializeInlineNode(child)).join('');
			return `${indent}<${element.tagName}${attributes}>${content}</${element.tagName}>\n`;
		}

		const childNodes = rawChildNodes.filter((child) => {
			if (child.nodeType !== child.TEXT_NODE) {
				return true;
			}
			return (child.textContent || '').trim().length > 0;
		});

		let result = `${indent}<${element.tagName}${attributes}>\n`;
		for (const child of childNodes) {
			result += serializeNode(child, depth + 1);
		}
		result += `${indent}</${element.tagName}>\n`;
		return result;
	}

	if (node.nodeType === node.TEXT_NODE) {
		const value = node.nodeValue || '';
		if (value.trim().length === 0) {
			return '';
		}
		return `${indent}${escapeXmlText(value)}\n`;
	}

	if (node.nodeType === node.CDATA_SECTION_NODE) {
		return `${indent}<![CDATA[${node.nodeValue || ''}]]>\n`;
	}

	if (node.nodeType === node.COMMENT_NODE) {
		return `${indent}<!--${node.nodeValue || ''}-->\n`;
	}

	if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE) {
		return `${indent}<?${node.nodeName} ${node.nodeValue || ''}?>\n`;
	}

	if (node.nodeType === node.DOCUMENT_TYPE_NODE) {
		return `${serializer.serializeToString(node)}\n`;
	}

	return '';
}

function serializeXmlDocument(document: XmlDocument): string {
	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
	for (const child of Array.from(document.childNodes)) {
		if (child.nodeType === child.PROCESSING_INSTRUCTION_NODE && child.nodeName.toLowerCase() === 'xml') {
			continue;
		}
		xml += serializeNode(child, 0);
	}
	return xml;
}

export function mergeFlowableDocumentXml(
	serializedXml: string,
	originalXml: string,
	incomingState: FlowableDocumentState,
): string {
	const serializedState = extractFlowableDocumentState(serializedXml);
	const originalDocument = parseXmlDocument(originalXml);
	const serializedDocument = parseXmlDocument(serializedXml);
	const originalDefinitions = originalDocument.documentElement;
	const serializedDefinitions = serializedDocument.documentElement;

	if (!originalDefinitions || !serializedDefinitions) {
		return serializedXml;
	}

	const originalState = extractFlowableDocumentState(originalXml);
	const mergedState = cloneFlowableState(originalState);
	const serializedNamespaces = collectNamespaceDeclarations(serializedDefinitions);

	mergedState.namespaces = {
		...originalState.namespaces,
		...serializedNamespaces,
		...incomingState.namespaces,
	};

	if (incomingState.targetNamespace !== undefined) {
		mergedState.targetNamespace = incomingState.targetNamespace;
	}

	for (const [id, incomingElementState] of Object.entries(incomingState.elements)) {
		const mergedElementState = mergeElementState(originalState.elements[id], incomingElementState);
		if (mergedElementState) {
			const serializedElementState = serializedState.elements[id];
			if (serializedElementState) {
				mergedElementState.preservedExtensionElements = mergePreservedExtensionElements(
					mergedElementState.preservedExtensionElements,
					serializedElementState.preservedExtensionElements,
				);
			}
			mergedState.elements[id] = mergedElementState;
		}
	}

	mergedState.signalDefinitions = mergeSerializedCollectionState(
		originalState.signalDefinitions,
		serializedState.signalDefinitions,
		incomingState.signalDefinitions,
		(signal) => signal.id,
	);
	mergedState.messageDefinitions = mergeSerializedCollectionState(
		originalState.messageDefinitions,
		serializedState.messageDefinitions,
		incomingState.messageDefinitions,
		(message) => message.id,
	);
	mergedState.eventListeners = incomingState.eventListeners.map((listener) => ({ ...listener }));
	mergedState.localizations = incomingState.localizations.map((localization) => ({ ...localization }));
	mergedState.dataObjects = mergeSerializedCollectionState(
		originalState.dataObjects,
		serializedState.dataObjects,
		incomingState.dataObjects,
		(dataObject) => dataObject.id,
	);

	ensureActivitiNamespace(mergedState);

	const structuralContext: StructuralMergeContext = {
		originalById: buildIdMap(originalDocument),
	};

	syncDocumentLexicalNodes(originalDocument, serializedDocument);
	syncStructuralAttributes(originalDefinitions, serializedDefinitions);
	reconcileStructuralChildren(originalDefinitions, serializedDefinitions, structuralContext);

	for (const [prefix, namespaceUri] of Object.entries(mergedState.namespaces)) {
		originalDefinitions.setAttributeNS(XMLNS_NAMESPACE, `xmlns:${prefix}`, namespaceUri);
	}

	if (mergedState.targetNamespace) {
		originalDefinitions.setAttribute('targetNamespace', mergedState.targetNamespace);
	}

	const currentElementsById = buildIdMap(originalDocument);
	for (const [id, elementState] of Object.entries(mergedState.elements)) {
		const element = currentElementsById.get(id);
		if (!element) {
			continue;
		}
		applyElementOverlay(element, elementState, originalState.elements[id], mergedState.namespaces);
	}

	reconcileManagedCollection(originalDefinitions, mergedState.signalDefinitions, {
		isManagedNode: (node) => getLocalName(node) === 'signal',
		createNode: (item) => createElementFromFragment(originalDefinitions, `<signal id="${escapeXml(item.id)}" name="${escapeXml(item.name)}"${item.scope ? ` activiti:scope="${escapeXml(item.scope)}"` : ''}/>`, mergedState.namespaces),
		patchNode: patchSignalDefinitionNode,
		matchFallback: (node, item) => node.getAttribute('id') === item.id,
		insertBefore: (parent) => findDirectChild(parent, 'process') || findDirectChild(parent, 'collaboration') || null,
	});

	reconcileManagedCollection(originalDefinitions, mergedState.messageDefinitions, {
		isManagedNode: (node) => getLocalName(node) === 'message',
		createNode: (item) => createElementFromFragment(originalDefinitions, `<message id="${escapeXml(item.id)}" name="${escapeXml(item.name)}"/>`, mergedState.namespaces),
		patchNode: patchMessageDefinitionNode,
		matchFallback: (node, item) => node.getAttribute('id') === item.id,
		insertBefore: (parent) => findDirectChild(parent, 'process') || findDirectChild(parent, 'collaboration') || null,
	});

	const processElement = findDirectChild(originalDefinitions, 'process');
	if (processElement) {
		reconcileManagedCollection(processElement, mergedState.dataObjects, {
			isManagedNode: (node) => getLocalName(node) === 'dataObject',
			createNode: (item) => createElementFromFragment(
				processElement,
				`<dataObject id="${escapeXml(item.id)}" name="${escapeXml(item.name)}"${item.itemSubjectRef ? ` itemSubjectRef="${escapeXml(item.itemSubjectRef)}"` : ''}/>`,
				mergedState.namespaces,
			),
			patchNode: (node, item) => patchDataObjectNode(node, item, mergedState.namespaces),
			matchFallback: (node, item) => node.getAttribute('id') === item.id,
			insertBefore: () => getElementChildren(processElement).find((child) => getLocalName(child) !== 'dataObject') || null,
		});

		const needsProcessExtensionElements = mergedState.eventListeners.length > 0 || mergedState.localizations.length > 0;
		let processExtensionElements = findDirectChild(processElement, 'extensionElements');
		if (needsProcessExtensionElements) {
			processExtensionElements = processExtensionElements || ensureExtensionElements(processElement);
		}

		if (processExtensionElements) {
			reconcileManagedCollection(processExtensionElements, mergedState.eventListeners, {
				isManagedNode: (node) => node.nodeName === 'activiti:eventListener',
				createNode: (item) => createElementFromFragment(processExtensionElements!, buildEventListenerNode(item), mergedState.namespaces),
				patchNode: patchProcessEventListenerNode,
				matchFallback: (node, item) => node.getAttribute('events') === item.events && (node.getAttribute('class') || node.getAttribute('delegateExpression') || node.getAttribute('signalName') || node.getAttribute('messageName') || node.getAttribute('errorCode') || '') === item.implementation,
			});

			reconcileManagedCollection(processExtensionElements, mergedState.localizations, {
				isManagedNode: (node) => node.nodeName === 'activiti:localization',
				createNode: (item) => createElementFromFragment(processExtensionElements!, buildLocalizationNode(item), mergedState.namespaces),
				patchNode: patchLocalizationNode,
				matchFallback: (node, item) => node.getAttribute('locale') === item.locale,
			});

			if (!hasMeaningfulChildren(processExtensionElements)) {
				processElement.removeChild(processExtensionElements);
			}
		}
	}

	return serializeXmlDocument(originalDocument);
}
