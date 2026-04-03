import type {
	FlowableDataObject,
	FlowableDocumentState,
	FlowableEventListener,
	FlowableEventListenerImplType,
	FlowableLocalization,
	FlowableMessageDefinition,
	FlowableSignalDefinition,
} from '../flowable/types';
import { getProcessScopedGlobalIndex } from './processScoped';

interface DocumentActionCounters {
	signalDefinition: number;
	messageDefinition: number;
	eventListener: number;
	localization: number;
	dataObject: number;
}

interface DocumentActionDeps {
	getFlowableState: () => FlowableDocumentState;
	getKnownProcessIds: () => string[];
	queueMetadataSave: () => void;
	renderProperties: () => void;
	setStatus: (message: string, state?: 'idle' | 'error') => void;
	counters: DocumentActionCounters;
}

export interface DocumentActions {
	updateTargetNamespace: (value: string) => void;
	addSignalDefinition: () => void;
	updateSignalDefinition: (index: number, patch: Partial<FlowableSignalDefinition>) => void;
	removeSignalDefinition: (index: number) => void;
	addMessageDefinition: () => void;
	updateMessageDefinition: (index: number, patch: Partial<FlowableMessageDefinition>) => void;
	removeMessageDefinition: (index: number) => void;
	addEventListener: (processId: string) => void;
	updateEventListener: (processId: string, index: number, patch: Partial<FlowableEventListener>) => void;
	removeEventListener: (processId: string, index: number) => void;
	addLocalization: (processId: string) => void;
	updateLocalization: (processId: string, index: number, patch: Partial<FlowableLocalization>) => void;
	removeLocalization: (processId: string, index: number) => void;
	addDataObject: (processId: string) => void;
	updateDataObject: (processId: string, index: number, patch: Partial<FlowableDataObject>) => void;
	removeDataObject: (processId: string, index: number) => void;
}

export function createDocumentActions(deps: DocumentActionDeps): DocumentActions {
	function rerender(message?: string): void {
		deps.queueMetadataSave();
		if (message) {
			deps.setStatus(message);
		}
		deps.renderProperties();
	}

	function updateTargetNamespace(value: string): void {
		deps.getFlowableState().targetNamespace = value;
		deps.queueMetadataSave();
		deps.setStatus('Target namespace updated');
	}

	function addSignalDefinition(): void {
		deps.counters.signalDefinition += 1;
		deps.getFlowableState().signalDefinitions.push({
			id: `signal-${deps.counters.signalDefinition}`,
			name: '',
			scope: '',
		});
		rerender();
	}

	function updateSignalDefinition(index: number, patch: Partial<FlowableSignalDefinition>): void {
		const definition = deps.getFlowableState().signalDefinitions[index];
		if (!definition) {
			return;
		}
		Object.assign(definition, patch);
		rerender();
	}

	function removeSignalDefinition(index: number): void {
		deps.getFlowableState().signalDefinitions.splice(index, 1);
		rerender();
	}

	function addMessageDefinition(): void {
		deps.counters.messageDefinition += 1;
		deps.getFlowableState().messageDefinitions.push({
			id: `message-${deps.counters.messageDefinition}`,
			name: '',
		});
		rerender();
	}

	function updateMessageDefinition(index: number, patch: Partial<FlowableMessageDefinition>): void {
		const definition = deps.getFlowableState().messageDefinitions[index];
		if (!definition) {
			return;
		}
		Object.assign(definition, patch);
		rerender();
	}

	function removeMessageDefinition(index: number): void {
		deps.getFlowableState().messageDefinitions.splice(index, 1);
		rerender();
	}

	function addEventListener(processId: string): void {
		deps.counters.eventListener += 1;
		deps.getFlowableState().eventListeners.push({
			id: `event-listener-${deps.counters.eventListener}`,
			processId,
			events: '',
			implementationType: 'class' as FlowableEventListenerImplType,
			implementation: '',
			entityType: '',
		});
		rerender();
	}

	function updateEventListener(processId: string, index: number, patch: Partial<FlowableEventListener>): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().eventListeners, processId, index, deps.getKnownProcessIds());
		const listener = globalIndex === -1 ? undefined : deps.getFlowableState().eventListeners[globalIndex];
		if (!listener) {
			return;
		}
		Object.assign(listener, patch);
		rerender();
	}

	function removeEventListener(processId: string, index: number): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().eventListeners, processId, index, deps.getKnownProcessIds());
		if (globalIndex === -1) {
			return;
		}
		deps.getFlowableState().eventListeners.splice(globalIndex, 1);
		rerender();
	}

	function addLocalization(processId: string): void {
		deps.counters.localization += 1;
		deps.getFlowableState().localizations.push({
			id: `localization-${deps.counters.localization}`,
			processId,
			locale: '',
			name: '',
			description: '',
		});
		rerender();
	}

	function updateLocalization(processId: string, index: number, patch: Partial<FlowableLocalization>): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().localizations, processId, index, deps.getKnownProcessIds());
		const localization = globalIndex === -1 ? undefined : deps.getFlowableState().localizations[globalIndex];
		if (!localization) {
			return;
		}
		Object.assign(localization, patch);
		rerender();
	}

	function removeLocalization(processId: string, index: number): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().localizations, processId, index, deps.getKnownProcessIds());
		if (globalIndex === -1) {
			return;
		}
		deps.getFlowableState().localizations.splice(globalIndex, 1);
		rerender();
	}

	function addDataObject(processId: string): void {
		deps.counters.dataObject += 1;
		deps.getFlowableState().dataObjects.push({
			id: `data-object-${deps.counters.dataObject}`,
			processId,
			name: '',
			itemSubjectRef: 'xsd:string',
			defaultValue: '',
		});
		rerender();
	}

	function updateDataObject(processId: string, index: number, patch: Partial<FlowableDataObject>): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().dataObjects, processId, index, deps.getKnownProcessIds());
		if (globalIndex === -1) {
			return;
		}
		deps.getFlowableState().dataObjects[globalIndex] = {
			...deps.getFlowableState().dataObjects[globalIndex],
			...patch,
		};
		rerender();
	}

	function removeDataObject(processId: string, index: number): void {
		const globalIndex = getProcessScopedGlobalIndex(deps.getFlowableState().dataObjects, processId, index, deps.getKnownProcessIds());
		if (globalIndex === -1) {
			return;
		}
		deps.getFlowableState().dataObjects.splice(globalIndex, 1);
		rerender();
	}

	return {
		updateTargetNamespace,
		addSignalDefinition,
		updateSignalDefinition,
		removeSignalDefinition,
		addMessageDefinition,
		updateMessageDefinition,
		removeMessageDefinition,
		addEventListener,
		updateEventListener,
		removeEventListener,
		addLocalization,
		updateLocalization,
		removeLocalization,
		addDataObject,
		updateDataObject,
		removeDataObject,
	};
}