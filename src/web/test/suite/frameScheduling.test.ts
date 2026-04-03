import { describe, expect, it, vi } from 'vitest';
import { replacePendingAnimationFrame } from '../../webview/frameScheduling';

describe('frame scheduling helpers', () => {
	it('cancels the previous frame before scheduling a replacement', () => {
		const cancelFrame = vi.fn();
		const requestFrame = vi.fn().mockReturnValue(42);

		const nextId = replacePendingAnimationFrame(7, requestFrame, cancelFrame, () => 0);

		expect(cancelFrame).toHaveBeenCalledWith(7);
		expect(requestFrame).toHaveBeenCalledTimes(1);
		expect(nextId).toBe(42);
	});

	it('schedules immediately when there is no pending frame', () => {
		const cancelFrame = vi.fn();
		const requestFrame = vi.fn().mockReturnValue(11);

		const nextId = replacePendingAnimationFrame(null, requestFrame, cancelFrame, () => 0);

		expect(cancelFrame).not.toHaveBeenCalled();
		expect(requestFrame).toHaveBeenCalledTimes(1);
		expect(nextId).toBe(11);
	});
});