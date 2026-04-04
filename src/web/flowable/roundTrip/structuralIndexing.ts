import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';

export function buildIdMap(document: XmlDocument): Map<string, XmlElement> {
	const elementsById = new Map<string, XmlElement>();
	for (const element of Array.from(document.getElementsByTagName('*'))) {
		const id = element.getAttribute('id');
		if (id) {
			elementsById.set(id, element);
		}
	}
	return elementsById;
}

export function collectNamespaceDeclarations(element: XmlElement): Record<string, string> {
	const namespaces: Record<string, string> = {};
	for (const attribute of Array.from(element.attributes)) {
		if (attribute.name.startsWith('xmlns:')) {
			namespaces[attribute.name.slice(6)] = attribute.value;
		}
	}
	return namespaces;
}