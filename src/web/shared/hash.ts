/**
 * Fast, non-cryptographic 32-bit hash for string content comparison.
 * Used only for dirty-flag optimisation — not collision-resistant.
 */
export function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = Math.trunc((hash << 5) - hash + (str.codePointAt(i) ?? 0));
	}
	return hash;
}
