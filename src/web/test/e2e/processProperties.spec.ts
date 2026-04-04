import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, saveActiveEditor, selectBpmnShape } from './vscodeWorkbench';

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

			await expect(frame.getByLabel('Target Namespace')).toHaveValue('https://playwright.example/processes');
			await expect(frame.getByLabel('Candidate Starter Users')).toHaveValue('admin,workflow');
			await expect(frame.getByLabel('Candidate Starter Groups')).toHaveValue('ops,qa');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await openSourceView(page, frame);
			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the source editor to contain the updated target namespace.',
				timeout: 20_000,
			}).toContain('targetNamespace="https://playwright.example/processes"');
			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the source editor to contain the added process listener.',
				timeout: 20_000,
			}).toContain('ProcessStartedAuditListener');
			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the source editor to contain the added localization description.',
				timeout: 20_000,
			}).toContain('Polski opis procesu glownego');
			await expect.poll(async () => {
				return (await page.locator('body').innerText()).split('\u00a0').join(' ');
			}, {
				message: 'Expected the source editor to contain the added data object.',
				timeout: 20_000,
			}).toContain('approvalPayload');
			await saveActiveEditor(page);
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
