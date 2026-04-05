import { describe, expect, test, vi } from 'vitest';
import { flushFocusedInput } from '../../webview/propertyUi';

function createMockContainer(focusedTag?: 'input' | 'textarea', withFlush = true): HTMLElement {
	const flushSpy = vi.fn();
	const focused = focusedTag ? { tagName: focusedTag.toUpperCase(), type: 'text', __flushPendingEdit: withFlush ? flushSpy : undefined } : null;
	const container = {
		querySelector: vi.fn().mockReturnValue(focused),
	} as unknown as HTMLElement;
	return Object.assign(container, { __testFlushSpy: flushSpy });
}

describe('flushFocusedInput', () => {
	test('calls __flushPendingEdit on a focused text input inside the container', () => {
		const container = createMockContainer('input');
		flushFocusedInput(container);
		expect((container as unknown as { __testFlushSpy: ReturnType<typeof vi.fn> }).__testFlushSpy).toHaveBeenCalledOnce();
	});

	test('calls __flushPendingEdit on a focused textarea inside the container', () => {
		const container = createMockContainer('textarea');
		flushFocusedInput(container);
		expect((container as unknown as { __testFlushSpy: ReturnType<typeof vi.fn> }).__testFlushSpy).toHaveBeenCalledOnce();
	});

	test('does nothing when no input is focused', () => {
		const container = createMockContainer();
		expect(() => flushFocusedInput(container)).not.toThrow();
		expect(container.querySelector).toHaveBeenCalledWith('input[type="text"]:focus, textarea:focus');
	});

	test('does nothing when focused input has no __flushPendingEdit', () => {
		const container = createMockContainer('input', false);
		expect(() => flushFocusedInput(container)).not.toThrow();
	});
});
