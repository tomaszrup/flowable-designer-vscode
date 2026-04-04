/**
 * Fast, non-cryptographic 32-bit hash for string content comparison.
 * Used only for dirty-flag optimisation — not collision-resistant.
 */
export function simpleHash(str: string): number {
	let hash = 0;
	for (const char of str) {
		hash = Math.trunc(Math.imul(31, hash) + (char.codePointAt(0) ?? 0));
		if (hash > 2147483647) {
			hash -= 4294967296;
		} else if (hash < -2147483648) {
			hash += 4294967296;
		}
	}
	return hash;
}
