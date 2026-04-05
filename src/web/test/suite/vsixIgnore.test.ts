/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';

describe('.vscodeignore packaging rules', () => {
	test('excludes generated reports and local packaging artifacts', () => {
		const ignoreFile = readFileSync(join(process.cwd(), '.vscodeignore'), 'utf8');

		expect(ignoreFile).toContain('coverage/**');
		expect(ignoreFile).toContain('playwright-report/**');
		expect(ignoreFile).toContain('test-results/**');
		expect(ignoreFile).toContain('*.vsix');
		expect(ignoreFile).toContain('pipeline-fail');
	});

	test('keeps packaging-only scripts out of the extension bundle', () => {
		const ignoreFile = readFileSync(join(process.cwd(), '.vscodeignore'), 'utf8');

		expect(ignoreFile).toContain('scripts/**');
	});
});