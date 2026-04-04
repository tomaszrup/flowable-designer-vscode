import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer user-task undo flow', () => {
	test('supports undo and redo after a committed property rename', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'approveTask');
			const nameInput = frame.getByLabel('Name');
			await expect(nameInput).toBeVisible();
			const originalName = await nameInput.inputValue();
			const renamedTask = `Approve Request Undo ${testInfo.retry}-${Date.now()}`;

			await expect(frame.locator('#btn-undo')).toBeDisabled();
			await expect(frame.locator('#btn-redo')).toBeDisabled();

			await nameInput.fill(renamedTask);
			await nameInput.blur();

			await expect(nameInput).toHaveValue(renamedTask);
			await expect(frame.locator('#btn-undo')).toBeEnabled();
			await expect(frame.locator('#btn-redo')).toBeDisabled();

			await frame.locator('#btn-undo').click();
			await expect(nameInput).toHaveValue(originalName);
			await expect(frame.locator('#btn-redo')).toBeEnabled();

			await frame.locator('#btn-redo').click();
			await expect(nameInput).toHaveValue(renamedTask);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});