import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { escapeRegex, openBpmnFixture, runWorkbenchCommand } from './vscodeWorkbench';

test.describe('Flowable BPMN designer user-task export flow', () => {
	test('exports the current diagram as an SVG file', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		const svgFileName = fixtureFileName.replace(/\.bpmn$/i, '.svg');
		try {
			await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await runWorkbenchCommand(page, 'Flowable BPMN Designer: Export Diagram Image');
			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the export command to report the generated SVG file.',
				timeout: 20_000,
			}).toContain(`Diagram exported to ${svgFileName}`);

			const svgTreeItem = page.getByRole('treeitem', { name: new RegExp(`^${escapeRegex(svgFileName)}$`, 'i') }).first();
			await expect(svgTreeItem).toBeVisible();
			await svgTreeItem.dblclick();
			await expect(page.getByRole('tab', { name: new RegExp(`^${escapeRegex(svgFileName)}$`, 'i') })).toBeVisible();

			await expect.poll(async () => {
				return await page.locator('body').innerText();
			}, {
				message: 'Expected the exported SVG to open in the image preview.',
				timeout: 20_000,
			}).toContain('Whole Image');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});