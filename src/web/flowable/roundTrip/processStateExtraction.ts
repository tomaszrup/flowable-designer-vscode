import type { Element as XmlElement } from '@xmldom/xmldom';
import type { FlowableDocumentState } from '../types';
import {
	buildXmlIdentity,
	findDirectChild,
	getElementChildren,
	getLocalName,
	isActivitiElement,
	serializer,
} from './xmlUtils';
import { parseEventListener } from './xmlParsers';

function extractProcessExtensionState(
	processElement: XmlElement,
	processId: string,
	documentState: FlowableDocumentState,
): void {
	const extensionElements = findDirectChild(processElement, 'extensionElements');
	if (!extensionElements) {
		return;
	}

	const preservedExtensionElements: string[] = [];
	for (const child of getElementChildren(extensionElements)) {
		if (isActivitiElement(child, 'eventListener')) {
			documentState.eventListeners.push({
				...parseEventListener(child),
				processId,
			});
			continue;
		}

		if (isActivitiElement(child, 'localization')) {
			const localizationElement = child as XmlElement;
			const locale = localizationElement.getAttribute('locale') || '';
			const documentationChild = findDirectChild(localizationElement, 'documentation');
			documentState.localizations.push({
				id: `localization-${locale}`,
				processId,
				locale,
				name: localizationElement.getAttribute('name') || '',
				description: documentationChild?.textContent || '',
				xmlIdentity: buildXmlIdentity('processLocalization', localizationElement),
			});
			continue;
		}

		preservedExtensionElements.push(serializer.serializeToString(child));
	}

	if (preservedExtensionElements.length > 0) {
		documentState.processExtensionElements.push({
			processId,
			preservedExtensionElements,
		});
	}
}

function extractProcessDataObjects(
	processElement: XmlElement,
	processId: string,
	documentState: FlowableDocumentState,
): void {
	for (const child of getElementChildren(processElement)) {
		if (getLocalName(child) !== 'dataObject') {
			continue;
		}

		const id = child.getAttribute('id') || '';
		if (!id) {
			continue;
		}

		let defaultValue = '';
		const dataObjectExtensions = findDirectChild(child, 'extensionElements');
		if (dataObjectExtensions) {
			for (const extensionChild of getElementChildren(dataObjectExtensions)) {
				if (isActivitiElement(extensionChild, 'value')) {
					defaultValue = extensionChild.textContent || '';
				}
			}
		}

		documentState.dataObjects.push({
			id,
			processId,
			name: child.getAttribute('name') || '',
			itemSubjectRef: child.getAttribute('itemSubjectRef') || '',
			defaultValue,
			xmlIdentity: buildXmlIdentity('dataObject', child),
		});
	}
}

export function extractProcessLevelState(processElement: XmlElement, documentState: FlowableDocumentState): void {
	const processId = processElement.getAttribute('id') || '';
	extractProcessExtensionState(processElement, processId, documentState);
	extractProcessDataObjects(processElement, processId, documentState);
}