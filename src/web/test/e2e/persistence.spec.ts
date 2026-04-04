import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openBpmnFixtureInCurrentWorkbench, openSourceView, runWorkbenchCommand, saveActiveEditor, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer persistence flows', () => {
	test('preserves edited user-task properties after closing and reopening the designer', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			let frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			const updatedName = `Approve Request Persisted ${testInfo.retry}-${Date.now()}`;
			const updatedAssignee = `persisted-assignee-${testInfo.retry}-${Date.now()}`;

			await selectBpmnShape(frame, 'approveTask');
			const nameInput = frame.getByLabel('Name');
			const assigneeInput = frame.getByLabel('Assignee');
			await expect(nameInput).toBeVisible();
			await expect(assigneeInput).toBeVisible();

			await nameInput.fill(updatedName);
			await nameInput.blur();
			await assigneeInput.fill(updatedAssignee);
			await assigneeInput.blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await saveActiveEditor(page);

			await runWorkbenchCommand(page, 'View: Close Editor');

			frame = await openBpmnFixtureInCurrentWorkbench(page, fixtureFileName);
			await selectBpmnShape(frame, 'approveTask');

			await expect(frame.getByLabel('Name')).toHaveValue(updatedName);
			await expect(frame.getByLabel('Assignee')).toHaveValue(updatedAssignee);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the reopened source editor to show the persisted assignee and task name.',
				timeout: 20_000,
			}).toContain(`activiti:assignee="${updatedAssignee}"`);
			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the reopened source editor to show the persisted task name.',
				timeout: 20_000,
			}).toContain(`name="${updatedName}"`);

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});