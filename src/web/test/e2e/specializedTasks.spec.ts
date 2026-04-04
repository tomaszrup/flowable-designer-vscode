import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

async function pageBodyText(page: { locator: (selector: string) => { innerText(): Promise<string> } }): Promise<string> {
	return (await page.locator('body').innerText()).split('\u00a0').join(' ');
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
				message: 'Expected the start-event form key to persist in source view.',
				timeout: 20_000,
			}).toContain('formKey="newStartForm"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the start-event initiator to persist in source view.',
				timeout: 20_000,
			}).toContain('initiator="processStarter"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the new start-event form property to persist in source view.',
				timeout: 20_000,
			}).toContain('formProperty id="launchReason"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the start-event form property default value to persist in source view.',
				timeout: 20_000,
			}).toContain('default="manual"');
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
			const inputItems = inputGroup.locator('.field-array-item');
			const existingInput = inputItems.nth(1);
			await existingInput.getByLabel('Source', { exact: true }).fill('region');
			await existingInput.getByLabel('Source', { exact: true }).blur();
			await existingInput.getByLabel('Target', { exact: true }).fill('subRegion');
			await existingInput.getByLabel('Target', { exact: true }).blur();

			const outputGroup = frame.getByRole('region', { name: 'Output Parameters' });
			const outputItems = outputGroup.locator('.field-array-item');
			const existingOutput = outputItems.nth(0);
			await existingOutput.getByLabel('Target', { exact: true }).fill('mainApproved');
			await existingOutput.getByLabel('Target', { exact: true }).blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the called element to be serialized.',
				timeout: 20_000,
			}).toContain('calledElement="approvalSubProcess"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the input parameter to be serialized.',
				timeout: 20_000,
			}).toContain('source="region"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the updated call-activity input target to be serialized.',
				timeout: 20_000,
			}).toContain('target="subRegion"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the output parameter to be serialized.',
				timeout: 20_000,
			}).toContain('activiti:out source="subResult" target="mainApproved"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates mail task panel fields', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-mail-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			await selectBpmnShape(frame, 'mailtask1');
			const mailGroup = frame.getByRole('region', { name: 'Mail Task' });
			await expect(mailGroup).toBeVisible();
			await mailGroup.getByLabel('To', { exact: true }).fill('ops@example.com');
			await mailGroup.getByLabel('To', { exact: true }).blur();
			await mailGroup.getByLabel('Subject', { exact: true }).fill('Playwright Mail Subject');
			await mailGroup.getByLabel('Subject', { exact: true }).blur();
			await mailGroup.getByLabel('Html', { exact: true }).fill('<p>Mail body from Playwright</p>');
			await mailGroup.getByLabel('Html', { exact: true }).blur();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('ops@example.com');
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('Playwright Mail Subject');
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('Mail body from Playwright');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates http task panel fields', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-http-task.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);
			await selectBpmnShape(frame, 'httptask1');
			await frame.getByLabel('Request Url').fill('https://api.example.test/orders');
			await frame.getByLabel('Request Url').blur();
			await frame.getByLabel('Request Timeout').fill('45000');
			await frame.getByLabel('Request Timeout').blur();
			await frame.getByLabel('Save Response Parameters').check();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('https://api.example.test/orders');
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('45000');
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('saveResponseParameters');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates shell and external-worker task panels', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const shellFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-shell-task.bpmn', testInfo);
		const externalFixture = await createIsolatedFixture(workerWorkspacePath, 'legacy-external-worker-task.bpmn', testInfo);
		try {
			let frame = await openBpmnFixture(page, shellFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'shelltask1');
			await frame.getByLabel('Command').fill('/usr/local/bin/run-report.sh');
			await frame.getByLabel('Command').blur();
			await frame.getByLabel('Wait').uncheck();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('run-report.sh');
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toContain('name="wait"');

			frame = await openBpmnFixture(page, externalFixture, workbenchBaseUrl);
			await selectBpmnShape(frame, 'externalworkertask1');
			await frame.getByLabel('Topic').fill('invoice-processing');
			await frame.getByLabel('Topic').blur();
			await openSourceView(page, frame);
			await expect.poll(async () => await pageBodyText(page), { timeout: 20_000 }).toMatch(/invoice-processing/i);
		} finally {
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
			}).toContain('R4/PT20M');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the receive-task retry cycle in source view.',
				timeout: 20_000,
			}).toContain('R2/PT5M');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the manual-task retry cycle in source view.',
				timeout: 20_000,
			}).toContain('R8/PT30M');
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
				message: 'Expected the updated business-rule rule names in the serialized XML.',
				timeout: 20_000,
			}).toContain('ruleNames="creditCheck,complianceCheck"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the updated business-rule Java class in the serialized XML.',
				timeout: 20_000,
			}).toContain('activiti:class="com.example.rules.CompositeRuleDelegate"');
			await expect.poll(async () => await pageBodyText(page), {
				message: 'Expected the updated business-rule result variable in the serialized XML.',
				timeout: 20_000,
			}).toContain('activiti:resultVariableName="ruleEvaluation"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
