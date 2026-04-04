import { getBusinessObject, getElementId, getElementType, type BpmnElement } from './bpmnTypeGuards';
import type { PropertyRenderDeps } from './propertyRenderingTypes';
import { createSharedCollectionRenderers } from './sharedCollectionRenderers';
import { renderEventAndMiscProperties } from './renderEventAndMiscProperties';
import { renderProcessProperties } from './renderProcessProperties';
import { renderSpecializedTaskProperties } from './renderSpecializedTaskProperties';
import { renderTaskProperties } from './renderTaskProperties';
import { validateId } from './validators';

export function renderPropertiesPanel(
	deps: PropertyRenderDeps,
	properties: HTMLElement,
	propertySearch: HTMLInputElement,
	sidebarEl: HTMLElement | null,
	savedSidebarScroll: number,
	selectedElement: BpmnElement | null,
): void {
	const scrollTop = savedSidebarScroll;
	const prevHeight = properties.offsetHeight;
	properties.style.minHeight = `${prevHeight}px`;
	properties.replaceChildren();

	if (!selectedElement) {
		const message = document.createElement('p');
		message.textContent = 'Select a BPMN element to edit Flowable-specific properties.';
		properties.appendChild(message);
		return;
	}

	const { ui } = deps;
	const renderers = createSharedCollectionRenderers(deps);
	const businessObject = getBusinessObject(selectedElement);
	const generalGroup = ui.createGroup('General');
	const typeInput = ui.createTextInput(getElementType(selectedElement), () => {});
	typeInput.readOnly = true;
	generalGroup.appendChild(ui.createField('Type', typeInput));
	generalGroup.appendChild(ui.createField('ID', ui.createTextInput(getElementId(selectedElement), (value) => deps.actions.updateGeneralProperty('id', value), undefined, validateId)));
	generalGroup.appendChild(ui.createField('Name', ui.createTextInput(typeof businessObject.name === 'string' ? businessObject.name : '', (value) => deps.actions.updateGeneralProperty('name', value))));
	properties.appendChild(generalGroup);

	const elementState = deps.ensureElementState(selectedElement);
	const documentationGroup = ui.createGroup('Documentation');
	documentationGroup.appendChild(ui.createField('Documentation', ui.createTextArea(elementState.documentation, (value) => deps.actions.updateDocumentation(value), 'Enter element documentation...')));
	properties.appendChild(documentationGroup);

	renderProcessProperties(deps, renderers, properties, selectedElement, elementState);
	renderTaskProperties(deps, renderers, properties, selectedElement, elementState);
	renderSpecializedTaskProperties(deps, renderers, properties, selectedElement, elementState);
	renderEventAndMiscProperties(deps, renderers, properties, selectedElement, elementState);

	properties.style.minHeight = '';
	if (sidebarEl) {
		sidebarEl.scrollTop = scrollTop;
	}

	const normalizedQuery = propertySearch.value.toLowerCase().trim();
	for (const group of Array.from(properties.querySelectorAll('.property-group'))) {
		if (!normalizedQuery) {
			group.classList.remove('search-hidden');
			continue;
		}
		const text = group.textContent?.toLowerCase() || '';
		group.classList.toggle('search-hidden', !text.includes(normalizedQuery));
	}
}