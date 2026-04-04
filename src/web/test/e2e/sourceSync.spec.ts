import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, replaceInActiveEditor, saveActiveEditor, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer source sync flows', () => {
	test('updates the designer after editing BPMN XML in source view', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			const updatedTaskName = `Approved From Source ${testInfo.retry}-${Date.now()}`;

			await openSourceView(page, frame);
			await replaceInActiveEditor(page, 'name="Approve Request"', `name="${updatedTaskName}"`);
			await saveActiveEditor(page);

			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the source editor to show the updated task name after saving.',
				timeout: 20_000,
			}).toContain(`name="${updatedTaskName}"`);

			await selectBpmnShape(frame, 'approveTask');
			await expect(frame.locator('#status')).toHaveText(/Diagram synchronized/, { timeout: 20_000 });
			await expect(frame.getByLabel('Name')).toHaveValue(updatedTaskName);

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});