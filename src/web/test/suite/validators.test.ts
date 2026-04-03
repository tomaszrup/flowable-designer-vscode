import { describe, test, expect } from 'vitest';
import { validateId, validateRequired, validateTimerValue, validateRetryCycle } from '../../webview/validators';

describe('validators', () => {
	describe('validateId', () => {
		test('returns error for empty string', () => {
			expect(validateId('')).toBe('ID is required');
			expect(validateId('   ')).toBe('ID is required');
		});

		test('returns error for id starting with digit', () => {
			expect(validateId('1abc')).toContain('Invalid ID format');
		});

		test('returns error for id with spaces', () => {
			expect(validateId('my id')).toContain('Invalid ID format');
		});

		test('returns error for id starting with special char', () => {
			expect(validateId('-abc')).toContain('Invalid ID format');
			expect(validateId('$abc')).toContain('Invalid ID format');
		});

		test('returns null for valid ids', () => {
			expect(validateId('myId')).toBeNull();
			expect(validateId('_private')).toBeNull();
			expect(validateId('Task_01')).toBeNull();
			expect(validateId('flow.name')).toBeNull();
			expect(validateId('my-flow')).toBeNull();
			expect(validateId('abc123')).toBeNull();
		});

		test('trims whitespace before validating', () => {
			expect(validateId('  myId  ')).toBeNull();
		});
	});

	describe('validateRequired', () => {
		test('returns a validator function', () => {
			const validator = validateRequired('Name');
			expect(typeof validator).toBe('function');
		});

		test('returns error message with label for empty value', () => {
			const validator = validateRequired('Name');
			expect(validator('')).toBe('Name is required');
			expect(validator('   ')).toBe('Name is required');
		});

		test('returns null for non-empty value', () => {
			const validator = validateRequired('Name');
			expect(validator('hello')).toBeNull();
		});
	});

	describe('validateTimerValue', () => {
		test('returns null for empty/blank values', () => {
			expect(validateTimerValue('')).toBeNull();
			expect(validateTimerValue('   ')).toBeNull();
		});

		test('accepts ISO 8601 durations', () => {
			expect(validateTimerValue('PT5M')).toBeNull();
			expect(validateTimerValue('PT1H30M')).toBeNull();
			expect(validateTimerValue('P1D')).toBeNull();
		});

		test('accepts ISO 8601 dates', () => {
			expect(validateTimerValue('2026-12-31T23:59')).toBeNull();
			expect(validateTimerValue('2026-01-01')).toBeNull();
			expect(validateTimerValue('2026-12-31T23:59Z')).toBeNull();
			expect(validateTimerValue('2026-12-31T23:59:30+02:00')).toBeNull();
		});

		test('accepts repeat patterns', () => {
			expect(validateTimerValue('R3/PT10M')).toBeNull();
			expect(validateTimerValue('R/PT5M')).toBeNull();
		});

		test('accepts expressions', () => {
			expect(validateTimerValue('${dueDate}')).toBeNull();
			expect(validateTimerValue('${timer.getCycle()}')).toBeNull();
		});

		test('rejects invalid values', () => {
			expect(validateTimerValue('5 minutes')).not.toBeNull();
			expect(validateTimerValue('tomorrow')).not.toBeNull();
			expect(validateTimerValue('abc')).not.toBeNull();
		});
	});

	describe('validateRetryCycle', () => {
		test('returns null for empty/blank values', () => {
			expect(validateRetryCycle('')).toBeNull();
			expect(validateRetryCycle('   ')).toBeNull();
		});

		test('accepts repeat patterns', () => {
			expect(validateRetryCycle('R3/PT10M')).toBeNull();
			expect(validateRetryCycle('R5/PT1H')).toBeNull();
			expect(validateRetryCycle('R/PT5M')).toBeNull();
		});

		test('accepts expressions', () => {
			expect(validateRetryCycle('${retryCycle}')).toBeNull();
		});

		test('rejects plain durations (not repeat patterns)', () => {
			expect(validateRetryCycle('PT5M')).not.toBeNull();
		});

		test('rejects arbitrary strings', () => {
			expect(validateRetryCycle('3 times')).not.toBeNull();
			expect(validateRetryCycle('invalid')).not.toBeNull();
		});
	});
});
