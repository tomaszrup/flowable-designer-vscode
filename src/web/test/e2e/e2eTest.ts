import { test as base } from '@playwright/test';

const cwd = (globalThis as { process?: { cwd(): string } }).process?.cwd();

if (!cwd) {
	throw new Error('Playwright e2e helpers require process.cwd() to be available.');
}

type WorkerFixtures = {
	workbenchBaseUrl: string;
	workerWorkspacePath: string;
};

export const test = base.extend<WorkerFixtures>({
	workbenchBaseUrl: async ({}, use) => {
		await use('/');
	},
	workerWorkspacePath: async ({}, use) => {
		await use(cwd);
	},
});

export { expect } from '@playwright/test';