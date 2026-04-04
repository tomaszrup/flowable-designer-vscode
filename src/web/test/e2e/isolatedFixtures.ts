import type { TestInfo } from '@playwright/test';
import { copyFile, rm, writeFile } from 'node:fs/promises';

let fixtureCounter = 0;

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

function replaceBpmnExtension(fileName: string, nextExtension: '.bpmn' | '.bpmn2' | '.bpmn20.xml'): string {
	return fileName.replace(/\.bpmn$/i, nextExtension);
}

function nextUniqueSuffix(testInfo: TestInfo): string {
	fixtureCounter += 1;
	return [
		sanitizeForFileName(testInfo.title),
		`w${testInfo.workerIndex}`,
		`r${testInfo.retry}`,
		Date.now().toString(36),
		fixtureCounter.toString(36),
	].join('-');
}

export async function createIsolatedFixture(
	workspacePath: string,
	sourceFixtureFileName: string,
	testInfo: TestInfo,
	extension: '.bpmn' | '.bpmn2' | '.bpmn20.xml' = '.bpmn',
): Promise<string> {
	const uniqueSuffix = nextUniqueSuffix(testInfo);
	const isolatedFileName = replaceBpmnExtension(`playwright-${uniqueSuffix}.bpmn`, extension);

	await copyFile(createFixturePath(workspacePath, sourceFixtureFileName), createFixturePath(workspacePath, isolatedFileName));

	return isolatedFileName;
}

export async function createIsolatedFixtureFromContent(
	workspacePath: string,
	content: string,
	testInfo: TestInfo,
	extension: '.bpmn' | '.bpmn2' | '.bpmn20.xml' = '.bpmn',
): Promise<string> {
	const uniqueSuffix = nextUniqueSuffix(testInfo);
	const isolatedFileName = replaceBpmnExtension(`playwright-${uniqueSuffix}.bpmn`, extension);

	await writeFile(createFixturePath(workspacePath, isolatedFileName), content, 'utf8');

	return isolatedFileName;
}

export async function removeIsolatedFixture(workspacePath: string, fileName: string): Promise<void> {
	await rm(createFixturePath(workspacePath, fileName), { force: true });
	await rm(createFixturePath(workspacePath, fileName.replace(/\.(?:bpmn20\.xml|bpmn2|bpmn)$/i, '.svg')), { force: true });
}
