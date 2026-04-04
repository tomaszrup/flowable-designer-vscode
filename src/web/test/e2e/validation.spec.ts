import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openProblemsPanel, runWorkbenchCommand, selectBpmnShape } from './vscodeWorkbench';

test.describe('Flowable BPMN designer validation flows', () => {
	test('shows a validation warning for an invalid BPMN diagram', async ({ page, workbenchBaseUrl }) => {
		await openBpmnFixture(page, 'invalid-unassigned-user-task.bpmn', workbenchBaseUrl);

		await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
		await expect.poll(async () => {
			return await page.locator('body').innerText();
		}, {
			message: 'Expected the validation command to surface a warning for the invalid BPMN fixture.',
			timeout: 20_000,
		}).toContain('BPMN validation found 1 issue(s). See Problems panel.');

		await openProblemsPanel(page);
		await expect(page.getByRole('treeitem', {
			name: /User task 'reviewTask' has no assignee or candidate users\/groups/i,
		})).toBeVisible();
	});

	test('clears the validation problem after assigning the invalid user task', async ({ page, workbenchBaseUrl }, testInfo) => {
		const frame = await openBpmnFixture(page, 'invalid-unassigned-user-task.bpmn', workbenchBaseUrl);

		await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
		await openProblemsPanel(page);
		const validationProblem = page.getByRole('treeitem', {
			name: /User task 'reviewTask' has no assignee or candidate users\/groups/i,
		});
		await expect(validationProblem).toBeVisible();

		await selectBpmnShape(frame, 'reviewTask');
		const assigneeInput = frame.getByLabel('Assignee');
		const assignee = `resolved-assignee-${testInfo.retry}-${Date.now()}`;
		await assigneeInput.fill(assignee);
		await assigneeInput.blur();
		await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

		await runWorkbenchCommand(page, 'Flowable BPMN Designer: Validate BPMN');
		await expect.poll(async () => {
			return await page.locator('body').innerText();
		}, {
			message: 'Expected validation to succeed after fixing the assignee.',
			timeout: 20_000,
		}).toMatch(/BPMN validation passed [—-] no issues found\./);

		await openProblemsPanel(page);
		await expect(page.getByText('No problems have been detected in the workspace.')).toBeVisible();
		await expect(validationProblem).toHaveCount(0);
	});

	test('applies validation automatically when the invalid diagram is auto-saved after editing', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'invalid-unassigned-user-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			const validationProblem = page.getByRole('treeitem', {
				name: /User task 'reviewTask' has no assignee or candidate users\/groups/i,
			});

			await selectBpmnShape(frame, 'reviewTask');
			const nameInput = frame.getByLabel('Name');
			await expect(nameInput).toBeVisible();
			await nameInput.fill(`Review Request Autosave ${testInfo.retry}-${Date.now()}`);
			await nameInput.blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await openProblemsPanel(page);
			await expect(validationProblem).toBeVisible();

			const assigneeInput = frame.getByLabel('Assignee');
			const assignee = `autosave-assignee-${testInfo.retry}-${Date.now()}`;
			await assigneeInput.fill(assignee);
			await assigneeInput.blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await openProblemsPanel(page);
			await expect(page.getByText('No problems have been detected in the workspace.')).toBeVisible();
			await expect(validationProblem).toHaveCount(0);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});