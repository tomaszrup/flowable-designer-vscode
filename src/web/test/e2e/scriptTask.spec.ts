import { expect, test } from './e2eTest';
import { openBpmnFixture, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer script-task flows', () => {
	test('opens a referenced workspace file from script task properties', async ({ page, workbenchBaseUrl }) => {
		const frame = await openBpmnFixture(page, 'legacy-script-task.bpmn', workbenchBaseUrl);

		await selectBpmnShape(frame, 'scripttask1');
		const scriptInput = frame.getByRole('textbox', { name: 'Script' });
		await expect(scriptInput).toBeVisible();
		await scriptInput.fill('def result = 10 + 20\nload("@README.md@")');
		await scriptInput.blur();

		const fileReferenceLink = frame.getByRole('link', { name: /README\.md/i });
		await expect(fileReferenceLink).toBeVisible();
		await fileReferenceLink.click();

		await expect.poll(async () => {
			return await page.locator('body').innerText();
		}, {
			message: 'Expected the referenced workspace file to open in the editor.',
			timeout: 20_000,
		}).toContain('README.md');
		await expect.poll(async () => {
			return await page.locator('body').innerText();
		}, {
			message: 'Expected the README contents to be visible after opening the file reference.',
			timeout: 20_000,
		}).toContain('# Flowable Designer VS Code');
	});
});