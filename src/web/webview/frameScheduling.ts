export function replacePendingAnimationFrame(
	currentId: number | null,
	requestFrame: (callback: FrameRequestCallback) => number,
	cancelFrame: (handle: number) => void,
	callback: FrameRequestCallback,
): number {
	if (currentId !== null) {
		cancelFrame(currentId);
	}

	return requestFrame(callback);
}