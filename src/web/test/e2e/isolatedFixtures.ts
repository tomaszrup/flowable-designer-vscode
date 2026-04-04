import type { TestInfo } from '@playwright/test';
import { copyFile, rm } from 'node:fs/promises';

function sanitizeForFileName(value: string): string {
	const lowerCased = value.toLowerCase();
	let sanitized = '';
	let lastWasHyphen = false;

	for (const character of lowerCased) {
		const isAlphaNumeric = (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9');
		if (isAlphaNumeric) {
			sanitized += character;
			lastWasHyphen = false;
			continue;
		}

		if (!lastWasHyphen) {
			sanitized += '-';
			lastWasHyphen = true;
		}
	}

	const trimmed = sanitized.replace(/^-/, '').replace(/-$/, '');
	return trimmed.slice(0, 48) || 'fixture';
}

function createFixturePath(workspacePath: string, fileName: string): string {
	return `${workspacePath}/fixtures/flowable/${fileName}`;
}

export async function createIsolatedFixture(workspacePath: string, sourceFixtureFileName: string, testInfo: TestInfo): Promise<string> {
	const uniqueSuffix = [
		sanitizeForFileName(testInfo.title),
		`w${testInfo.workerIndex}`,
		`r${testInfo.retry}`,
		Date.now().toString(36),
	].join('-');
	const isolatedFileName = `playwright-${uniqueSuffix}.bpmn`;

	await copyFile(createFixturePath(workspacePath, sourceFixtureFileName), createFixturePath(workspacePath, isolatedFileName));

	return isolatedFileName;
}

export async function removeIsolatedFixture(workspacePath: string, fileName: string): Promise<void> {
	await rm(createFixturePath(workspacePath, fileName), { force: true });
	await rm(createFixturePath(workspacePath, fileName.replace(/\.bpmn$/i, '.svg')), { force: true });
}