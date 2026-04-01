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
	type FlowableMultiInstance,
	type FlowableTimerDefinition,
	type TimerDefinitionType,
} from './types';

const ACTIVITI_NAMESPACE = 'http://activiti.org/bpmn';
const BPMN_MODEL_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

const editableActivitiAttributes = new Set(FLOWABLE_ATTRIBUTE_KEYS.map((key) => `activiti:${key}`));
const serializer = new XMLSerializer();

function formatXml(xml: string): string {
	const INDENT = '  ';
	// Only collapse whitespace-only runs between tags; preserve text content
	const normalized = xml.replace(/>([\s]+)</g, (_match, ws: string) => {
		// If the whitespace contains only spaces/tabs/newlines and is between two tags, collapse it
		return ws.trim().length === 0 ? '><' : `>${ws}<`;
	});
	let formatted = '';
	let depth = 0;
	let i = 0;

	while (i < normalized.length) {
		if (normalized[i] !== '<') {
			const end = normalized.indexOf('<', i);
			formatted += end === -1 ? normalized.substring(i) : normalized.substring(i, end);
			i = end === -1 ? normalized.length : end;
			continue;
		}

		const tagEnd = normalized.indexOf('>', i);
		if (tagEnd === -1) {
			formatted += normalized.substring(i);
			break;
		}

		const tag = normalized.substring(i, tagEnd + 1);

		if (tag.startsWith('<?')) {
			formatted += tag + '\n';
		} else if (tag.startsWith('</')) {
			depth--;
			formatted += INDENT.repeat(Math.max(0, depth)) + tag + '\n';
		} else if (tag.endsWith('/>')) {
			formatted += INDENT.repeat(depth) + tag + '\n';
		} else {
			const nextPos = tagEnd + 1;
			if (nextPos < normalized.length && normalized[nextPos] !== '<') {
				const textEnd = normalized.indexOf('<', nextPos);
				if (textEnd !== -1 && normalized[textEnd + 1] === '/') {
					const closingEnd = normalized.indexOf('>', textEnd);
					if (closingEnd !== -1) {
						formatted += INDENT.repeat(depth) + normalized.substring(i, closingEnd + 1) + '\n';
						i = closingEnd + 1;
						continue;
					}
				}
			}
			formatted += INDENT.repeat(depth) + tag + '\n';
			depth++;
		}

		i = tagEnd + 1;
	}

	return formatted.trimEnd() + '\n';
}



function getElementChildren(element: XmlElement): XmlElement[] {
	return Array.from(element.childNodes).filter((node): node is XmlElement => node.nodeType === node.ELEMENT_NODE);
}

function getLocalName(node: XmlNode): string {
	return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function buildNamespaceWrapper(namespaces: Record<string, string>): string {
	const namespaceAttributes = Object.entries(namespaces)
		.map(([prefix, uri]) => `xmlns:${prefix}="${escapeXml(uri)}"`)
		.join(' ');

	return `<root xmlns="${BPMN_MODEL_NAMESPACE}" ${namespaceAttributes}>`;
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

function parseIOParameter(element: XmlElement): FlowableIOParameter {
	return {
		id: `io-${element.getAttribute('source') || element.getAttribute('sourceExpression') || ''}-${element.getAttribute('target') || ''}`,
		source: element.getAttribute('source') || '',
		sourceExpression: element.getAttribute('sourceExpression') || '',
		target: element.getAttribute('target') || '',
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
	const TIMER_TYPES: TimerDefinitionType[] = ['timeDuration', 'timeDate', 'timeCycle'];
	for (const type of TIMER_TYPES) {
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
	};
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
		activitiAttributes: {
			...(originalState?.activitiAttributes || {}),
			...(incomingState?.activitiAttributes || {}),
		},
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
	});

	if (needsActivitiNamespace && !documentState.namespaces.activiti) {
		documentState.namespaces.activiti = ACTIVITI_NAMESPACE;
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

	// Extract target namespace
	documentState.targetNamespace = definitions.getAttribute('targetNamespace') || '';

	// Extract signal definitions
	for (const signalEl of Array.from(document.getElementsByTagName('signal'))) {
		const id = signalEl.getAttribute('id');
		const name = signalEl.getAttribute('name');
		if (id) {
			const scope = signalEl.getAttribute('activiti:scope') || '';
			documentState.signalDefinitions.push({ id, name: name || '', scope });
		}
	}

	// Extract message definitions
	for (const messageEl of Array.from(document.getElementsByTagName('message'))) {
		const id = messageEl.getAttribute('id');
		const name = messageEl.getAttribute('name');
		if (id) {
			documentState.messageDefinitions.push({ id, name: name || '' });
		}
	}

	// Extract process-level event listeners and localizations
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
					});
				}
			}
		}

		// Extract data objects from process
		for (const dataObjEl of getElementChildren(processEl as XmlElement)) {
			if (getLocalName(dataObjEl) === 'dataObject') {
				const id = dataObjEl.getAttribute('id') || '';
				const name = dataObjEl.getAttribute('name') || '';
				const itemSubjectRef = dataObjEl.getAttribute('itemSubjectRef') || '';
				// Default value is in extensionElements > activiti:value
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
					documentState.dataObjects.push({ id, name, itemSubjectRef, defaultValue });
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

				if (child.nodeName === 'activiti:eventListener') {
					// Handled at document level, skip
					continue;
				}

				if (child.nodeName === 'activiti:localization') {
					// Handled at document level, skip
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
					});
					continue;
				}

				elementState.preservedExtensionElements.push(serializer.serializeToString(child));
			}
		}

		// Extract documentation
		const documentationEl = findDirectChild(node, 'documentation');
		if (documentationEl) {
			elementState.documentation = documentationEl.textContent || '';
		}

		// Extract conditionExpression from sequence flows
		const conditionExpressionEl = findDirectChild(node, 'conditionExpression');
		if (conditionExpressionEl) {
			elementState.conditionExpression = conditionExpressionEl.textContent || '';
		}

		// Extract script from script tasks
		const scriptEl = findDirectChild(node, 'script');
		if (scriptEl) {
			elementState.script = scriptEl.textContent || '';
		}

		// Extract multi-instance loop characteristics
		const multiInstanceEl = findDirectChild(node, 'multiInstanceLoopCharacteristics');
		if (multiInstanceEl) {
			elementState.multiInstance = parseMultiInstance(multiInstanceEl);
		}

		// Extract event definitions
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

		// Extract terminateAll from terminateEventDefinition
		const terminateEventDefEl = findDirectChild(node, 'terminateEventDefinition');
		if (terminateEventDefEl) {
			elementState.terminateAll = terminateEventDefEl.getAttribute('activiti:terminateAll') || '';
		}

		// Extract compensateActivityRef from compensateEventDefinition
		const compensateEventDefEl = findDirectChild(node, 'compensateEventDefinition');
		if (compensateEventDefEl) {
			elementState.compensateActivityRef = compensateEventDefEl.getAttribute('activityRef') || '';
		}

		// Extract isForCompensation attribute
		const isForCompensationAttr = node.getAttribute('isForCompensation');
		if (isForCompensationAttr) {
			elementState.isForCompensation = isForCompensationAttr;
		}

		documentState.elements[id] = elementState;
	}

	ensureActivitiNamespace(documentState);
	return documentState;
}

export function mergeFlowableDocumentXml(
	serializedXml: string,
	originalXml: string,
	incomingState: FlowableDocumentState,
): string {
	const originalState = extractFlowableDocumentState(originalXml);
	const mergedState = cloneFlowableState(originalState);

	mergedState.namespaces = {
		...originalState.namespaces,
		...incomingState.namespaces,
	};

	// Merge target namespace
	if (incomingState.targetNamespace !== undefined) {
		mergedState.targetNamespace = incomingState.targetNamespace;
	}

	for (const [id, incomingElementState] of Object.entries(incomingState.elements)) {
		const mergedElementState = mergeElementState(originalState.elements[id], incomingElementState);
		if (mergedElementState) {
			mergedState.elements[id] = mergedElementState;
		}
	}

	// Merge document-level definitions
	if (incomingState.signalDefinitions.length > 0 || originalState.signalDefinitions.length > 0) {
		mergedState.signalDefinitions = incomingState.signalDefinitions.length > 0
			? incomingState.signalDefinitions.map((s) => ({ ...s }))
			: originalState.signalDefinitions.map((s) => ({ ...s }));
	}
	if (incomingState.messageDefinitions.length > 0 || originalState.messageDefinitions.length > 0) {
		mergedState.messageDefinitions = incomingState.messageDefinitions.length > 0
			? incomingState.messageDefinitions.map((m) => ({ ...m }))
			: originalState.messageDefinitions.map((m) => ({ ...m }));
	}
	if (incomingState.eventListeners !== undefined) {
		mergedState.eventListeners = incomingState.eventListeners.map((e) => ({ ...e }));
	}
	if (incomingState.localizations !== undefined) {
		mergedState.localizations = incomingState.localizations.map((l) => ({ ...l }));
	}
	if (incomingState.dataObjects !== undefined && incomingState.dataObjects.length > 0) {
		mergedState.dataObjects = incomingState.dataObjects.map((d) => ({ ...d }));
	} else if (originalState.dataObjects.length > 0) {
		mergedState.dataObjects = originalState.dataObjects.map((d) => ({ ...d }));
	}

	ensureActivitiNamespace(mergedState);

	const document = parseXmlDocument(serializedXml);
	const definitions = document.documentElement;
	if (!definitions) {
		return serializedXml;
	}

	for (const [prefix, namespaceUri] of Object.entries(mergedState.namespaces)) {
		definitions.setAttributeNS(XMLNS_NAMESPACE, `xmlns:${prefix}`, namespaceUri);
	}

	// Merge target namespace
	if (mergedState.targetNamespace) {
		definitions.setAttribute('targetNamespace', mergedState.targetNamespace);
	}

	for (const element of Array.from(document.getElementsByTagName('*'))) {
		const id = element.getAttribute('id');
		if (!id) {
			continue;
		}

		const elementState = mergedState.elements[id];
		if (!elementState) {
			continue;
		}

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

		const desiredExtensionChildren = [
			...elementState.fieldExtensions.map(buildFieldExtensionNode),
			...elementState.inputParameters.map((param) => buildIOParameterNode('activiti:in', param)),
			...elementState.outputParameters.map((param) => buildIOParameterNode('activiti:out', param)),
			...elementState.taskListeners.map((listener) => buildListenerNode('activiti:taskListener', listener)),
			...elementState.executionListeners.map((listener) => buildListenerNode('activiti:executionListener', listener)),
			...elementState.formProperties.map(buildFormPropertyNode),
			...(elementState.failedJobRetryTimeCycle
				? [`<activiti:failedJobRetryTimeCycle>${escapeXml(elementState.failedJobRetryTimeCycle)}</activiti:failedJobRetryTimeCycle>`]
				: []),
			...elementState.exceptionMaps.map((em) => {
				const attrs = [];
				if (em.errorCode) { attrs.push(`errorCode="${escapeXml(em.errorCode)}"`); }
				if (em.includeChildExceptions) { attrs.push(`includeChildExceptions="true"`); }
				return `<activiti:mapException ${attrs.join(' ')}>${escapeXml(em.className)}</activiti:mapException>`;
			}),
			...elementState.preservedExtensionElements,
		];
		const existingExtensionElements = findDirectChild(element, 'extensionElements');

		if (desiredExtensionChildren.length === 0) {
			if (existingExtensionElements) {
				element.removeChild(existingExtensionElements);
			}
		} else {
			const extensionElements = existingExtensionElements || document.createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
			while (extensionElements.firstChild) {
				extensionElements.removeChild(extensionElements.firstChild);
			}

			for (const child of parseXmlFragment(desiredExtensionChildren.join(''), mergedState.namespaces)) {
				extensionElements.appendChild(document.importNode(child, true));
			}

			if (!existingExtensionElements) {
				element.appendChild(extensionElements);
			}
		}

		// Merge documentation
		if (elementState.documentation !== undefined) {
			const existingDoc = findDirectChild(element, 'documentation');
			if (elementState.documentation) {
				if (existingDoc) {
					existingDoc.textContent = elementState.documentation;
				} else {
					const docEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'documentation');
					docEl.textContent = elementState.documentation;
					element.insertBefore(docEl, element.firstChild);
				}
			} else if (existingDoc) {
				element.removeChild(existingDoc);
			}
		}

		// Merge conditionExpression
		if (elementState.conditionExpression !== undefined) {
			const existingCondition = findDirectChild(element, 'conditionExpression');
			if (elementState.conditionExpression) {
				if (existingCondition) {
					existingCondition.textContent = elementState.conditionExpression;
				} else {
					const condEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'conditionExpression');
					condEl.setAttribute('xsi:type', 'tFormalExpression');
					condEl.textContent = elementState.conditionExpression;
					element.appendChild(condEl);
				}
			} else if (existingCondition) {
				element.removeChild(existingCondition);
			}
		}

		// Merge script
		if (elementState.script !== undefined) {
			const existingScript = findDirectChild(element, 'script');
			if (elementState.script) {
				if (existingScript) {
					existingScript.textContent = elementState.script;
				} else {
					const scriptEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'script');
					scriptEl.textContent = elementState.script;
					element.appendChild(scriptEl);
				}
			} else if (existingScript) {
				element.removeChild(existingScript);
			}
		}

		// Merge multiInstanceLoopCharacteristics
		const existingMultiInstance = findDirectChild(element, 'multiInstanceLoopCharacteristics');
		if (elementState.multiInstance) {
			const miFragment = parseXmlFragment(buildMultiInstanceNode(elementState.multiInstance), mergedState.namespaces);
			if (existingMultiInstance) {
				element.removeChild(existingMultiInstance);
			}
			for (const miChild of miFragment) {
				element.appendChild(document.importNode(miChild, true));
			}
		} else if (existingMultiInstance && elementState.multiInstance === null) {
			element.removeChild(existingMultiInstance);
		}

		// Merge timerEventDefinition
		const existingTimerDef = findDirectChild(element, 'timerEventDefinition');
		if (existingTimerDef && elementState.timerDefinition) {
			for (const timerType of ['timeDuration', 'timeDate', 'timeCycle']) {
				const existing = findDirectChild(existingTimerDef, timerType);
				if (existing) {
					existingTimerDef.removeChild(existing);
				}
			}
			if (elementState.timerDefinition.value) {
				const timerChild = document.createElementNS(BPMN_MODEL_NAMESPACE, elementState.timerDefinition.type);
				timerChild.textContent = elementState.timerDefinition.value;
				existingTimerDef.appendChild(timerChild);
			}
		} else if (!existingTimerDef && elementState.timerDefinition?.value) {
			const timerDefEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'timerEventDefinition');
			const timerChild = document.createElementNS(BPMN_MODEL_NAMESPACE, elementState.timerDefinition.type);
			timerChild.textContent = elementState.timerDefinition.value;
			timerDefEl.appendChild(timerChild);
			element.appendChild(timerDefEl);
		}

		// Merge errorEventDefinition
		const existingErrorDef = findDirectChild(element, 'errorEventDefinition');
		if (existingErrorDef) {
			if (elementState.errorRef) {
				existingErrorDef.setAttribute('errorRef', elementState.errorRef);
			} else {
				existingErrorDef.removeAttribute('errorRef');
			}
		}

		// Merge signalEventDefinition
		const existingSignalDef = findDirectChild(element, 'signalEventDefinition');
		if (existingSignalDef) {
			if (elementState.signalRef) {
				existingSignalDef.setAttribute('signalRef', elementState.signalRef);
			} else {
				existingSignalDef.removeAttribute('signalRef');
			}
		}

		// Merge messageEventDefinition
		const existingMessageDef = findDirectChild(element, 'messageEventDefinition');
		if (existingMessageDef) {
			if (elementState.messageRef) {
				existingMessageDef.setAttribute('messageRef', elementState.messageRef);
			} else {
				existingMessageDef.removeAttribute('messageRef');
			}
		}

		// Merge terminateAll on terminateEventDefinition
		const existingTerminateDef = findDirectChild(element, 'terminateEventDefinition');
		if (existingTerminateDef) {
			if (elementState.terminateAll === 'true') {
				existingTerminateDef.setAttribute('activiti:terminateAll', 'true');
			} else {
				existingTerminateDef.removeAttribute('activiti:terminateAll');
			}
		}

		// Merge compensateActivityRef on compensateEventDefinition
		const existingCompensateDef = findDirectChild(element, 'compensateEventDefinition');
		if (existingCompensateDef) {
			if (elementState.compensateActivityRef) {
				existingCompensateDef.setAttribute('activityRef', elementState.compensateActivityRef);
			} else {
				existingCompensateDef.removeAttribute('activityRef');
			}
		}

		// Merge isForCompensation attribute
		if (elementState.isForCompensation === 'true') {
			element.setAttribute('isForCompensation', 'true');
		} else {
			element.removeAttribute('isForCompensation');
		}
	}

	// Merge signal definitions at <definitions> level
	const existingSignals = Array.from(definitions.childNodes).filter(
		(n): n is XmlElement => n.nodeType === 1 && getLocalName(n) === 'signal',
	);
	for (const existing of existingSignals) {
		definitions.removeChild(existing);
	}
	const firstProcess = findDirectChild(definitions, 'process');
	for (const signalDef of mergedState.signalDefinitions) {
		const signalEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'signal');
		signalEl.setAttribute('id', signalDef.id);
		signalEl.setAttribute('name', signalDef.name);
		if (signalDef.scope) {
			signalEl.setAttribute('activiti:scope', signalDef.scope);
		}
		if (firstProcess) {
			definitions.insertBefore(signalEl, firstProcess);
		} else {
			definitions.appendChild(signalEl);
		}
	}

	// Merge message definitions at <definitions> level
	const existingMessages = Array.from(definitions.childNodes).filter(
		(n): n is XmlElement => n.nodeType === 1 && getLocalName(n) === 'message',
	);
	for (const existing of existingMessages) {
		definitions.removeChild(existing);
	}
	for (const messageDef of mergedState.messageDefinitions) {
		const messageEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'message');
		messageEl.setAttribute('id', messageDef.id);
		messageEl.setAttribute('name', messageDef.name);
		if (firstProcess) {
			definitions.insertBefore(messageEl, firstProcess);
		} else {
			definitions.appendChild(messageEl);
		}
	}

	// Merge data objects on <process>
	const processElForData = findDirectChild(definitions, 'process');
	if (processElForData && mergedState.dataObjects.length > 0) {
		// Remove existing data objects
		for (const existing of getElementChildren(processElForData).filter(c => getLocalName(c) === 'dataObject')) {
			processElForData.removeChild(existing);
		}
		for (const dataObj of mergedState.dataObjects) {
			const dataObjEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'dataObject');
			dataObjEl.setAttribute('id', dataObj.id);
			dataObjEl.setAttribute('name', dataObj.name);
			if (dataObj.itemSubjectRef) {
				dataObjEl.setAttribute('itemSubjectRef', dataObj.itemSubjectRef);
			}
			if (dataObj.defaultValue) {
				const extEls = document.createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
				const valNode = parseXmlFragment(
					`<activiti:value>${escapeXml(dataObj.defaultValue)}</activiti:value>`,
					mergedState.namespaces,
				);
				for (const v of valNode) {
					extEls.appendChild(document.importNode(v, true));
				}
				dataObjEl.appendChild(extEls);
			}
			processElForData.appendChild(dataObjEl);
		}
	}

	// Merge event listeners and localizations on <process> extensionElements
	const processEl = findDirectChild(definitions, 'process');
	if (processEl) {
		let processExtEl = findDirectChild(processEl, 'extensionElements');

		// Remove existing activiti:eventListener and activiti:localization children
		if (processExtEl) {
			for (const child of getElementChildren(processExtEl).filter(
				c => c.nodeName === 'activiti:eventListener' || c.nodeName === 'activiti:localization',
			)) {
				processExtEl.removeChild(child);
			}
		}

		const needsExtEl = mergedState.eventListeners.length > 0 || mergedState.localizations.length > 0;
		if (needsExtEl) {
			if (!processExtEl) {
				processExtEl = document.createElementNS(BPMN_MODEL_NAMESPACE, 'extensionElements');
				processEl.insertBefore(processExtEl, processEl.firstChild);
			}

			if (mergedState.eventListeners.length > 0) {
				const eventListenerXml = mergedState.eventListeners.map(buildEventListenerNode).join('');
				for (const child of parseXmlFragment(eventListenerXml, mergedState.namespaces)) {
					processExtEl.appendChild(document.importNode(child, true));
				}
			}

			if (mergedState.localizations.length > 0) {
				const localizationXml = mergedState.localizations.map(buildLocalizationNode).join('');
				for (const child of parseXmlFragment(localizationXml, mergedState.namespaces)) {
					processExtEl.appendChild(document.importNode(child, true));
				}
			}
		}
	}

	return formatXml(serializer.serializeToString(document));
}
