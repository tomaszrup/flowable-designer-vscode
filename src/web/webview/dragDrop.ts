import { reorderProcessScopedItems } from './processScoped';

export function makeDraggableItem<T>(
	item: HTMLDivElement,
	index: number,
	array: T[],
	collectionId: string,
	onReorder: () => void,
): void {
	const handle = document.createElement('span');
	handle.className = 'drag-handle';
	handle.textContent = '\u2630';
	handle.title = 'Drag to reorder';
	handle.setAttribute('aria-label', 'Drag to reorder');
	item.draggable = true;
	item.insertBefore(handle, item.firstChild);

	const mimeType = `application/x-collection-${collectionId}`;

	item.addEventListener('dragstart', (event: DragEvent) => {
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData(mimeType, String(index));
		}
		item.classList.add('dragging');
	});

	item.addEventListener('dragend', () => item.classList.remove('dragging'));

	item.addEventListener('dragover', (event: DragEvent) => {
		if (!event.dataTransfer?.types.includes(mimeType)) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		item.classList.add('drag-over');
	});

	item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

	item.addEventListener('drop', (event: DragEvent) => {
		if (!event.dataTransfer?.types.includes(mimeType)) {
			return;
		}
		event.preventDefault();
		item.classList.remove('drag-over');
		const fromIndex = Number(event.dataTransfer.getData(mimeType));
		const toIndex = index;
		if (Number.isNaN(fromIndex) || fromIndex === toIndex || fromIndex < 0 || fromIndex >= array.length) {
			return;
		}
		const [moved] = array.splice(fromIndex, 1);
		array.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved);
		onReorder();
	});
}

export function makeProcessScopedDraggableItem<T extends { processId?: string }>(
	item: HTMLDivElement,
	index: number,
	array: T[],
	processId: string,
	knownProcessIds: string[],
	collectionId: string,
	onReorder: () => void,
): void {
	const handle = document.createElement('span');
	handle.className = 'drag-handle';
	handle.textContent = '\u2630';
	handle.title = 'Drag to reorder';
	handle.setAttribute('aria-label', 'Drag to reorder');
	item.draggable = true;
	item.insertBefore(handle, item.firstChild);

	const mimeType = `application/x-collection-${collectionId}`;

	item.addEventListener('dragstart', (event: DragEvent) => {
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData(mimeType, String(index));
		}
		item.classList.add('dragging');
	});

	item.addEventListener('dragend', () => item.classList.remove('dragging'));

	item.addEventListener('dragover', (event: DragEvent) => {
		if (!event.dataTransfer?.types.includes(mimeType)) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		item.classList.add('drag-over');
	});

	item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

	item.addEventListener('drop', (event: DragEvent) => {
		if (!event.dataTransfer?.types.includes(mimeType)) {
			return;
		}
		event.preventDefault();
		item.classList.remove('drag-over');
		const fromIndex = Number(event.dataTransfer.getData(mimeType));
		const toIndex = index;
		const changed = reorderProcessScopedItems(array, processId, fromIndex, toIndex, knownProcessIds);
		if (!changed) {
			return;
		}
		onReorder();
	});
}