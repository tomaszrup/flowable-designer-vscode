/** Extract file references from script text matching the @filepath@ pattern. */
export function parseFileReferences(script: string): string[] {
	const matches: string[] = [];
	const regex = /@([^@\s]+)@/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(script)) !== null) {
		if (!matches.includes(match[1])) {
			matches.push(match[1]);
		}
	}
	return matches;
}
