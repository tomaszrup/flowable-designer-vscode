/** Extract file references from script text matching the @filepath@ pattern. */
export function parseFileReferences(script: string): string[] {
	const matches = new Set<string>();
	const regex = /@([^@\r\n]+)@/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(script)) !== null) {
		const reference = match[1].trim();
		if (reference) {
			matches.add(reference);
		}
	}
	return Array.from(matches);
}
