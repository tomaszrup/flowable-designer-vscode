import { XMLSerializer, type Attr as XmlAttr, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import { parseXmlDocument } from '../xmlParser';
import { ACTIVITI_NAMESPACE, BPMN_MODEL_NAMESPACE } from './constants';

export const serializer = new XMLSerializer();

export function getElementChildren(element: XmlElement): XmlElement[] {
	return Array.from(element.childNodes).filter((node): node is XmlElement => node.nodeType === node.ELEMENT_NODE);
}

export function getLocalName(node: XmlNode): string {
	return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function matchesQualifiedNode(
	node: Pick<XmlNode, 'nodeName' | 'namespaceURI' | 'localName'>,
	localName: string,
	namespaceUri?: string,
): boolean {
	const nodeLocalName = node.localName || node.nodeName.split(':').pop() || node.nodeName;
	if (nodeLocalName !== localName) {
		return false;
	}

	if (!namespaceUri) {
		return true;
	}

	if ((node.namespaceURI || '') === namespaceUri) {
		return true;
	}

	if (!node.namespaceURI && namespaceUri === ACTIVITI_NAMESPACE) {
		return node.nodeName === `activiti:${localName}`;
	}

	return false;
}

export function isElementNamed(node: XmlNode, localName: string, namespaceUri?: string): node is XmlElement {
	return node.nodeType === node.ELEMENT_NODE && matchesQualifiedNode(node, localName, namespaceUri);
}

export function isActivitiElement(node: XmlNode, localName: string): node is XmlElement {
	return isElementNamed(node, localName, ACTIVITI_NAMESPACE);
}

function getTraversalRoot(root: XmlDocument | XmlElement): XmlElement | undefined {
	if ('documentElement' in root) {
		return root.documentElement || undefined;
	}

	return root;
}

function collectDescendantElements(root: XmlDocument | XmlElement): XmlElement[] {
	const traversalRoot = getTraversalRoot(root);
	if (!traversalRoot) {
		return [];
	}

	const elements: XmlElement[] = [];
	const queue: XmlElement[] = [traversalRoot];
	while (queue.length > 0) {
		const [element] = queue.splice(0, 1);
		elements.push(element);
		queue.push(...getElementChildren(element));
	}

	return elements;
}

export function getElementsByLocalName(root: XmlDocument | XmlElement, localName: string, namespaceUri?: string): XmlElement[] {
	const elements = collectDescendantElements(root);
	if (localName === '*') {
		return elements;
	}

	return elements.filter((node): node is XmlElement => {
		return matchesQualifiedNode(node, localName, namespaceUri);
	});
}

function findAttribute(element: XmlElement, localName: string, namespaceUri?: string): XmlAttr | undefined {
	return Array.from(element.attributes).find((attribute) => matchesQualifiedNode(attribute, localName, namespaceUri));
}

export function getAttributeValue(element: XmlElement, localName: string, namespaceUri?: string): string {
	return findAttribute(element, localName, namespaceUri)?.value || '';
}

export function getActivitiAttribute(element: XmlElement, localName: string): string {
	return getAttributeValue(element, localName, ACTIVITI_NAMESPACE);
}

export function setActivitiAttribute(element: XmlElement, localName: string, value: string): void {
	element.setAttributeNS(ACTIVITI_NAMESPACE, `activiti:${localName}`, value);
}

export function removeActivitiAttribute(element: XmlElement, localName: string): void {
	const attribute = findAttribute(element, localName, ACTIVITI_NAMESPACE);
	if (attribute) {
		element.removeAttributeNode(attribute);
	}
}

export function isSameElementType(left: XmlElement, right: XmlElement): boolean {
	return getLocalName(left) === getLocalName(right) && (left.namespaceURI || '') === (right.namespaceURI || '');
}

function replaceAllPlain(value: string, search: string, replacement: string): string {
	return value.split(search).join(replacement);
}

export function escapeXml(value: string): string {
	let escapedValue = replaceAllPlain(value, '&', '&amp;');
	escapedValue = replaceAllPlain(escapedValue, '<', '&lt;');
	escapedValue = replaceAllPlain(escapedValue, '>', '&gt;');
	escapedValue = replaceAllPlain(escapedValue, '"', '&quot;');
	return replaceAllPlain(escapedValue, "'", '&apos;');
}

export function escapeXmlText(value: string): string {
	let escapedValue = replaceAllPlain(value, '&', '&amp;');
	escapedValue = replaceAllPlain(escapedValue, '<', '&lt;');
	return replaceAllPlain(escapedValue, '>', '&gt;');
}

function buildNamespaceWrapper(namespaces: Record<string, string>): string {
	const namespaceAttributes = Object.entries(namespaces)
		.map(([prefix, uri]) => `xmlns:${prefix}="${escapeXml(uri)}"`)
		.join(' ');

	return `<root xmlns="${BPMN_MODEL_NAMESPACE}" ${namespaceAttributes}>`;
}

export function getNodeDocument(node: XmlNode): XmlDocument {
	return (node.ownerDocument || node) as XmlDocument;
}

export function insertAfter(parent: XmlNode, newNode: XmlNode, referenceNode: XmlNode): void {
	if (referenceNode.nextSibling) {
		parent.insertBefore(newNode, referenceNode.nextSibling);
	} else {
		parent.appendChild(newNode);
	}
}

export function insertBeforeNode(parent: XmlNode, newNode: XmlNode, referenceNode: XmlNode): void {
	const beforeCapableReference = referenceNode as XmlNode & { before?: (node: XmlNode) => void };
	if (typeof beforeCapableReference.before === 'function') {
		beforeCapableReference.before(newNode);
		return;
	}

	const insertBefore = parent.insertBefore.bind(parent);
	insertBefore(newNode, referenceNode);
}

export function replaceNode(targetNode: XmlNode, replacementNode: XmlNode): void {
	const replaceCapableNode = targetNode as XmlNode & { replaceWith?: (node: XmlNode) => void };
	if (typeof replaceCapableNode.replaceWith === 'function') {
		replaceCapableNode.replaceWith(replacementNode);
		return;
	}

	targetNode.parentNode?.replaceChild(replacementNode, targetNode);
}

export function detachNode(node: XmlNode): void {
	if (node.parentNode) {
		const removeChild = node.parentNode.removeChild.bind(node.parentNode);
		removeChild(node);
	}
}

export function setTextContentPreservingComments(element: XmlElement, value: string): void {
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === child.TEXT_NODE || child.nodeType === child.CDATA_SECTION_NODE) {
			detachNode(child);
		}
	}

	if (!value) {
		return;
	}

	const firstNonTextChild = Array.from(element.childNodes).find((child) => {
		return child.nodeType !== child.TEXT_NODE && child.nodeType !== child.CDATA_SECTION_NODE;
	});
	const textNode = getNodeDocument(element).createTextNode(value);
	if (firstNonTextChild) {
		const insertBefore = element.insertBefore.bind(element);
		insertBefore(textNode, firstNonTextChild);
	} else {
		element.appendChild(textNode);
	}
}

export function parseXmlFragment(xml: string, namespaces: Record<string, string>): XmlElement[] {
	const fragmentDocument = parseXmlDocument(`${buildNamespaceWrapper(namespaces)}${xml}</root>`);
	if (!fragmentDocument.documentElement) {
		return [];
	}

	return getElementChildren(fragmentDocument.documentElement);
}

export function findDirectChild(element: XmlElement, localName: string): XmlElement | undefined {
	return getElementChildren(element).find((child) => getLocalName(child) === localName);
}

export function buildXmlIdentity(scope: string, element: XmlElement): string {
	let index = 0;
	let sibling = element.previousSibling;
	while (sibling) {
		if (sibling.nodeType === sibling.ELEMENT_NODE && isSameElementType(sibling as XmlElement, element)) {
			index++;
		}
		sibling = sibling.previousSibling;
	}

	return `${scope}:${element.namespaceURI || ''}:${getLocalName(element)}:${index}`;
}