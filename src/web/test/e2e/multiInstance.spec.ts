import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer multi-instance flows', () => {
	test('updates user-task multi-instance settings and persists them to XML', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-multi-instance.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'reviewTask');

			const multiInstanceGroup = frame.getByRole('region', { name: 'Multi-Instance' });
			await expect(multiInstanceGroup.getByLabel('Sequential')).toBeChecked();

			const loopCardinalityInput = multiInstanceGroup.getByLabel('Loop Cardinality');
			const elementVariableInput = multiInstanceGroup.getByLabel('Element Variable');
			const completionConditionInput = multiInstanceGroup.getByLabel('Completion Condition');
			const sequentialCheckbox = multiInstanceGroup.getByLabel('Sequential');

			await loopCardinalityInput.fill('5');
			await loopCardinalityInput.blur();
			await expect(loopCardinalityInput).toHaveValue('5');

			await sequentialCheckbox.uncheck();
			await expect(sequentialCheckbox).not.toBeChecked();

			await elementVariableInput.fill('reviewer');
			await elementVariableInput.blur();
			await expect(elementVariableInput).toHaveValue('reviewer');

			await completionConditionInput.fill('${done}');
			await completionConditionInput.blur();
			await expect(completionConditionInput).toHaveValue('${done}');

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the updated loop cardinality and completion condition.',
				timeout: 20_000,
			}).toMatch(/loopCardinality>5<|loopCardinality>\s*5\s*</i);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the updated multi-instance sequential flag and element variable.',
				timeout: 20_000,
			}).toMatch(/isSequential="false"[\s\S]*elementVariable="reviewer"/i);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the source editor to contain the updated completion condition.',
				timeout: 20_000,
			}).toMatch(/completionCondition>\$\{done\}</i);

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('removes service-task multi-instance settings from XML', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-multi-instance.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'servicetask1');

			const multiInstanceGroup = frame.getByRole('region', { name: 'Multi-Instance' });
			await expect(multiInstanceGroup.getByLabel('Sequential')).not.toBeChecked();
			await multiInstanceGroup.getByRole('button', { name: 'Remove Multi-Instance' }).click();

			await expect(frame.locator('#status')).toHaveText(/Multi-instance removed|Diagram updated/);
			await expect(multiInstanceGroup.getByRole('button', { name: 'Add Multi-Instance' })).toBeVisible();

			await openSourceView(page, frame);
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the removed service-task multi-instance collection to disappear from XML.',
				timeout: 20_000,
			}).not.toContain('${recipients}');
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the removed service-task multi-instance element variable to disappear from XML.',
				timeout: 20_000,
			}).not.toContain('elementVariable="recipient"');

			await page.keyboard.press('Control+W');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});