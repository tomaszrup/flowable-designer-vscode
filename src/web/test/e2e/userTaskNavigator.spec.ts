import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { escapeRegex, openBpmnFixture, openProcessNavigator, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer user-task navigator flow', () => {
	test('refreshes the Process Navigator after renaming a task', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'approveTask');
			const nameInput = frame.getByLabel('Name');
			const renamedTask = `Approve Request Navigator ${testInfo.retry}-${Date.now()}`;
			await expect(nameInput).toBeVisible();
			await nameInput.fill(renamedTask);
			await nameInput.blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openProcessNavigator(page);
			await expect(page.getByRole('treeitem', {
				name: new RegExp(`user Task: ${escapeRegex(renamedTask)}`, 'i'),
			})).toBeVisible();
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});