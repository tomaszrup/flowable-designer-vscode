import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

async function activeBodyText(page: { locator: (selector: string) => { innerText(): Promise<string> } }): Promise<string> {
	return (await page.locator('body').innerText()).split('\u00a0').join(' ');
}

test.describe('Flowable BPMN designer event and connector flows', () => {
	test('updates gateway defaults, sequence-flow expressions, and text annotations', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-phase3-features.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'gateway1');
			const defaultFlowSelect = frame.getByLabel('Default Flow');
			await expect.poll(async () => await defaultFlowSelect.locator('option').allTextContents(), {
				message: 'Expected the gateway default-flow selector to list outgoing sequence flows.',
				timeout: 20_000,
			}).toContain('Yes (flow2)');
			await defaultFlowSelect.selectOption('flow2');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'flow2');
			await frame.getByLabel('Condition Expression').fill('${rejected}');
			await frame.getByLabel('Condition Expression').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'flow3');
			await frame.getByLabel('Skip Expression').fill('${skipRejectPath}');
			await frame.getByLabel('Skip Expression').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'textannot1');
			const textAnnotationGroup = frame.getByRole('region', { name: 'Text Annotation' });
			await textAnnotationGroup.getByLabel('Text', { exact: true }).fill('Updated process note from Playwright.');
			await textAnnotationGroup.getByLabel('Text', { exact: true }).blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to reflect the updated gateway default flow.',
				timeout: 20_000,
			}).toContain('default="flow2"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to reflect the updated sequence-flow expressions.',
				timeout: 20_000,
			}).toContain('${rejected}');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to reflect the updated skip expression.',
				timeout: 20_000,
			}).toContain('skipExpression="${skipRejectPath}"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to reflect the updated text annotation.',
				timeout: 20_000,
			}).toContain('Updated process note from Playwright.');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates boundary-event timer, error, signal, and message references', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-boundary-events.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'boundarytimer1');
			await frame.getByLabel('Timer Type').selectOption('timeCycle');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await frame.getByLabel('Value').fill('R5/PT1M');
			await frame.getByLabel('Value').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await frame.getByLabel('Cancel Activity').uncheck();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'boundaryerror1');
			await frame.getByLabel('Error Reference').fill('ERR-BOUNDARY');
			await frame.getByLabel('Error Reference').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'boundarysignal1');
			await frame.getByLabel('Signal Reference').selectOption('alertSignal');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'boundarymessage1');
			await frame.getByLabel('Message Reference').selectOption('orderMessage');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated boundary timer.',
				timeout: 20_000,
			}).toContain('cancelActivity="false"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated timer cycle.',
				timeout: 20_000,
			}).toContain('<timeCycle>R5/PT1M<');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated boundary error reference.',
				timeout: 20_000,
			}).toContain('errorRef="ERR-BOUNDARY"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated boundary signal reference.',
				timeout: 20_000,
			}).toContain('signalRef="alertSignal"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated boundary message reference.',
				timeout: 20_000,
			}).toContain('messageRef="orderMessage"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates timer, error, and terminate event definitions', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-event-types.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'timerstart1');
			await frame.getByLabel('Timer Type').selectOption('timeCycle');
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);
			await frame.getByLabel('Value').fill('R9/PT15M');
			await frame.getByLabel('Value').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'errorend1');
			await frame.getByLabel('Error Reference').fill('ERR-UPDATED');
			await frame.getByLabel('Error Reference').blur();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await selectBpmnShape(frame, 'terminateend1');
			await frame.getByLabel('Terminate All').check();
			await expect(frame.locator('#status')).toHaveText(/Diagram updated/);

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the updated timer cycle in XML.',
				timeout: 20_000,
			}).toContain('R9/PT15M');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the updated error reference in XML.',
				timeout: 20_000,
			}).toContain('errorRef="ERR-UPDATED"');
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the terminate-all marker in XML.',
				timeout: 20_000,
			}).toContain('activiti:terminateAll="true"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});

	test('updates compensation activity references and handlers', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-compensation-cancel.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'throwcompensation1');
			await frame.getByLabel('Activity Reference').fill('servicetask1');
			await frame.getByLabel('Activity Reference').blur();

			await selectBpmnShape(frame, 'compensate_servicetask1');
			await frame.getByLabel('Is Compensation Handler').uncheck();

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected compensation updates to be written to the BPMN source.',
				timeout: 20_000,
			}).toMatch(/throwcompensation1[\s\S]*activityRef="servicetask1"/i);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the compensation handler marker to be removed from the service task.',
				timeout: 20_000,
			}).not.toContain('isForCompensation="true"');
		} finally {
			await removeIsolatedFixture(workerWorkspacePath, fixtureFileName);
		}
	});
});
