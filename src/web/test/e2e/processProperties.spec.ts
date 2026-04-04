import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openBpmnFixtureInCurrentWorkbench, openSourceView, saveActiveEditor, selectBpmnShape } from './vscodeWorkbench';

async function bodyText(page: { locator: (selector: string) => { innerText(): Promise<string> } }): Promise<string> {
	return await page.locator('body').innerText();
}

test.describe('Flowable BPMN designer process property flows', () => {
	test('updates multi-process document metadata and process-scoped collections', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-multi-process.bpmn', testInfo);
		try {
			let frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'mainProcess');
			await expect(frame.getByRole('region', { name: 'Process Namespace' })).toBeVisible();

			await frame.getByLabel('Target Namespace').fill('https://playwright.example/processes');
			await frame.getByLabel('Target Namespace').blur();
			await frame.getByLabel('Candidate Starter Users').fill('admin,workflow');
			await frame.getByLabel('Candidate Starter Users').blur();
			await frame.getByLabel('Candidate Starter Groups').fill('ops,qa');
			await frame.getByLabel('Candidate Starter Groups').blur();

			const signalGroup = frame.getByRole('region', { name: 'Signal Definitions' });
			const initialSignalCount = await signalGroup.locator('.field-array-item').count();
			await signalGroup.getByRole('button', { name: 'Add Signal' }).click();
			const newSignal = signalGroup.locator('.field-array-item').nth(initialSignalCount);
			await newSignal.getByLabel('ID').fill('approvalSignalPl');
			await newSignal.getByLabel('Name').fill('Approval Signal PL');
			await newSignal.getByLabel('Scope').selectOption('processInstance');

			const messageGroup = frame.getByRole('region', { name: 'Message Definitions' });
			const initialMessageCount = await messageGroup.locator('.field-array-item').count();
			await messageGroup.getByRole('button', { name: 'Add Message' }).click();
			const newMessage = messageGroup.locator('.field-array-item').nth(initialMessageCount);
			await newMessage.getByLabel('ID').fill('approvalMessagePl');
			await newMessage.getByLabel('Name').fill('Approval Message PL');

			const listenerGroup = frame.getByRole('region', { name: 'Event Listeners' });
			const initialListenerCount = await listenerGroup.locator('.field-array-item').count();
			await listenerGroup.getByRole('button', { name: 'Add Event Listener' }).click();
			const newListener = listenerGroup.locator('.field-array-item').nth(initialListenerCount);
			await newListener.getByLabel('Events').fill('PROCESS_STARTED');
			await newListener.getByLabel('Events').blur();
			await newListener.getByLabel('Implementation Type').selectOption('class');
			await newListener.getByRole('textbox', { name: 'Implementation' }).fill('com.example.flowable.ProcessStartedAuditListener');
			await newListener.getByRole('textbox', { name: 'Implementation' }).blur();
			await newListener.getByLabel('Entity Type').fill('process-instance');
			await newListener.getByLabel('Entity Type').blur();

			const localizationGroup = frame.getByRole('region', { name: 'Localizations' });
			const initialLocalizationCount = await localizationGroup.locator('.field-array-item').count();
			await localizationGroup.getByRole('button', { name: 'Add Localization' }).click();
			const newLocalization = localizationGroup.locator('.field-array-item').nth(initialLocalizationCount);
			await newLocalization.getByLabel('Locale').fill('pl');
			await newLocalization.getByLabel('Locale').blur();
			await newLocalization.getByLabel('Name').fill('Proces glowny');
			await newLocalization.getByLabel('Name').blur();
			await newLocalization.getByLabel('Description').fill('Polski opis procesu glownego');
			await newLocalization.getByLabel('Description').blur();

			const dataObjectGroup = frame.getByRole('region', { name: 'Data Objects' });
			const initialDataObjectCount = await dataObjectGroup.locator('.field-array-item').count();
			await dataObjectGroup.getByRole('button', { name: 'Add Data Object' }).click();
			const newDataObject = dataObjectGroup.locator('.field-array-item').nth(initialDataObjectCount);
			await newDataObject.getByLabel('ID').fill('approvalPayload');
			await newDataObject.getByLabel('ID').blur();
			await newDataObject.getByLabel('Name').fill('approvalPayload');
			await newDataObject.getByLabel('Name').blur();
			await newDataObject.getByLabel('Type').fill('xsd:string');
			await newDataObject.getByLabel('Type').blur();
			await newDataObject.getByLabel('Default Value').fill('approved');
			await newDataObject.getByLabel('Default Value').blur();

			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => await bodyText(page), {
				message: 'Expected the source view to contain the updated process namespace and starter assignments.',
				timeout: 20_000,
			}).toMatch(/targetNamespace="https:\/\/playwright\.example\/processes"[\s\S]*candidateStarterUsers="admin,workflow"[\s\S]*candidateStarterGroups="ops,qa"/i);
			await expect.poll(async () => await bodyText(page), {
				message: 'Expected the added signal, message, event listener, localization, and data object to be serialized.',
				timeout: 20_000,
			}).toMatch(/approvalSignalPl[\s\S]*approvalMessagePl[\s\S]*ProcessStartedAuditListener[\s\S]*locale="pl"[\s\S]*Proces glowny[\s\S]*approvalPayload/i);

			await page.keyboard.press('Control+W');
			await saveActiveEditor(page);
			await page.keyboard.press('Control+W');

			frame = await openBpmnFixtureInCurrentWorkbench(page, fixtureFileName);
			await selectBpmnShape(frame, 'mainProcess');
			await expect(frame.getByLabel('Target Namespace')).toHaveValue('https://playwright.example/processes');
			await expect(frame.getByLabel('Candidate Starter Users')).toHaveValue('admin,workflow');
			await expect(frame.getByLabel('Candidate Starter Groups')).toHaveValue('ops,qa');
			await expect(frame.getByRole('region', { name: 'Signal Definitions' }).locator('.field-array-item')).toHaveCount(initialSignalCount + 1);
			await expect(frame.getByRole('region', { name: 'Message Definitions' }).locator('.field-array-item')).toHaveCount(initialMessageCount + 1);
			await expect(frame.getByRole('region', { name: 'Event Listeners' }).locator('.field-array-item')).toHaveCount(initialListenerCount + 1);
			await expect(frame.getByRole('region', { name: 'Localizations' }).locator('.field-array-item')).toHaveCount(initialLocalizationCount + 1);
			await expect(frame.getByRole('region', { name: 'Data Objects' }).locator('.field-array-item')).toHaveCount(initialDataObjectCount + 1);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
