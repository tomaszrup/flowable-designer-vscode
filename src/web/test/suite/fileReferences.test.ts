import { describe, test, expect } from 'vitest';
import { parseFileReferences } from '../../shared/fileReferences';

describe('parseFileReferences', () => {
	test('returns empty array for empty string', () => {
		expect(parseFileReferences('')).toEqual([]);
	});

	test('returns empty array for text without @ patterns', () => {
		expect(parseFileReferences('var x = 1;')).toEqual([]);
	});

	test('extracts a single file reference', () => {
		expect(parseFileReferences('load(@scripts/init.groovy@)')).toEqual(['scripts/init.groovy']);
	});

	test('extracts multiple file references', () => {
		const script = 'exec(@helper.js@); run(@lib/utils.groovy@)';
		expect(parseFileReferences(script)).toEqual(['helper.js', 'lib/utils.groovy']);
	});

	test('deduplicates repeated references', () => {
		const script = '@file.js@ and again @file.js@';
		expect(parseFileReferences(script)).toEqual(['file.js']);
	});

	test('ignores single @ signs (e.g. email addresses)', () => {
		expect(parseFileReferences('send to user@example.com')).toEqual([]);
	});

	test('supports file references with spaces in the path', () => {
		expect(parseFileReferences('@has space@')).toEqual(['has space']);
	});

	test('trims surrounding whitespace inside a delimited reference', () => {
		expect(parseFileReferences('@  scripts/my task.groovy  @')).toEqual(['scripts/my task.groovy']);
	});

	test('handles path with nested directories', () => {
		expect(parseFileReferences('@src/main/resources/scripts/process.groovy@')).toEqual([
			'src/main/resources/scripts/process.groovy',
		]);
	});

	test('handles reference at start and end of string', () => {
		expect(parseFileReferences('@start.js@')).toEqual(['start.js']);
	});

	test('handles reference adjacent to other text', () => {
		expect(parseFileReferences('before@ref.js@after')).toEqual(['ref.js']);
	});

	test('handles multiple references on separate lines', () => {
		const script = 'line1 @a.js@\nline2 @b.js@';
		expect(parseFileReferences(script)).toEqual(['a.js', 'b.js']);
	});

	test('does not match empty @@ pattern', () => {
		expect(parseFileReferences('@@')).toEqual([]);
	});

	test('handles paths with dots and hyphens', () => {
		expect(parseFileReferences('@my-script.v2.groovy@')).toEqual(['my-script.v2.groovy']);
	});

	test('handles paths with underscores', () => {
		expect(parseFileReferences('@scripts/my_helper.js@')).toEqual(['scripts/my_helper.js']);
	});
});
