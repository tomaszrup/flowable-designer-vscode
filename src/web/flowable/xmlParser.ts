import { DOMParser, type Document as XmlDocument } from '@xmldom/xmldom';

/**
 * Safely parses an XML string, rejecting DOCTYPE declarations to prevent
 * entity expansion attacks (e.g. "billion laughs").
 */
export function parseXmlDocument(xml: string): XmlDocument {
	if (/<!DOCTYPE/i.test(xml)) {
		throw new Error('DOCTYPE declarations are not supported in BPMN files.');
	}

	const document = new DOMParser().parseFromString(xml, 'application/xml');
	const parserErrors = document.getElementsByTagName('parsererror');

	if (parserErrors.length > 0) {
		throw new Error(parserErrors[0]?.textContent || 'Invalid XML document.');
	}

	return document;
}
