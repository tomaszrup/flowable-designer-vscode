import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer user-task source flow', () => {
	test('updates a user task assignee and exposes the serialized XML in source view', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			const assignee = `playwright-user-${testInfo.retry}-${Date.now()}`;

			await selectBpmnShape(frame, 'approveTask');
			const assigneeInput = frame.getByLabel('Assignee');
			await expect(assigneeInput).toBeVisible();
			await assigneeInput.fill(assignee);
			await expect(assigneeInput).toHaveValue(assignee);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to show the updated assignee attribute.',
				timeout: 20_000,
			}).toContain(`activiti:assignee="${assignee}"`);

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});