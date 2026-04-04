import { expect, test } from './e2eTest';
import { openBpmnFixture } from './vscodeWorkbench';

test.describe('Flowable BPMN designer user-task smoke flow', () => {
	test('opens a BPMN fixture in the custom editor', async ({ page, workbenchBaseUrl }) => {
		const frame = await openBpmnFixture(page, 'legacy-user-task.bpmn', workbenchBaseUrl);

		await expect(frame.getByText('Flowable BPMN Designer')).toBeVisible();
		await expect(frame.locator('#status')).toHaveText('Diagram synchronized');
		await expect(frame.locator('#canvas')).toBeVisible();
		await expect(frame.locator('#properties')).toBeVisible();
		await expect(frame.locator('#btn-undo')).toBeVisible();
		await expect(frame.locator('#btn-redo')).toBeVisible();
		await expect(frame.locator('#btn-view-source')).toBeVisible();
		await expect(page.getByRole('tab', { name: /^legacy-user-task\.bpmn$/i })).toHaveCount(1);
	});
});