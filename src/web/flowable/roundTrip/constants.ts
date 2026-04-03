export const ACTIVITI_NAMESPACE = 'http://activiti.org/bpmn';
export const BPMN_MODEL_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
export const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
export const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';

export const managedExtensionChildNames = new Set([
	'field',
	'in',
	'out',
	'taskListener',
	'executionListener',
	'formProperty',
	'failedJobRetryTimeCycle',
	'mapException',
	'eventListener',
	'localization',
]);

export const processPreFlowChildNames = new Set([
	'documentation',
	'extensionElements',
	'auditing',
	'monitoring',
	'property',
	'laneSet',
]);