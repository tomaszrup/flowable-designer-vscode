import { expect, test } from './e2eTest';
import { createIsolatedFixture, removeIsolatedFixture } from './isolatedFixtures';
import { openBpmnFixture, openSourceView, selectBpmnShape } from './vscodeWorkbench';

async function activeBodyText(page: { locator: (selector: string) => { innerText(): Promise<string> } }): Promise<string> {
	return await page.locator('body').innerText();
}

test.describe('Flowable BPMN designer event and connector flows', () => {
	test('updates gateway defaults, sequence-flow expressions, and text annotations', async ({ page, workbenchBaseUrl, workerWorkspacePath }, testInfo) => {
		const fixtureFileName = await createIsolatedFixture(workerWorkspacePath, 'legacy-phase3-features.bpmn', testInfo);
		try {
			const frame = await openBpmnFixture(page, fixtureFileName, workbenchBaseUrl);

			await selectBpmnShape(frame, 'gateway1');
			await frame.getByLabel('Default Flow').selectOption('flow2');

			await selectBpmnShape(frame, 'flow3');
			await frame.getByLabel('Condition Expression').fill('${rejected}');
			await frame.getByLabel('Condition Expression').blur();
			await frame.getByLabel('Skip Expression').fill('${skipRejectPath}');
			await frame.getByLabel('Skip Expression').blur();

			await selectBpmnShape(frame, 'textannot1');
			await frame.getByLabel('Text').fill('Updated process note from Playwright.');
			await frame.getByLabel('Text').blur();

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to reflect gateway, sequence-flow, and annotation changes.',
				timeout: 20_000,
			}).toMatch(/exclusiveGateway id="gateway1"[^>]*default="flow2"[\s\S]*sequenceFlow id="flow3"[\s\S]*\$\{rejected\}[\s\S]*skipExpression="\$\{skipRejectPath\}"[\s\S]*Updated process note from Playwright\./i);
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
			await frame.getByLabel('Value').fill('R5/PT1M');
			await frame.getByLabel('Value').blur();
			await frame.getByLabel('Cancel Activity').uncheck();

			await selectBpmnShape(frame, 'boundaryerror1');
			await frame.getByLabel('Error Reference').fill('ERR-BOUNDARY');
			await frame.getByLabel('Error Reference').blur();

			await selectBpmnShape(frame, 'boundarysignal1');
			await frame.getByLabel('Signal Reference').selectOption('alertSignal');

			await selectBpmnShape(frame, 'boundarymessage1');
			await frame.getByLabel('Message Reference').selectOption('orderMessage');

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected the source editor to contain the updated boundary-event configuration.',
				timeout: 20_000,
			}).toMatch(/boundaryEvent id="boundarytimer1"[^>]*cancelActivity="false"[\s\S]*timeCycle>R5\/PT1M<[\s\S]*boundaryEvent id="boundaryerror1"[\s\S]*errorRef="ERR-BOUNDARY"[\s\S]*boundaryEvent id="boundarysignal1"[\s\S]*signalRef="alertSignal"[\s\S]*boundaryEvent id="boundarymessage1"[\s\S]*messageRef="orderMessage"/i);
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
			await frame.getByLabel('Value').fill('R9/PT15M');
			await frame.getByLabel('Value').blur();

			await selectBpmnShape(frame, 'errorend1');
			await frame.getByLabel('Error Reference').fill('ERR-UPDATED');
			await frame.getByLabel('Error Reference').blur();

			await selectBpmnShape(frame, 'terminateend1');
			await frame.getByLabel('Terminate All').check();

			await openSourceView(page, frame);
			await expect.poll(async () => await activeBodyText(page), {
				message: 'Expected updated timer, error, and terminate-event definitions in XML.',
				timeout: 20_000,
			}).toMatch(/startEvent id="timerstart1"[\s\S]*timeCycle>R9\/PT15M<[\s\S]*endEvent id="errorend1"[\s\S]*errorRef="ERR-UPDATED"[\s\S]*endEvent id="terminateend1"[\s\S]*terminateEventDefinition[^>]*activiti:terminateAll="true"/i);
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
