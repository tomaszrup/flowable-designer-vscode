import type { FlowableElementState } from '../flowable/types';
import {
	getElementId,
	isExternalWorkerTask,
	isHttpTask,
	isMailTask,
	isScriptTask,
	isShellTask,
	type BpmnElement,
} from './bpmnTypeGuards';
import { parseFileReferences } from '../shared/fileReferences';
import type { PropertyRenderDeps, SharedCollectionRenderers } from './propertyRenderingTypes';

function toLabel(fieldName: string): string {
	return fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function renderMailTaskProperties(renderers: SharedCollectionRenderers, ui: PropertyRenderDeps['ui'], properties: HTMLElement, elementState: FlowableElementState): void {
	const mailGroup = ui.createGroup('Mail Task');
	for (const fieldName of ['to', 'from', 'subject', 'cc', 'bcc', 'charset'] as const) {
		renderers.renderMailField(mailGroup, elementState, fieldName, fieldName.charAt(0).toUpperCase() + fieldName.slice(1));
	}
	renderers.renderMailField(mailGroup, elementState, 'html', 'Html', true);
	renderers.renderMailField(mailGroup, elementState, 'text', 'Non-html text', true);
	properties.appendChild(mailGroup);
}

function renderHttpTaskProperties(renderers: SharedCollectionRenderers, ui: PropertyRenderDeps['ui'], properties: HTMLElement, elementState: FlowableElementState): void {
	const httpGroup = ui.createGroup('Http Task');
	for (const fieldName of ['requestMethod', 'requestUrl', 'requestHeaders', 'requestTimeout', 'failStatusCodes', 'handleStatusCodes', 'resultVariablePrefix'] as const) {
		renderers.renderTextFieldExtension(httpGroup, elementState, fieldName, toLabel(fieldName));
	}
	renderers.renderTextFieldExtension(httpGroup, elementState, 'requestBody', 'Request Body', true);
	for (const fieldName of ['disallowRedirects', 'ignoreException', 'saveRequestVariables', 'saveResponseParameters'] as const) {
		renderers.renderBooleanFieldExtension(httpGroup, elementState, fieldName, toLabel(fieldName));
	}
	properties.appendChild(httpGroup);
}

function renderShellTaskProperties(renderers: SharedCollectionRenderers, ui: PropertyRenderDeps['ui'], properties: HTMLElement, elementState: FlowableElementState): void {
	const shellGroup = ui.createGroup('Shell Task');
	for (const fieldName of ['command', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5', 'outputVariable', 'errorCodeVariable', 'directory'] as const) {
		renderers.renderTextFieldExtension(shellGroup, elementState, fieldName, toLabel(fieldName));
	}
	for (const fieldName of ['wait', 'redirectError', 'cleanEnv'] as const) {
		renderers.renderBooleanFieldExtension(shellGroup, elementState, fieldName, toLabel(fieldName));
	}
	properties.appendChild(shellGroup);
}

function renderScriptTaskProperties(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;
	const businessObject = selectedElement.businessObject as { scriptFormat?: string };
	const scriptFormatOptions = ['javascript', 'groovy'];
	if (businessObject.scriptFormat && !scriptFormatOptions.includes(businessObject.scriptFormat)) {
		scriptFormatOptions.unshift(businessObject.scriptFormat);
	}
	const scriptGroup = ui.createGroup('Script Task');
	scriptGroup.appendChild(ui.createField('Script Format', ui.createSelect(scriptFormatOptions, businessObject.scriptFormat || 'javascript', (value) => {
		deps.modeling.updateProperties(selectedElement, { scriptFormat: value });
		deps.queueMetadataSave();
	})));
	const fileRefsContainer = document.createElement('div');
	const scriptTextArea = ui.createTextArea(elementState.script, (value) => {
		deps.actions.updateScript(value);
		const refs = parseFileReferences(value);
		fileRefsContainer.innerHTML = '';
		if (refs.length > 0) {
			fileRefsContainer.appendChild(ui.renderFileReferences(refs));
		}
	}, 'Enter script code...');
	scriptGroup.appendChild(ui.createField('Script', scriptTextArea));
	const browseButton = document.createElement('button');
	browseButton.type = 'button';
	browseButton.className = 'file-browse-btn';
	browseButton.textContent = 'Insert File Reference\u2026';
	browseButton.title = 'Select a file to insert as @path@ reference';
	browseButton.addEventListener('click', () => {
		deps.postMessage({ type: 'pick-file' });
		deps.setPendingFilePick(scriptTextArea, getElementId(selectedElement));
	});
	scriptGroup.appendChild(browseButton);
	const initialRefs = parseFileReferences(elementState.script);
	if (initialRefs.length > 0) {
		fileRefsContainer.appendChild(ui.renderFileReferences(initialRefs));
	}
	scriptGroup.appendChild(fileRefsContainer);
	properties.appendChild(scriptGroup);
}

export function renderSpecializedTaskProperties(
	deps: PropertyRenderDeps,
	renderers: SharedCollectionRenderers,
	properties: HTMLElement,
	selectedElement: BpmnElement,
	elementState: FlowableElementState,
): void {
	const { ui } = deps;

	if (isMailTask(selectedElement)) {
		renderMailTaskProperties(renderers, ui, properties, elementState);
	}

	if (isHttpTask(selectedElement)) {
		renderHttpTaskProperties(renderers, ui, properties, elementState);
	}

	if (isShellTask(selectedElement)) {
		renderShellTaskProperties(renderers, ui, properties, elementState);
	}

	if (isExternalWorkerTask(selectedElement)) {
		const externalWorkerGroup = ui.createGroup('External Worker Task');
		renderers.renderTextFieldExtension(externalWorkerGroup, elementState, 'topic', 'Topic');
		properties.appendChild(externalWorkerGroup);
	}

	if (isScriptTask(selectedElement)) {
		renderScriptTaskProperties(deps, properties, selectedElement, elementState);
	}
}