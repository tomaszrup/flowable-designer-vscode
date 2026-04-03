import type { Element as XmlElement, Node as XmlNode } from '@xmldom/xmldom';
import type { XmlIdentified } from '../types';
import { BPMN_MODEL_NAMESPACE, managedExtensionChildNames } from './constants';
import {
	buildXmlIdentity,
	detachNode,
	findDirectChild,
	getElementChildren,
	getLocalName,
	getNodeDocument,
	insertAfter,
	insertBeforeNode,
	isActivitiElement,
	parseXmlFragment,
	replaceNode,
} from './xmlUtils';

interface CollectionOptions<T extends XmlIdentified> {
	isManagedNode: (node: XmlElement) => boolean;
	createNode: (item: T) => XmlElement;
	patchNode: (node: XmlElement, item: T) => void;
	matchFallback?: (node: XmlElement, item: T) => boolean;
	insertBefore?: (parent: XmlElement) => XmlNode | null;
}

function findFallbackMatch<T extends XmlIdentified>(
	item: T,
	existingNodes: XmlElement[],
	matchedNodes: Set<XmlElement>,
	matchFallback: ((node: XmlElement, item: T) => boolean) | undefined,
): XmlElement | undefined {
	if (!matchFallback) {
		return undefined;
	}

	const fallbackMatches = existingNodes.filter((node) => !matchedNodes.has(node) && matchFallback(node, item));
	if (fallbackMatches.length === 1) {
		return fallbackMatches[0];
	}

	if (fallbackMatches.length > 1 && item.xmlIdentity) {
		const scope = item.xmlIdentity.slice(0, item.xmlIdentity.indexOf(':'));
		return fallbackMatches.find((node) => item.xmlIdentity === buildXmlIdentity(scope, node));
	}

	return undefined;
}

function findIdentityMatch<T extends XmlIdentified>(item: T, existingNodes: XmlElement[], matchedNodes: Set<XmlElement>): XmlElement | undefined {
	if (!item.xmlIdentity) {
		return undefined;
	}

	const scope = item.xmlIdentity.slice(0, item.xmlIdentity.indexOf(':'));
	return existingNodes.find((node) => !matchedNodes.has(node) && item.xmlIdentity === buildXmlIdentity(scope, node));
}

function resolveNodeToPlace<T extends XmlIdentified>(
	item: T,
	existingNodes: XmlElement[],
	matchedNodes: Set<XmlElement>,
	options: CollectionOptions<T>,
): XmlElement {
	return findFallbackMatch(item, existingNodes, matchedNodes, options.matchFallback)
		?? findIdentityMatch(item, existingNodes, matchedNodes)
		?? options.createNode(item);
}

function placeManagedNode(
	parent: XmlElement,
	node: XmlElement,
	lastPlacedNode: XmlNode | null,
	insertionAnchor: XmlNode | null,
	isManagedNode: (node: XmlElement) => boolean,
): void {
	if (lastPlacedNode?.parentNode === parent) {
		if (lastPlacedNode.nextSibling !== node) {
			insertAfter(parent, node, lastPlacedNode);
		}
		return;
	}

	if (insertionAnchor?.parentNode === parent && insertionAnchor !== node) {
		insertBeforeNode(parent, node, insertionAnchor);
		return;
	}

	const firstManagedSibling = Array.from(parent.childNodes).find((child): child is XmlElement => {
		return child !== node && child.nodeType === child.ELEMENT_NODE && isManagedNode(child as XmlElement);
	});

	if (firstManagedSibling) {
		insertBeforeNode(parent, node, firstManagedSibling);
	} else if (node.parentNode !== parent) {
		parent.appendChild(node);
	}
}

export function reconcileManagedCollection<T extends XmlIdentified>(
	parent: XmlElement,
	items: T[],
	options: CollectionOptions<T>,
): void {
	const existingNodes = getElementChildren(parent).filter(options.isManagedNode);
	const matchedNodes = new Set<XmlElement>();
	let lastPlacedNode: XmlNode | null = null;
	const insertionAnchor = options.insertBefore?.(parent) || null;

	for (const item of items) {
		const nodeToPlace = resolveNodeToPlace(item, existingNodes, matchedNodes, options);

		options.patchNode(nodeToPlace, item);
		placeManagedNode(parent, nodeToPlace, lastPlacedNode, insertionAnchor, options.isManagedNode);
		lastPlacedNode = nodeToPlace;
		matchedNodes.add(nodeToPlace);
	}

	for (const existingNode of existingNodes) {
		if (!matchedNodes.has(existingNode)) {
			detachNode(existingNode);
		}
	}
}

export function createElementFromFragment(parent: XmlElement, xml: string, namespaces: Record<string, string>): XmlElement {
	const fragment = parseXmlFragment(xml, namespaces)[0];
	return getNodeDocument(parent).importNode(fragment, true) as XmlElement;
}

function isManagedExtensionChild(node: XmlElement): boolean {
	const localName = getLocalName(node);
	return managedExtensionChildNames.has(localName) && isActivitiElement(node, localName);
}

export function appendPreservedExtensionElements(
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
				replaceNode(existingNode, importedFragment);
			} else {
				extensionElements.appendChild(importedFragment);
			}
			preservedIndex += 1;
		}
	}

	for (const staleNode of existingPreservedNodes.slice(preservedIndex)) {
		detachNode(staleNode);
	}
}

export function ensureExtensionElements(element: XmlElement): XmlElement {
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

export function hasMeaningfulChildren(element: XmlElement): boolean {
	return Array.from(element.childNodes).some((child) => {
		if (child.nodeType === child.TEXT_NODE) {
			return (child.textContent || '').trim().length > 0;
		}
		return true;
	});
}