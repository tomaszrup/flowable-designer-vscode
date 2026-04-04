import type { FlowableDocumentState } from '../flowable/types';

export interface ActionCounters {
	field: number;
	listener: number;
	formProperty: number;
	ioParameter: number;
	dataObject: number;
	signalDefinition: number;
	messageDefinition: number;
	eventListener: number;
	localization: number;
}

function getMaxSuffix(ids: string[], prefixes: string[]): number {
	let maxSuffix = 0;

	for (const id of ids) {
		for (const prefix of prefixes) {
			const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
			if (!match) {
				continue;
			}

			maxSuffix = Math.max(maxSuffix, Number(match[1]));
		}
	}

	return maxSuffix;
}

export function syncActionCountersFromState(state: FlowableDocumentState, counters: ActionCounters): void {
	const allElementStates = Object.values(state.elements);

	counters.field = getMaxSuffix(
		allElementStates.flatMap((elementState) => elementState.fieldExtensions.map((fieldExtension) => fieldExtension.id)),
		['field-'],
	);
	counters.listener = getMaxSuffix(
		allElementStates.flatMap((elementState) => [
			...elementState.taskListeners.map((listener) => listener.id),
			...elementState.executionListeners.map((listener) => listener.id),
		]),
		['task-listener-', 'execution-listener-'],
	);
	counters.formProperty = getMaxSuffix(
		allElementStates.flatMap((elementState) => elementState.formProperties.map((formProperty) => formProperty.id)),
		['form-property-'],
	);
	counters.ioParameter = getMaxSuffix(
		allElementStates.flatMap((elementState) => [
			...elementState.inputParameters.map((parameter) => parameter.id),
			...elementState.outputParameters.map((parameter) => parameter.id),
		]),
		['io-param-'],
	);
	counters.dataObject = getMaxSuffix(state.dataObjects.map((dataObject) => dataObject.id), ['data-object-', 'dataObj-']);
	counters.signalDefinition = getMaxSuffix(state.signalDefinitions.map((signalDefinition) => signalDefinition.id), ['signal-']);
	counters.messageDefinition = getMaxSuffix(state.messageDefinitions.map((messageDefinition) => messageDefinition.id), ['message-']);
	counters.eventListener = getMaxSuffix(state.eventListeners.map((listener) => listener.id), ['event-listener-']);
	counters.localization = getMaxSuffix(state.localizations.map((localization) => localization.id), ['localization-']);
}