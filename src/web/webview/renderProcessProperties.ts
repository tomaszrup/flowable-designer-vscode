import type { FlowableElementState } from '../flowable/types';
import { isProcess, type BpmnElement } from './bpmnTypeGuards';
import { getProcessScopedItems } from './processScoped';
import type { PropertyRenderDeps, SharedCollectionRenderers } from './propertyRenderingTypes';

const processAttributes = ['candidateStarterUsers', 'candidateStarterGroups'] as const;

export function renderProcessProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	if (!isProcess(selectedElement)) {
		return;
	}

	const processId = selectedElement.id;
	const { ui } = deps;
	const flowableState = deps.getFlowableState();
	const knownProcessIds = deps.getKnownProcessIds();

	const namespaceGroup = ui.createGroup('Process Namespace');
	namespaceGroup.appendChild(ui.createField('Target Namespace', ui.createTextInput(flowableState.targetNamespace, (value) => deps.actions.updateTargetNamespace(value), 'e.g. http://www.flowable.org/processdef')));
	properties.appendChild(namespaceGroup);
	properties.appendChild(renderers.renderAttributeGroup('Process', [...processAttributes], elementState));

	const signalGroup = ui.createGroup('Signal Definitions');
	flowableState.signalDefinitions.forEach((signalDefinition, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		deps.makeDraggableItem(item, index, flowableState.signalDefinitions, 'signal-defs', () => {
			deps.queueMetadataSave();
			deps.renderProperties();
		});
		item.appendChild(ui.createField('ID', ui.createTextInput(signalDefinition.id, (value) => deps.actions.updateSignalDefinition(index, { id: value }))));
		item.appendChild(ui.createField('Name', ui.createTextInput(signalDefinition.name, (value) => deps.actions.updateSignalDefinition(index, { name: value }))));
		item.appendChild(ui.createField('Scope', ui.createSelect(['', 'global', 'processInstance'], signalDefinition.scope || '', (value) => deps.actions.updateSignalDefinition(index, { scope: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Signal';
		removeButton.addEventListener('click', () => deps.actions.removeSignalDefinition(index));
		item.appendChild(removeButton);
		signalGroup.appendChild(item);
	});
	const signalActions = document.createElement('div');
	signalActions.className = 'properties-actions';
	const addSignalButton = document.createElement('button');
	addSignalButton.type = 'button';
	addSignalButton.textContent = 'Add Signal';
	addSignalButton.addEventListener('click', deps.actions.addSignalDefinition);
	signalActions.appendChild(addSignalButton);
	signalGroup.appendChild(signalActions);
	properties.appendChild(signalGroup);

	const messageGroup = ui.createGroup('Message Definitions');
	flowableState.messageDefinitions.forEach((messageDefinition, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		deps.makeDraggableItem(item, index, flowableState.messageDefinitions, 'message-defs', () => {
			deps.queueMetadataSave();
			deps.renderProperties();
		});
		item.appendChild(ui.createField('ID', ui.createTextInput(messageDefinition.id, (value) => deps.actions.updateMessageDefinition(index, { id: value }))));
		item.appendChild(ui.createField('Name', ui.createTextInput(messageDefinition.name, (value) => deps.actions.updateMessageDefinition(index, { name: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Message';
		removeButton.addEventListener('click', () => deps.actions.removeMessageDefinition(index));
		item.appendChild(removeButton);
		messageGroup.appendChild(item);
	});
	const messageActions = document.createElement('div');
	messageActions.className = 'properties-actions';
	const addMessageButton = document.createElement('button');
	addMessageButton.type = 'button';
	addMessageButton.textContent = 'Add Message';
	addMessageButton.addEventListener('click', deps.actions.addMessageDefinition);
	messageActions.appendChild(addMessageButton);
	messageGroup.appendChild(messageActions);
	properties.appendChild(messageGroup);

	const eventListenersGroup = ui.createGroup('Event Listeners');
	const implementationTypes = renderers.renderProcessEventListenerTypeOptions();
	getProcessScopedItems(flowableState.eventListeners, processId, knownProcessIds).forEach((listener, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		deps.makeProcessScopedDraggableItem(item, index, flowableState.eventListeners, processId, knownProcessIds, 'event-listeners', () => {
			deps.queueMetadataSave();
			deps.renderProperties();
		});
		item.appendChild(ui.createField('Events', ui.createTextInput(listener.events, (value) => deps.actions.updateEventListener(processId, index, { events: value }))));
		item.appendChild(ui.createField('Implementation Type', ui.createSelect(implementationTypes, listener.implementationType, (value) => deps.actions.updateEventListener(processId, index, { implementationType: value as typeof listener.implementationType }))));
		item.appendChild(ui.createField('Implementation', ui.createTextInput(listener.implementation, (value) => deps.actions.updateEventListener(processId, index, { implementation: value }))));
		item.appendChild(ui.createField('Entity Type', ui.createTextInput(listener.entityType, (value) => deps.actions.updateEventListener(processId, index, { entityType: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Event Listener';
		removeButton.addEventListener('click', () => deps.actions.removeEventListener(processId, index));
		item.appendChild(removeButton);
		eventListenersGroup.appendChild(item);
	});
	const eventActions = document.createElement('div');
	eventActions.className = 'properties-actions';
	const addEventListenerButton = document.createElement('button');
	addEventListenerButton.type = 'button';
	addEventListenerButton.textContent = 'Add Event Listener';
	addEventListenerButton.addEventListener('click', () => deps.actions.addEventListener(processId));
	eventActions.appendChild(addEventListenerButton);
	eventListenersGroup.appendChild(eventActions);
	properties.appendChild(eventListenersGroup);

	const localizationGroup = ui.createGroup('Localizations');
	getProcessScopedItems(flowableState.localizations, processId, knownProcessIds).forEach((localization, index) => {
		const item = document.createElement('div');
		item.className = 'field-array-item';
		deps.makeProcessScopedDraggableItem(item, index, flowableState.localizations, processId, knownProcessIds, 'localizations', () => {
			deps.queueMetadataSave();
			deps.renderProperties();
		});
		item.appendChild(ui.createField('Locale', ui.createTextInput(localization.locale, (value) => deps.actions.updateLocalization(processId, index, { locale: value }))));
		item.appendChild(ui.createField('Name', ui.createTextInput(localization.name, (value) => deps.actions.updateLocalization(processId, index, { name: value }))));
		item.appendChild(ui.createField('Description', ui.createTextArea(localization.description, (value) => deps.actions.updateLocalization(processId, index, { description: value }))));
		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'btn-remove';
		removeButton.textContent = 'Remove Localization';
		removeButton.addEventListener('click', () => deps.actions.removeLocalization(processId, index));
		item.appendChild(removeButton);
		localizationGroup.appendChild(item);
	});
	const localizationActions = document.createElement('div');
	localizationActions.className = 'properties-actions';
	const addLocalizationButton = document.createElement('button');
	addLocalizationButton.type = 'button';
	addLocalizationButton.textContent = 'Add Localization';
	addLocalizationButton.addEventListener('click', () => deps.actions.addLocalization(processId));
	localizationActions.appendChild(addLocalizationButton);
	localizationGroup.appendChild(localizationActions);
	properties.appendChild(localizationGroup);

	const dataGroup = ui.createGroup('Data Objects');
	getProcessScopedItems(flowableState.dataObjects, processId, knownProcessIds).forEach((dataObject, index) => {
		renderers.renderProcessDataObject(dataGroup, processId, dataObject, index);
	});
	const dataActions = document.createElement('div');
	dataActions.className = 'properties-actions';
	const addDataButton = document.createElement('button');
	addDataButton.type = 'button';
	addDataButton.textContent = 'Add Data Object';
	addDataButton.addEventListener('click', () => deps.actions.addDataObject(processId));
	dataActions.appendChild(addDataButton);
	dataGroup.appendChild(dataActions);
	properties.appendChild(dataGroup);
}