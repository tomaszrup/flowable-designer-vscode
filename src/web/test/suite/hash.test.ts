import { describe, test, expect } from 'vitest';
import { simpleHash } from '../../shared/hash';

describe('simpleHash', () => {
	test('returns 0 for empty string', () => {
		expect(simpleHash('')).toBe(0);
	});

	test('is deterministic — same input always produces same output', () => {
		const xml = '<process id="myProcess"><startEvent id="start" /></process>';
		expect(simpleHash(xml)).toBe(simpleHash(xml));
	});

	test('produces different hashes for different strings', () => {
		const a = simpleHash('hello');
		const b = simpleHash('world');
		expect(a).not.toBe(b);
	});

	test('detects single-character differences', () => {
		const base = '<process id="myProcess" />';
		const changed = '<process id="myProces" />';
		expect(simpleHash(base)).not.toBe(simpleHash(changed));
	});

	test('detects whitespace differences', () => {
		const a = simpleHash('<tag>value</tag>');
		const b = simpleHash('<tag> value</tag>');
		expect(a).not.toBe(b);
	});

	test('returns an integer', () => {
		const h = simpleHash('some string');
		expect(Number.isInteger(h)).toBe(true);
	});

	test('handles unicode characters', () => {
		const h = simpleHash('日本語テスト');
		expect(Number.isInteger(h)).toBe(true);
		expect(h).not.toBe(0);
	});

	test('handles emoji / surrogate pairs', () => {
		const h = simpleHash('🚀🎉');
		expect(Number.isInteger(h)).toBe(true);
		expect(h).not.toBe(0);
	});

	test('handles very long strings without throwing', () => {
		const longStr = 'x'.repeat(100_000);
		expect(() => simpleHash(longStr)).not.toThrow();
		expect(Number.isInteger(simpleHash(longStr))).toBe(true);
	});

	test('stays within signed 32-bit integer range', () => {
		const hash = simpleHash('x'.repeat(50_000) + '🚀'.repeat(1_000));
		expect(hash).toBeGreaterThanOrEqual(-2147483648);
		expect(hash).toBeLessThanOrEqual(2147483647);
	});

	test('order matters — different order gives different hash', () => {
		expect(simpleHash('ab')).not.toBe(simpleHash('ba'));
	});

	test('content-identical XML round-trip produces matching hash', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="process1" name="My Process">
    <startEvent id="start" />
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="start" targetRef="end" />
  </process>
</definitions>`;
		const onDiskHash = simpleHash(xml);
		// Simulate: webview round-trips the same XML back
		const afterRoundTrip = xml;
		expect(simpleHash(afterRoundTrip)).toBe(onDiskHash);
	});

	test('modified XML does not match original hash', () => {
		const original = `<process id="process1"><userTask id="task1" name="Review" /></process>`;
		const modified = `<process id="process1"><userTask id="task1" name="Approve" /></process>`;
		expect(simpleHash(original)).not.toBe(simpleHash(modified));
	});
});
