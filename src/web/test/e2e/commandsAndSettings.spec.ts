import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { readWorkspaceFile, writeWorkspaceSettings } from './testWorkspace';
import { openBpmnFixture, openProblemsPanel, openSourceView, reopenEditorWithTextEditor, replaceInActiveEditor, runWorkbenchCommand, selectBpmnShape, waitForBpmnDesignerFrame } from './vscodeWorkbench';

let restoreSettings: (() => Promise<void>) | null = null;

test.describe('Flowable BPMN designer command and settings flows', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeAll(async ({ workerWorkspacePath }) => {
		restoreSettings = await writeWorkspaceSettings(workerWorkspacePath, {
			'flowableBpmnDesigner.imageExport.enabled': true,
			'flowableBpmnDesigner.imageExport.overlay.enabled': true,
			'flowableBpmnDesigner.imageExport.overlay.showDate': false,
			'flowableBpmnDesigner.imageExport.overlay.color': '#123456',
			'flowableBpmnDesigner.imageExport.overlay.backgroundColor': '#fefefe',
			'flowableBpmnDesigner.editor.minimap': true,
		});
	});

	test.afterAll(async () => {
		await restoreSettings?.();
	});

	test('creates a new BPMN diagram from the command palette', async ({ page, workbenchBaseUrl }) => {
		await page.goto(workbenchBaseUrl);
		await expect(page.getByRole('treeitem', { name: /^fixtures$/i }).first()).toBeVisible();
		await runWorkbenchCommand(page, 'Flowable BPMN Designer: New BPMN Diagram');
		const frame = await waitForBpmnDesignerFrame(page);
		await expect(frame.locator('#canvas')).toBeVisible();
		await expect(frame.locator('#status')).toHaveText(/Diagram synchronized/);
		await expect(page.getByRole('tab', { name: /^Untitled-1$/i })).toBeVisible();
		await expect(frame.getByRole('button', { name: 'View BPMN XML source' })).toBeVisible();
	});

	test('validates BPMN from the plain text editor when the custom editor is not active', async ({ page, workbenchBaseUrl }) => {
		await openBpmnFixture(page, 'invalid-unassigned-user-task.bpmn', workbenchBaseUrl);
		await reopenEditorWithTextEditor(page);

		await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
		await openProblemsPanel(page);
		await expect(page.getByText(/User task 'reviewTask' has no assignee or candidate users\/groups/i)).toBeVisible();
	});

	test('enables minimap and auto-export overlay from workspace settings', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			await expect(frame.locator('.djs-minimap')).toBeVisible();

			await selectBpmnShape(frame, 'approveTask');
			await frame.getByLabel('Name').fill('Export With Overlay');
			await frame.getByLabel('Name').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await expect.poll(async () => {
				return await readWorkspaceFile(workerWorkspacePath, `fixtures/flowable/${fixtureFileName.replace(/\.bpmn$/i, '.svg')}`);
			}, {
				message: 'Expected auto-export to write an SVG file with the configured overlay.',
				timeout: 20_000,
			}).toContain('Key: legacyUserTaskProcess');
			const svgContent = await readWorkspaceFile(workerWorkspacePath, `fixtures/flowable/${fixtureFileName.replace(/\.bpmn$/i, '.svg')}`);
			expect(svgContent).toContain('Key: legacyUserTaskProcess');
			expect(svgContent).toContain(`File: ${fixtureFileName.replace(/\.bpmn$/i, '.svg')}`);
			expect(svgContent).toContain('NS: http://www.activiti.org/test');
			expect(svgContent).toContain('fill="#123456"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('opens .bpmn2 and .bpmn20.xml files in the custom editor', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const bpmn2FileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo, '.bpmn2');
		const bpmn20FileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo, '.bpmn20.xml');
		try {
			let frame = await openBpmnFixture(page, bpmn2FileName, workbenchBaseUrl);
			await expect(frame.locator('#status')).toHaveText('Diagram synchronized');

			frame = await openBpmnFixture(page, bpmn20FileName, workbenchBaseUrl);
			await expect(frame.locator('#status')).toHaveText('Diagram synchronized');
			await openSourceView(page, frame);
			await expect.poll(async () => await page.locator('body').innerText(), {
				message: 'Expected the BPMN 2.0 XML file to expose the BPMN source.',
				timeout: 20_000,
			}).toContain('activiti:assignee="kermit"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, bpmn2FileName);
			await removeIsolatedFixture(workerWorkspacePath, bpmn20FileName);
		}
	});

	test('shows a load error after saving malformed XML from source view', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await openSourceView(page, frame);
			await replaceInActiveEditor(page, '</definitions>', '');
			await page.keyboard.press('Control+S');

			await expect(frame.locator('#status')).toHaveText(/Unable to render BPMN XML/, { timeout: 20_000 });
			await expect(frame.locator('#issues')).not.toHaveText('');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
