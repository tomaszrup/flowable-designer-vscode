import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer collection editor flows', () => {
	test('adds a user-task form property and task listener and persists them to XML', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-listeners-formprops.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'reviewTask');

			const formPropertiesGroup = frame.getByRole('region', { name: 'Form Properties' });
			const initialFormPropertyCount = await formPropertiesGroup.locator('.field-array-item').count();
			await formPropertiesGroup.getByRole('button', { name: 'Add Form Property' }).click();
			await expect(formPropertiesGroup.locator('.field-array-item')).toHaveCount(initialFormPropertyCount + 1);

			const addedFormProperty = formPropertiesGroup.locator('.field-array-item').nth(initialFormPropertyCount);
			await addedFormProperty.getByLabel('ID').fill('escalationReason');
			await addedFormProperty.getByLabel('Name').fill('Escalation Reason');
			await addedFormProperty.getByLabel('Default').fill('none');
			await addedFormProperty.getByLabel('Default').blur();

			const taskListenersGroup = frame.getByRole('region', { name: 'Task Listeners' });
			const initialTaskListenerCount = await taskListenersGroup.locator('.field-array-item').count();
			await taskListenersGroup.getByRole('button', { name: 'Add Task Listener' }).click();
			await expect(taskListenersGroup.locator('.field-array-item')).toHaveCount(initialTaskListenerCount + 1);

			const addedTaskListener = taskListenersGroup.locator('.field-array-item').nth(initialTaskListenerCount);
			await addedTaskListener.getByLabel('Event').selectOption('complete');
			await addedTaskListener.getByLabel('Implementation Type').selectOption('class');
			await addedTaskListener.getByRole('textbox', { name: 'Implementation' }).fill('com.example.ReviewCompleteListener');
			await addedTaskListener.getByRole('textbox', { name: 'Implementation' }).blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the added form property and task listener.',
				timeout: 20_000,
			}).toMatch(/formProperty\s+id="escalationReason"[\s\S]*default="none"/i);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the added complete task listener implementation.',
				timeout: 20_000,
			}).toMatch(/taskListener[\s\S]*event="complete"[\s\S]*ReviewCompleteListener/i);

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('adds and removes a service-task field extension in serialized XML', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-service-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'servicetask1');

			const fieldExtensionsGroup = frame.getByRole('region', { name: 'Field Extensions' });
			const initialFieldExtensionCount = await fieldExtensionsGroup.locator('.field-array-item').count();
			await fieldExtensionsGroup.getByRole('button', { name: 'Add Field Extension' }).click();
			await expect(fieldExtensionsGroup.locator('.field-array-item')).toHaveCount(initialFieldExtensionCount + 1);

			const addedFieldExtension = fieldExtensionsGroup.locator('.field-array-item').nth(initialFieldExtensionCount);
			await addedFieldExtension.getByLabel('Name').fill('tenantId');
			await addedFieldExtension.getByRole('textbox', { name: 'Value' }).fill('acme');
			await addedFieldExtension.getByRole('textbox', { name: 'Value' }).blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the added field extension.',
				timeout: 20_000,
			}).toMatch(/field\s+name="tenantId"[\s\S]*acme/i);
			await page.keyboard.press('Control+W');

			const removableFieldExtension = fieldExtensionsGroup.locator('.field-array-item').nth(initialFieldExtensionCount);
			await removableFieldExtension.getByRole('button', { name: 'Remove Field Extension' }).click();
			await expect(fieldExtensionsGroup.locator('.field-array-item')).toHaveCount(initialFieldExtensionCount);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the removed field extension to disappear from the source editor.',
				timeout: 20_000,
			}).not.toContain('tenantId');
			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});