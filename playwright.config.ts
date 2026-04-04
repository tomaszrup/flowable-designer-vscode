import { defineConfig } from '@playwright/test';

const port = 3100;
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const workers = Number(env.PLAYWRIGHT_WORKERS ?? '4');

export default defineConfig({
	testDir: './src/web/test/e2e',
	fullyParallel: false,
	workers,
	timeout: 90_000,
	retries: env.CI ? 1 : 0,
	expect: {
		timeout: 15_000,
	},
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://localhost:${port}`,
		browserName: 'chromium',
		headless: true,
		viewport: { width: 1600, height: 1100 },
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	webServer: {
		command: `npx vscode-test-web --browser none --extensionDevelopmentPath=. --port ${port} .`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !env.CI,
		timeout: 120_000,
	},
});