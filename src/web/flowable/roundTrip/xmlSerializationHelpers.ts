import type { Element as XmlElement, Node as XmlNode } from '@xmldom/xmldom';
import { escapeXml, escapeXmlText, serializer } from './xmlUtils';

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

function isMixedContentNode(node: XmlNode): boolean {
	return (node.nodeType === node.TEXT_NODE && (node.nodeValue || '').trim().length > 0)
		|| (node.nodeType === node.CDATA_SECTION_NODE && (node.nodeValue || '').length > 0);
}

function hasMixedContent(childNodes: XmlNode[]): boolean {
	return childNodes.some(isMixedContentNode);
}

function serializeInlineElement(element: XmlElement, attributes: string, childNodes: XmlNode[], indent: string): string {
	const content = childNodes.map(serializeInlineNode).join('');
	return `${indent}<${element.tagName}${attributes}>${content}</${element.tagName}>\n`;
}

function getBlockChildNodes(childNodes: XmlNode[]): XmlNode[] {
	return childNodes.filter((child) => child.nodeType !== child.TEXT_NODE || (child.textContent || '').trim().length > 0);
}

function serializeBlockElement(element: XmlElement, attributes: string, childNodes: XmlNode[], depth: number, indent: string): string {
	let result = `${indent}<${element.tagName}${attributes}>\n`;
	for (const child of childNodes) {
		result += serializeXmlNode(child, depth + 1);
	}
	result += `${indent}</${element.tagName}>\n`;
	return result;
}

function serializeElementNode(element: XmlElement, depth: number, indent: string): string {
	const attributes = Array.from(element.attributes)
		.map((attribute) => ` ${attribute.name}="${escapeXml(attribute.value)}"`)
		.join('');
	const rawChildNodes = Array.from(element.childNodes);
	const hasElementChildren = rawChildNodes.some((child) => child.nodeType === child.ELEMENT_NODE);

	if (!hasElementChildren && rawChildNodes.length === 0) {
		return `${indent}<${element.tagName}${attributes}/>\n`;
	}

	if (!hasElementChildren || hasMixedContent(rawChildNodes)) {
		return serializeInlineElement(element, attributes, rawChildNodes, indent);
	}

	return serializeBlockElement(element, attributes, getBlockChildNodes(rawChildNodes), depth, indent);
}

function serializeTextNode(node: XmlNode, indent: string): string {
	const value = node.nodeValue || '';
	if (value.trim().length === 0) {
		return '';
	}
	return `${indent}${escapeXmlText(value)}\n`;
}

function serializeNonElementNode(node: XmlNode, indent: string): string {
	if (node.nodeType === node.TEXT_NODE) {
		return serializeTextNode(node, indent);
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

export function isXmlDeclarationNode(node: XmlNode): boolean {
	return node.nodeType === node.PROCESSING_INSTRUCTION_NODE && node.nodeName.toLowerCase() === 'xml';
}

export function serializeXmlNode(node: XmlNode, depth: number): string {
	const indent = '  '.repeat(depth);
	if (node.nodeType === node.ELEMENT_NODE) {
		return serializeElementNode(node as XmlElement, depth, indent);
	}

	return serializeNonElementNode(node, indent);
}