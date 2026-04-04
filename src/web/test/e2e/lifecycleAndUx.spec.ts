import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { escapeRegex, openBpmnFixture, openBpmnFixtureInCurrentWorkbench, openProblemsPanel, runWorkbenchCommand, selectBpmnShape } from './vscodeWorkbench';

async function sidebarWidth(frame: { locator: (selector: string) => { evaluate<R>(pageFunction: (element: HTMLElement) => R): Promise<R> } }): Promise<number> {
	return await frame.locator('.sidebar').evaluate((element) => {
		return element.offsetWidth;
	});
}

test.describe('Flowable BPMN designer lifecycle and UX flows', () => {
	test('toggles source-view active state from the designer toolbar', async ({ page, workbenchBaseUrl }) => {
		const frame = await openBpmnFixture(page, 'legacy-user-task.bpmn', workbenchBaseUrl);

		await frame.getByRole('button', { name: 'View BPMN XML source' }).click();
		await expect(frame.locator('#btn-view-source')).toHaveClass(/active/);
		await expect.poll(async () => {
			return (await page.locator('body').innerText()).split('\u00a0').join(' ');
		}, { timeout: 20_000 }).toContain('<?xml version="1.0" encoding="UTF-8"?>');

		await frame.getByRole('button', { name: 'View BPMN XML source' }).click();
		await expect.poll(async () => {
			return await frame.locator('#btn-view-source').evaluate((element) => element.classList.contains('active'));
		}, { timeout: 20_000 }).toBe(false);
	});

	test('routes validation and export commands to the active BPMN tab', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const invalidFixture = await createIsolatedFixture(workerWorkspacePath, 'invalid-unassigned-user-task.bpmn', testInfo);
		const validFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			await openBpmnFixture(page, invalidFixture, workbenchBaseUrl);
			await openBpmnFixtureInCurrentWorkbench(page, validFixture);

			await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
			await expect.poll(async () => await page.locator('body').innerText(), {
				message: 'Expected validation to target the active valid designer tab first.',
				timeout: 20_000,
			}).toMatch(/BPMN validation passed [—-] no issues found\./);

			await page.getByRole('tab', { name: new RegExp(`^${escapeRegex(invalidFixture)}$`, 'i') }).click();
			await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
			await expect.poll(async () => await page.locator('body').innerText(), {
				message: 'Expected validation to switch to the active invalid designer tab.',
				timeout: 20_000,
			}).toContain('BPMN validation found 1 issue(s). See Problems panel.');
			await openProblemsPanel(page);
			await expect(page.getByRole('treeitem', {
				name: /User task 'reviewTask' has no assignee or candidate users\/groups/i,
			})).toBeVisible();

			await page.getByRole('tab', { name: new RegExp(`^${escapeRegex(validFixture)}$`, 'i') }).click();
			await runWorkbenchCommand(page, 'Flowable BPMN Designer: Export Diagram Image');
			await expect.poll(async () => await page.locator('body').innerText(), {
				message: 'Expected export to target the active valid BPMN editor.',
				timeout: 20_000,
			}).toContain(`Diagram exported to ${validFixture.replace(/\.bpmn$/i, '.svg')}`);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, invalidFixture);
			await removeIsolatedFixture(workerWorkspacePath, validFixture);
		}
	});

	test('filters property groups, clears selection with Escape, and persists sidebar width', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-listeners-formprops.bpmn', testInfo);
		try {
			let frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'reviewTask');
			const filterInput = frame.getByLabel('Filter property groups');
			await filterInput.fill('listener');
			await expect(frame.getByRole('region', { name: 'Task Listeners' })).toBeVisible();
			await expect.poll(async () => {
				return await frame.locator('.property-group.search-hidden').count();
			}).toBeGreaterThan(0);

			await filterInput.fill('');
			await frame.locator('#canvas').click();
			await page.keyboard.press('Escape');
			await expect(frame.locator('#properties')).toContainText('Select a BPMN element to edit Flowable-specific properties.');

			await selectBpmnShape(frame, 'reviewTask');
			const resizeHandle = frame.getByRole('separator', { name: 'Resize sidebar' });
			await resizeHandle.focus();
			await page.keyboard.press('ArrowLeft');
			await page.keyboard.press('ArrowLeft');
			const resizedWidth = await sidebarWidth(frame);
			expect(resizedWidth).toBeGreaterThan(320);

			await page.keyboard.press('Control+W');
			frame = await openBpmnFixtureInCurrentWorkbench(page, fixtureFileName);
			await expect.poll(async () => await sidebarWidth(frame), {
				message: 'Expected the resized sidebar width to persist across editor reopen.',
				timeout: 20_000,
			}).toBe(resizedWidth);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
