import { describe, expect, it, vi } from 'vitest';
import { createAnimationFrameScheduler, replacePendingAnimationFrame } from '../../webview/frameScheduling';

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

	it('coalesces repeated render requests into the latest animation frame', () => {
		const callbacks: FrameRequestCallback[] = [];
		const cancelFrame = vi.fn();
		const requestFrame = vi.fn((callback: FrameRequestCallback) => {
			callbacks.push(callback);
			return callbacks.length;
		});
		const render = vi.fn();

		const schedule = createAnimationFrameScheduler(requestFrame, cancelFrame, render);

		schedule();
		schedule();

		expect(requestFrame).toHaveBeenCalledTimes(2);
		expect(cancelFrame).toHaveBeenCalledWith(1);
		expect(render).not.toHaveBeenCalled();

		callbacks[1](16);

		expect(render).toHaveBeenCalledTimes(1);
		expect(render).toHaveBeenCalledWith(16);

		schedule();

		expect(requestFrame).toHaveBeenCalledTimes(3);
	});
});