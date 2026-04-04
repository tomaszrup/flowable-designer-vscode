import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { getSidebarScrollMetrics, openBpmnFixture, selectBpmnShape, setSidebarScrollTop } from './vscodeWorkbench';

test.describe('Flowable BPMN designer properties panel flows', () => {
	test('preserves properties sidebar scroll position during rerenders', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-listeners-formprops.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'reviewTask');
			const assigneeInput = frame.getByRole('region', { name: 'User Task' }).getByLabel('Assignee');
			await expect(assigneeInput).toBeVisible();

			const initialMetrics = await getSidebarScrollMetrics(frame);
			expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight + 80);

			await setSidebarScrollTop(frame, initialMetrics.scrollHeight);
			await expect.poll(async () => {
				return (await getSidebarScrollMetrics(frame)).scrollTop;
			}, {
				message: 'Expected the properties sidebar to scroll far enough for the lower task-listener controls.',
				timeout: 10_000,
			}).toBeGreaterThan(150);

			const beforeEditScrollTop = (await getSidebarScrollMetrics(frame)).scrollTop;
			const listenerImplementationInput = frame.getByRole('region', { name: 'Task Listeners' }).getByRole('textbox', { name: 'Implementation' });
			const updatedImplementation = '${taskCreateListenerScrollPreserved}';
			await expect(listenerImplementationInput).toBeVisible();
			await listenerImplementationInput.fill(updatedImplementation);
			await listenerImplementationInput.blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await expect.poll(async () => {
				const { scrollTop } = await getSidebarScrollMetrics(frame);
				return Math.abs(scrollTop - beforeEditScrollTop) <= 24;
			}, {
				message: 'Expected the properties sidebar scroll position to stay stable after a rerender.',
				timeout: 20_000,
			}).toBe(true);

			await expect(listenerImplementationInput).toBeVisible();
			await expect(listenerImplementationInput).toHaveValue(updatedImplementation);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});