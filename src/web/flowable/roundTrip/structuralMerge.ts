import type {
	Document as XmlDocument,
	Element as XmlElement,
	Node as XmlNode,
} from '@xmldom/xmldom';
import { FLOWABLE_ATTRIBUTE_KEYS } from '../types';
import { XMLNS_NAMESPACE } from './constants';
import {
	buildXmlIdentity,
	detachNode,
	getElementChildren,
	getLocalName,
	getNodeDocument,
	insertAfter,
	isSameElementType,
	serializer,
	setTextContentPreservingComments,
} from './xmlUtils';

const editableActivitiAttributes = new Set(FLOWABLE_ATTRIBUTE_KEYS.map((key) => `activiti:${key}`));
const editableLegacyAttributes = new Set(FLOWABLE_ATTRIBUTE_KEYS);
const overlayManagedChildNames = new Set([
	'extensionElements',
	'documentation',
	'conditionExpression',
	'script',
	'multiInstanceLoopCharacteristics',
]);

interface NodePlacement {
	node: XmlNode;
	existedHere: boolean;
}

export interface StructuralMergeContext {
	originalById: Map<string, XmlElement>;
	preserveUnmatchedLexicalNodes: boolean;
}

function shouldPreserveUnmatchedLexicalNodes(sourceHasLexicalNodes: boolean, context: StructuralMergeContext): boolean {
	return context.preserveUnmatchedLexicalNodes && !sourceHasLexicalNodes;
}

function shouldSyncStructuralAttribute(attributeName: string): boolean {
	return !editableActivitiAttributes.has(attributeName) && !editableLegacyAttributes.has(attributeName as typeof FLOWABLE_ATTRIBUTE_KEYS[number]);
}

function applySourceStructuralAttributes(target: XmlElement, source: XmlElement): Map<string, string> {
	const sourceAttributes = new Map<string, string>();
	for (const attribute of Array.from(source.attributes)) {
		if (!shouldSyncStructuralAttribute(attribute.name)) {
			continue;
		}
		sourceAttributes.set(attribute.name, attribute.value);
		if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) {
			target.setAttributeNS(XMLNS_NAMESPACE, attribute.name, attribute.value);
			continue;
		}
		target.setAttribute(attribute.name, attribute.value);
	}
	return sourceAttributes;
}

function removeMissingStructuralAttributes(target: XmlElement, sourceAttributes: Map<string, string>): void {
	for (const attribute of Array.from(target.attributes)) {
		if (!shouldSyncStructuralAttribute(attribute.name) || sourceAttributes.has(attribute.name)) {
			continue;
		}
		if (attribute.name === 'xmlns') {
			target.removeAttribute('xmlns');
			continue;
		}
		if (attribute.name.startsWith('xmlns:')) {
			target.removeAttributeNS(XMLNS_NAMESPACE, attribute.localName || attribute.name.slice(6));
			continue;
		}
		target.removeAttribute(attribute.name);
	}
}

export function syncStructuralAttributes(target: XmlElement, source: XmlElement): void {
	const sourceAttributes = applySourceStructuralAttributes(target, source);
	removeMissingStructuralAttributes(target, sourceAttributes);
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

function indexNodeById(idMap: Map<string, XmlElement>, node: XmlNode): void {
	if (node.nodeType !== node.ELEMENT_NODE) {
		return;
	}
	const element = node as XmlElement;
	const id = element.getAttribute('id');
	if (id) {
		idMap.set(id, element);
	}
	for (const child of getElementChildren(element)) {
		indexNodeById(idMap, child);
	}
}

function removeNodeIds(idMap: Map<string, XmlElement>, node: XmlNode): void {
	if (node.nodeType !== node.ELEMENT_NODE) {
		return;
	}
	const element = node as XmlElement;
	const id = element.getAttribute('id');
	if (id) {
		idMap.delete(id);
	}
	for (const child of getElementChildren(element)) {
		removeNodeIds(idMap, child);
	}
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

function getElementOrderKey(parent: XmlElement, child: XmlElement): string {
	const id = child.getAttribute('id');
	if (id) {
		return `id:${child.namespaceURI || ''}:${getLocalName(child)}:${id}`;
	}
	return buildXmlIdentity(`order:${getLocalName(parent)}`, child);
}

function didElementChildOrderChange(target: XmlElement, source: XmlElement): boolean {
	const leftKeys = getElementChildren(source).map((child) => getElementOrderKey(target, child));
	const rightKeys = getElementChildren(target).map((child) => getElementOrderKey(target, child));
	return JSON.stringify(leftKeys) !== JSON.stringify(rightKeys);
}

export function didStructuralElementChildOrderChange(target: XmlElement, source: XmlElement): boolean {
	const leftKeys = getElementChildren(source)
		.filter((child) => isStructuralChild(source, child))
		.map((child) => getElementOrderKey(source, child));
	const rightKeys = getElementChildren(target)
		.filter((child) => isStructuralChild(target, child))
		.map((child) => getElementOrderKey(target, child));
	return JSON.stringify(leftKeys) !== JSON.stringify(rightKeys);
}

function didDocumentElementOrderChange(leftChildren: XmlNode[], rightChildren: XmlNode[]): boolean {
	const leftKeys = leftChildren.filter((child) => child.nodeType === child.ELEMENT_NODE).map((child) => getDocumentChildKey(child));
	const rightKeys = rightChildren.filter((child) => child.nodeType === child.ELEMENT_NODE).map((child) => getDocumentChildKey(child));
	return JSON.stringify(leftKeys) !== JSON.stringify(rightKeys);
}

function createNodeBuckets(children: XmlNode[], getKey: (child: XmlNode) => string): Map<string, XmlNode[]> {
	const buckets = new Map<string, XmlNode[]>();
	for (const child of children) {
		const key = getKey(child);
		const bucket = buckets.get(key) || [];
		bucket.push(child);
		buckets.set(key, bucket);
	}
	return buckets;
}

function takeBucketNode(buckets: Map<string, XmlNode[]>, key: string): XmlNode | undefined {
	return buckets.get(key)?.shift();
}

function findNextStableNode(parent: XmlNode, placements: NodePlacement[], index: number): XmlNode | undefined {
	return placements.slice(index + 1).find((candidate) => candidate.existedHere && candidate.node.parentNode === parent)?.node;
}

function findPreviousPlacedNode(parent: XmlNode, placements: NodePlacement[], index: number): XmlNode | undefined {
	return placements.slice(0, index).reverse().find((candidate) => candidate.node.parentNode === parent)?.node;
}

function findFirstRelevantChild(parent: XmlNode, isRelevant: (child: XmlNode) => boolean, excludedNode: XmlNode): XmlNode | undefined {
	return Array.from(parent.childNodes).find((child) => isRelevant(child) && child !== excludedNode);
}

function placeNodes(parent: XmlNode, placements: NodePlacement[], isRelevant: (child: XmlNode) => boolean): void {
	for (let index = 0; index < placements.length; index++) {
		const placement = placements[index];
		if (placement.existedHere) {
			continue;
		}
		const nextStable = findNextStableNode(parent, placements, index);
		if (nextStable) {
			parent.insertBefore(placement.node, nextStable);
			continue;
		}
		const previousPlaced = findPreviousPlacedNode(parent, placements, index);
		if (previousPlaced) {
			insertAfter(parent, placement.node, previousPlaced);
			continue;
		}
		const firstRelevantChild = findFirstRelevantChild(parent, isRelevant, placement.node);
		if (firstRelevantChild) {
			parent.insertBefore(placement.node, firstRelevantChild);
		} else {
			parent.appendChild(placement.node);
		}
	}
}

function resolveDocumentTargetChild(
	target: XmlDocument,
	sourceChild: XmlNode,
	targetChildrenByKey: Map<string, XmlNode[]>,
): NodePlacement {
	const targetDocumentElement = target.documentElement;
	if (
		sourceChild.nodeType === sourceChild.ELEMENT_NODE
		&& targetDocumentElement?.nodeType === sourceChild.nodeType
		&& isSameElementType(targetDocumentElement, sourceChild as XmlElement)
	) {
		return { node: targetDocumentElement, existedHere: targetDocumentElement.parentNode === target };
	}
	const matchedNode = takeBucketNode(targetChildrenByKey, getDocumentChildKey(sourceChild));
	if (matchedNode) {
		return { node: matchedNode, existedHere: matchedNode.parentNode === target };
	}
	const importedNode = target.importNode(sourceChild, true);
	return { node: importedNode, existedHere: false };
}

function removeUnkeptDocumentChildren(
	target: XmlDocument,
	keptChildren: Set<XmlNode>,
	sourceHasLexicalNodes: boolean,
	documentElementOrderChanged: boolean,
	context: StructuralMergeContext,
): void {
	for (const child of Array.from(target.childNodes).filter((node) => !isXmlDeclarationNode(node))) {
		if (!keptChildren.has(child) && child.nodeType !== child.ELEMENT_NODE && shouldPreserveUnmatchedLexicalNodes(sourceHasLexicalNodes, context)) {
			continue;
		}
		const shouldRemove = !keptChildren.has(child)
			&& (child.nodeType === child.ELEMENT_NODE || sourceHasLexicalNodes || !documentElementOrderChanged);
		if (shouldRemove) {
			detachNode(child);
		}
	}
}

export function syncDocumentLexicalNodes(target: XmlDocument, source: XmlDocument, context: StructuralMergeContext): void {
	const sourceChildren = Array.from(source.childNodes).filter((node) => !isXmlDeclarationNode(node));
	const targetChildren = Array.from(target.childNodes).filter((node) => !isXmlDeclarationNode(node));
	const sourceHasLexicalNodes = sourceChildren.some((node) => node.nodeType !== node.ELEMENT_NODE);
	const documentElementOrderChanged = didDocumentElementOrderChange(sourceChildren, targetChildren);
	const targetChildrenByKey = createNodeBuckets(targetChildren, getDocumentChildKey);
	const keptChildren = new Set<XmlNode>();
	const placements = sourceChildren.map((sourceChild) => {
		const placement = resolveDocumentTargetChild(target, sourceChild, targetChildrenByKey);
		keptChildren.add(placement.node);
		return placement;
	});

	placeNodes(target, placements, (child) => !isXmlDeclarationNode(child));
	removeUnkeptDocumentChildren(target, keptChildren, sourceHasLexicalNodes, documentElementOrderChanged, context);
}

function getMatchedStructuralNodeById(sourceElement: XmlElement, context: StructuralMergeContext): XmlNode | undefined {
	const id = sourceElement.getAttribute('id');
	if (!id) {
		return undefined;
	}
	const matchedById = context.originalById.get(id);
	if (matchedById && isSameElementType(matchedById, sourceElement)) {
		return matchedById;
	}
	return undefined;
}

function syncMatchedStructuralElement(targetChild: XmlNode, sourceChild: XmlNode, context: StructuralMergeContext): void {
	if (targetChild.nodeType !== targetChild.ELEMENT_NODE || sourceChild.nodeType !== sourceChild.ELEMENT_NODE) {
		return;
	}
	const targetElement = targetChild as XmlElement;
	const sourceElement = sourceChild as XmlElement;
	syncStructuralAttributes(targetElement, sourceElement);
	reconcileStructuralChildren(targetElement, sourceElement, context);
	maybeSyncLeafText(targetElement, sourceElement);
}

function resolveStructuralTargetChild(
	target: XmlElement,
	sourceChild: XmlNode,
	targetChildrenByKey: Map<string, XmlNode[]>,
	context: StructuralMergeContext,
): NodePlacement {
	const sourceElement = sourceChild.nodeType === sourceChild.ELEMENT_NODE ? sourceChild as XmlElement : undefined;
	const matchedById = sourceElement ? getMatchedStructuralNodeById(sourceElement, context) : undefined;
	if (matchedById) {
		syncMatchedStructuralElement(matchedById, sourceChild, context);
		return { node: matchedById, existedHere: matchedById.parentNode === target };
	}
	const matchedByKey = takeBucketNode(targetChildrenByKey, getStructuralNodeKey(target, sourceChild));
	if (matchedByKey) {
		syncMatchedStructuralElement(matchedByKey, sourceChild, context);
		return { node: matchedByKey, existedHere: matchedByKey.parentNode === target };
	}
	const importedNode = getNodeDocument(target).importNode(sourceChild, true);
	indexNodeById(context.originalById, importedNode);
	return { node: importedNode, existedHere: false };
}

function removeUnkeptStructuralChildren(
	target: XmlElement,
	keptChildren: Set<XmlNode>,
	sourceHasLexicalNodes: boolean,
	elementChildOrderChanged: boolean,
	context: StructuralMergeContext,
): void {
	for (const child of Array.from(target.childNodes).filter((node) => isStructuralChildNode(target, node))) {
		if (keptChildren.has(child)) {
			continue;
		}
		if (child.nodeType === child.ELEMENT_NODE) {
			removeNodeIds(context.originalById, child);
			detachNode(child);
			continue;
		}
		if (shouldPreserveUnmatchedLexicalNodes(sourceHasLexicalNodes, context)) {
			continue;
		}
		if (sourceHasLexicalNodes || !elementChildOrderChanged) {
			detachNode(child);
		}
	}
}

export function reconcileStructuralChildren(target: XmlElement, source: XmlElement, context: StructuralMergeContext): void {
	const sourceChildren = Array.from(source.childNodes).filter((child) => isStructuralChildNode(source, child));
	const targetChildren = Array.from(target.childNodes).filter((child) => isStructuralChildNode(target, child));
	const sourceHasLexicalNodes = sourceChildren.some((child) => child.nodeType !== child.ELEMENT_NODE);
	const elementChildOrderChanged = didElementChildOrderChange(target, source);
	const targetChildrenByKey = createNodeBuckets(targetChildren, (child) => getStructuralNodeKey(target, child));
	const keptChildren = new Set<XmlNode>();
	const placements = sourceChildren.map((sourceChild) => {
		const placement = resolveStructuralTargetChild(target, sourceChild, targetChildrenByKey, context);
		keptChildren.add(placement.node);
		return placement;
	});

	placeNodes(target, placements, (child) => isStructuralChildNode(target, child));
	removeUnkeptStructuralChildren(target, keptChildren, sourceHasLexicalNodes, elementChildOrderChanged, context);
}
