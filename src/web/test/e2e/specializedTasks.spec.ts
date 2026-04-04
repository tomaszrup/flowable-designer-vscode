import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

async function pageBodyText(page: { locator: (selector: string) => { innerText(): Promise<string> } }): Promise<string> {
	return await page.locator('body').innerText();
}

test.describe('Flowable BPMN designer specialized task flows', () => {
	test('updates start-event form settings and form properties', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-listeners-formprops.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'startevent1');
			await frame.getByLabel('Form Key').fill('newStartForm');
			await frame.getByLabel('Form Key').blur();
			await frame.getByLabel('Initiator').fill('processStarter');
			await frame.getByLabel('Initiator').blur();

			const formProperties = frame.getByRole('region', { name: 'Form Properties' });
			const initialCount = await formProperties.locator('.field-array-item').count();
			await formProperties.getByRole('button', { name: 'Add Form Property' }).click();
			const newFormProperty = formProperties.locator('.field-array-item').nth(initialCount);
			await newFormProperty.getByLabel('ID').fill('launchReason');
			await newFormProperty.getByLabel('Name').fill('Launch Reason');
			await newFormProperty.getByLabel('Type').selectOption('string');
			await newFormProperty.getByLabel('Default').fill('manual');
			await newFormProperty.getByLabel('Default').blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected start-event settings to persist in source view.',
				timeout: 20_000,
			}).toMatch(/startEvent id="startevent1"[\s\S]*formKey="newStartForm"[\s\S]*initiator="processStarter"[\s\S]*formProperty id="launchReason"[\s\S]*default="manual"/i);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates call-activity parameters and called element', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-call-activity.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'callactivity1');
			await frame.getByLabel('Called Element').fill('approvalSubProcess');
			await frame.getByLabel('Called Element').blur();

			const inputGroup = frame.getByRole('region', { name: 'Input Parameters' });
			await inputGroup.getByRole('button', { name: 'Add Input Parameter' }).click();
			const inputItems = inputGroup.locator('.field-array-item');
			const newInput = inputItems.nth(await inputItems.count() - 1);
			await newInput.getByLabel('Source').fill('region');
			await newInput.getByLabel('Source').blur();
			await newInput.getByLabel('Target').fill('subRegion');
			await newInput.getByLabel('Target').blur();

			const outputGroup = frame.getByRole('region', { name: 'Output Parameters' });
			await outputGroup.getByRole('button', { name: 'Add Output Parameter' }).click();
			const outputItems = outputGroup.locator('.field-array-item');
			const newOutput = outputItems.nth(await outputItems.count() - 1);
			await newOutput.getByLabel('Source').fill('subApproved');
			await newOutput.getByLabel('Source').blur();
			await newOutput.getByLabel('Target').fill('mainApproved');
			await newOutput.getByLabel('Target').blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected call-activity parameters to be serialized.',
				timeout: 20_000,
			}).toMatch(/callActivity id="callactivity1"[^>]*calledElement="approvalSubProcess"[\s\S]*activiti:in source="region" target="subRegion"[\s\S]*activiti:out source="subApproved" target="mainApproved"/i);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates mail, http, shell, and external-worker task panels', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const mailFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-mail-task.bpmn', testInfo);
		const httpFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-http-task.bpmn', testInfo);
		const shellFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-shell-task.bpmn', testInfo);
		const externalFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-external-worker-task.bpmn', testInfo);
		try {
			let frame = await openBpmnFixture(page, mailFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'mailtask1');
			await frame.getByLabel('To').fill('ops@example.com');
			await frame.getByLabel('To').blur();
			await frame.getByLabel('Subject').fill('Playwright Mail Subject');
			await frame.getByLabel('Subject').blur();
			await frame.getByLabel('Html').fill('<p>Mail body from Playwright</p>');
			await frame.getByLabel('Html').blur();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toMatch(/ops@example\.com[\s\S]*Playwright Mail Subject[\s\S]*Mail body from Playwright/i);
			await page.keyboard.press('Control+W');

			frame = await openBpmnFixture(page, httpFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'httptask1');
			await frame.getByLabel('Request Url').fill('https://api.example.test/orders');
			await frame.getByLabel('Request Url').blur();
			await frame.getByLabel('Request Timeout').fill('45000');
			await frame.getByLabel('Request Timeout').blur();
			await frame.getByLabel('Save Response Parameters').check();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toMatch(/https:\/\/api\.example\.test\/orders[\s\S]*45000[\s\S]*saveResponseParameters[\s\S]*true/i);
			await page.keyboard.press('Control+W');

			frame = await openBpmnFixture(page, shellFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'shelltask1');
			await frame.getByLabel('Command').fill('/usr/local/bin/run-report.sh');
			await frame.getByLabel('Command').blur();
			await frame.getByLabel('Wait').uncheck();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toMatch(/run-report\.sh[\s\S]*name="wait"[\s\S]*false/i);
			await page.keyboard.press('Control+W');

			frame = await openBpmnFixture(page, externalFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'externalworkertask1');
			await frame.getByLabel('Topic').fill('invoice-processing');
			await frame.getByLabel('Topic').blur();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toMatch(/invoice-processing/i);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, mailFixture);
			await removeIsolatedFixture(workerWorkspacePath, httpFixture);
			await removeIsolatedFixture(workerWorkspacePath, shellFixture);
			await removeIsolatedFixture(workerWorkspacePath, externalFixture);
		}
	});

	test('updates send, receive, and manual task retry settings', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-phase6-tasks.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'sendTask1');
			await frame.getByLabel('Retry Time Cycle').fill('R4/PT20M');
			await frame.getByLabel('Retry Time Cycle').blur();

			await selectBpmnShape(frame, 'receiveTask1');
			await frame.getByLabel('Retry Time Cycle').fill('R2/PT5M');
			await frame.getByLabel('Retry Time Cycle').blur();

			await selectBpmnShape(frame, 'manualTask1');
			await frame.getByLabel('Retry Time Cycle').fill('R8/PT30M');
			await frame.getByLabel('Retry Time Cycle').blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected retry cycles for send, receive, and manual tasks.',
				timeout: 20_000,
			}).toMatch(/sendTask1[\s\S]*failedJobRetryTimeCycle[\s\S]*R4\/PT20M[\s\S]*receiveTask1[\s\S]*R2\/PT5M[\s\S]*manualTask1[\s\S]*R8\/PT30M/i);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates business-rule task properties and implementation', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-business-rule-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'businessruletask1');
			await frame.getByLabel('Rule Names').fill('creditCheck,complianceCheck');
			await frame.getByLabel('Rule Names').blur();
			await frame.getByLabel('Java Class').fill('com.example.rules.CompositeRuleDelegate');
			await frame.getByLabel('Java Class').blur();
			await frame.getByLabel('Result Variable').fill('ruleEvaluation');
			await frame.getByLabel('Result Variable').blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected business-rule task updates in the serialized XML.',
				timeout: 20_000,
			}).toMatch(/businessRuleTask id="businessruletask1"[^>]*ruleNames="creditCheck,complianceCheck"[\s\S]*class="com\.example\.rules\.CompositeRuleDelegate"[\s\S]*resultVariableName="ruleEvaluation"/i);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
