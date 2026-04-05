/// <reference types="node" />

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'vitest';

describe('coverage badge generation', () => {
	test('writes both the SVG badge and the Shields endpoint payload', () => {
		const workspace = mkdtempSync(join(tmpdir(), 'coverage-badge-'));
		const coverageDir = join(workspace, 'coverage');
		const summaryPath = join(coverageDir, 'coverage-summary.json');
		const svgPath = join(coverageDir, 'badge.svg');
		const jsonPath = join(coverageDir, 'badge.json');

		mkdirSync(coverageDir, { recursive: true });
		writeFileSync(
			summaryPath,
			JSON.stringify({
				total: {
					lines: {
						pct: 83.25,
					},
				},
			}),
			'utf8',
		);

		const result = spawnSync(process.execPath, ['scripts/generate-coverage-badge.mjs', summaryPath, svgPath, 'lines'], {
			cwd: process.cwd(),
			encoding: 'utf8',
		});

		try {
			expect(result.status).toBe(0);
			expect(result.stderr).toBe('');

			const svg = readFileSync(svgPath, 'utf8');
			const badgePayload = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
				schemaVersion: number;
				label: string;
				message: string;
				color: string;
			};

			expect(svg).toContain('coverage');
			expect(svg).toContain('83.3%');
			expect(badgePayload).toEqual({
				schemaVersion: 1,
				label: 'coverage',
				message: '83.3%',
				color: 'green',
			});
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	test('uses a vsce-compatible badge host in the README', () => {
		const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');

		expect(readme).toContain('https://img.shields.io/endpoint?url=');
		expect(readme).not.toContain('https://tomaszrup.github.io/flowable-designer-vscode/coverage.svg');
	});
});