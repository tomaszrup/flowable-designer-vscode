import { expect, type Frame, type Page } from '@playwright/test';

const workbenchTimeout = 90_000;
const regexSpecialCharacters = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

export function escapeRegex(value: string): string {
	return Array.from(value, (character) => {
		return regexSpecialCharacters.has(character) ? `\\${character}` : character;
	}).join('');
}

export async function openBpmnFixture(page: Page, fixtureFileName: string, workbenchBaseUrl: string): Promise<Frame> {
	await page.goto(workbenchBaseUrl);
	return await openBpmnFixtureInCurrentWorkbench(page, fixtureFileName);
}

export async function openBpmnFixtureInCurrentWorkbench(page: Page, fixtureFileName: string): Promise<Frame> {
	await expect(page.getByRole('treeitem', { name: /^fixtures$/i }).first()).toBeVisible({ timeout: workbenchTimeout });

	const fixturesTreeItem = page.getByRole('treeitem', { name: /^fixtures$/i }).first();
	const fileTreeItem = page.getByRole('treeitem', {
		name: new RegExp(`^${escapeRegex(fixtureFileName)}$`, 'i'),
	}).first();

	if (!(await fileTreeItem.isVisible())) {
		await fixturesTreeItem.click();
	}

	await expect(fileTreeItem).toBeVisible({ timeout: workbenchTimeout });
	await fileTreeItem.dblclick();

	let frame = await tryWaitForBpmnDesignerFrame(page, 12_000);
	if (!frame) {
		await reopenEditorWithBpmnDesigner(page);
		frame = await waitForBpmnDesignerFrame(page);
	}
	await expect(page.getByRole('tab', { name: new RegExp(`^${escapeRegex(fixtureFileName)}$`, 'i') }).last()).toBeVisible();
	await expect(frame.locator('#canvas')).toBeVisible();
	await expect(frame.locator('#status')).toHaveText(/Diagram synchronized/, { timeout: workbenchTimeout });

	return frame;
}

function findBpmnDesignerFrame(page: Page): Promise<Frame | undefined> {
	return (async () => {
		for (const frame of page.frames()) {
			if (!frame.url().includes('/pre/fake.html')) {
				continue;
			}

			if ((await frame.locator('#status').count()) === 0) {
				continue;
			}

			return frame;
		}

		return undefined;
	})();
}

export async function waitForBpmnDesignerFrame(page: Page, timeout = workbenchTimeout): Promise<Frame> {
	let designerFrame: Frame | undefined;

	await expect.poll(async () => {
		designerFrame = await findBpmnDesignerFrame(page);
		if (!designerFrame) {
			return '';
		}
		return (await designerFrame.locator('#status').textContent()) ?? '';
	}, {
		message: 'Expected a BPMN designer webview frame to become available.',
		timeout,
	}).toMatch(/Preparing diagram editor|Loading BPMN diagram|Diagram synchronized/);

	if (!designerFrame) {
		throw new Error('BPMN designer webview frame was not found.');
	}

	return designerFrame;
}

async function tryWaitForBpmnDesignerFrame(page: Page, timeout: number): Promise<Frame | undefined> {
	try {
		return await waitForBpmnDesignerFrame(page, timeout);
	} catch {
		return undefined;
	}
}

export async function selectBpmnShape(frame: Frame, elementId: string): Promise<void> {
	const hitbox = frame.locator(`[data-element-id="${elementId}"] .djs-hit`).first();
	await expect(hitbox).toBeVisible();
	await hitbox.click();
}

export async function openSourceView(page: Page, frame: Frame): Promise<void> {
	await frame.getByRole('button', { name: 'View BPMN XML source' }).click();

	await expect.poll(async () => {
		const bodyText = await page.locator('body').innerText();
		return /<\?xml\s+version="1\.0"\s+encoding="UTF-8"\?>/u.test(bodyText);
	}, {
		message: 'Expected source view to open beside the designer.',
		timeout: 20_000,
	}).toBe(true);
}

export async function openProcessNavigator(page: Page): Promise<void> {
	const flowableTab = page.getByRole('tab', { name: /Flowable BPMN/i }).first();
	await expect(flowableTab).toBeVisible({ timeout: workbenchTimeout });
	await flowableTab.click();
	await expect(page.getByRole('treeitem').first()).toBeVisible({ timeout: workbenchTimeout });
}

export async function openProblemsPanel(page: Page): Promise<void> {
	await page.keyboard.press('Control+Shift+M');
	await expect(page.getByRole('textbox', { name: /^Filter Problems$/i })).toBeVisible({ timeout: workbenchTimeout });
}

export async function saveActiveEditor(page: Page): Promise<void> {
	await page.keyboard.press('Control+S');
}

export async function replaceInActiveEditor(page: Page, findText: string, replaceText: string): Promise<void> {
	const findInput = page.locator('textarea[aria-label="Find"]').last();
	const replaceInput = page.locator('textarea[aria-label="Replace"]').last();
	await page.locator('.monaco-editor').last().click();
	await page.keyboard.press('Control+H');

	try {
		await expect(findInput).toBeVisible({ timeout: 3_000 });
	} catch {
		await page.keyboard.press('Control+Shift+P');
		const widget = page.locator('.quick-input-widget').last();
		await expect(widget).toBeVisible({ timeout: workbenchTimeout });
		const commandInput = widget.locator('input.input');
		await expect(commandInput).toBeVisible({ timeout: workbenchTimeout });
		await commandInput.click();
		await page.keyboard.press('Control+A');
		await page.keyboard.type('>Replace');
		await page.keyboard.press('Enter');
	}

	await expect(findInput).toBeVisible({ timeout: workbenchTimeout });
	await expect(replaceInput).toBeVisible({ timeout: workbenchTimeout });
	await findInput.fill(findText);
	await replaceInput.fill(replaceText);
	await page.locator('[aria-label^="Replace All"]').last().click();
	await expect.poll(async () => {
		return (await page.locator('body').innerText()).split('\u00a0').join(' ');
	}, {
		message: `Expected the active editor to contain the replacement text: ${replaceText}`,
		timeout: 20_000,
	}).toContain(replaceText);
}

export async function getSidebarScrollMetrics(frame: Frame): Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }> {
	const sidebar = frame.locator('.sidebar');
	await expect(sidebar).toBeVisible();
	return await sidebar.evaluate((element) => {
		return {
			scrollTop: element.scrollTop,
			scrollHeight: element.scrollHeight,
			clientHeight: element.clientHeight,
		};
	});
}

export async function setSidebarScrollTop(frame: Frame, scrollTop: number): Promise<void> {
	const sidebar = frame.locator('.sidebar');
	await expect(sidebar).toBeVisible();
	await sidebar.evaluate((element, nextScrollTop) => {
		element.scrollTop = nextScrollTop;
	}, scrollTop);
}

export async function runWorkbenchCommand(page: Page, commandTitle: string, waitForClose = true): Promise<void> {
	await page.keyboard.press('Control+Shift+P');
	const widget = page.locator('.quick-input-widget').last();
	await expect(widget).toBeVisible({ timeout: workbenchTimeout });
	const commandInput = widget.locator('input.input');
	await expect(commandInput).toBeVisible({ timeout: workbenchTimeout });
	await commandInput.click();
	await page.keyboard.press('Control+A');
	await page.keyboard.type(`>${commandTitle}`);
	await page.keyboard.press('Enter');
	if (waitForClose) {
		await expect(widget).toBeHidden({ timeout: workbenchTimeout });
	}
}

export async function reopenEditorWithBpmnDesigner(page: Page): Promise<void> {
	await runWorkbenchCommand(page, 'View: Reopen Editor With...', false);
	const widget = page.locator('.quick-input-widget').last();
	await expect(widget).toBeVisible({ timeout: workbenchTimeout });
	await widget.getByText('Flowable BPMN Designer').click();
	await expect(widget).toBeHidden({ timeout: workbenchTimeout });
}