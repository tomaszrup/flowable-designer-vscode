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

export function createAnimationFrameScheduler(
	requestFrame: (callback: FrameRequestCallback) => number,
	cancelFrame: (handle: number) => void,
	callback: FrameRequestCallback,
): () => void {
	let pendingId: number | null = null;

	return () => {
		pendingId = replacePendingAnimationFrame(
			pendingId,
			requestFrame,
			cancelFrame,
			(frameTime) => {
				pendingId = null;
				callback(frameTime);
			},
		);
	};
}