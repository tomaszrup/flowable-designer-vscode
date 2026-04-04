import type { Document as XmlDocument } from '@xmldom/xmldom';
import { isXmlDeclarationNode, serializeXmlNode } from './xmlSerializationHelpers';

export function serializeXmlDocument(document: XmlDocument): string {
	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
	for (const child of Array.from(document.childNodes)) {
		if (isXmlDeclarationNode(child)) {
			continue;
		}
		xml += serializeXmlNode(child, 0);
	}
	return xml;
}