import { DOMParser, type Document as XmlDocument } from '@xmldom/xmldom';

function hasDoctypeDeclaration(xml: string): boolean {
	for (let index = 0; index < xml.length; index += 1) {
		if (xml[index] !== '<' || index + 2 >= xml.length || xml[index + 1] !== '!') {
			continue;
		}

		if (xml.startsWith('<!--', index)) {
			const commentEnd = xml.indexOf('-->', index + 4);
			if (commentEnd === -1) {
				return false;
			}
			index = commentEnd + 2;
			continue;
		}

		if (xml.startsWith('<![CDATA[', index)) {
			const cdataEnd = xml.indexOf(']]>', index + 9);
			if (cdataEnd === -1) {
				return false;
			}
			index = cdataEnd + 2;
			continue;
		}

		if (xml.slice(index + 2, index + 9).toUpperCase() === 'DOCTYPE') {
			return true;
		}
	}

	return false;
}

/**
 * Safely parses an XML string, rejecting DOCTYPE declarations to prevent
 * entity expansion attacks (e.g. "billion laughs").
 */
export function parseXmlDocument(xml: string): XmlDocument {
	if (hasDoctypeDeclaration(xml)) {
		throw new Error('DOCTYPE declarations are not supported in BPMN files.');
	}

	const document = new DOMParser().parseFromString(xml, 'application/xml');
	const parserErrors = document.getElementsByTagName('parsererror');

	if (parserErrors.length > 0) {
		throw new Error(parserErrors[0]?.textContent || 'Invalid XML document.');
	}

	return document;
}
