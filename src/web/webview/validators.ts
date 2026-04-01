export function validateId(value: string): string | null {
	if (!value.trim()) { return 'ID is required'; }
	if (!/^[a-zA-Z_][\w.-]*$/.test(value.trim())) { return 'Invalid ID format (must start with letter or underscore)'; }
	return null;
}

export function validateRequired(label: string): (value: string) => string | null {
	return (value: string) => value.trim() ? null : `${label} is required`;
}

export function validateTimerValue(value: string): string | null {
	if (!value.trim()) { return null; }
	// Accept ISO 8601 durations, dates, repeat patterns, and expressions
	if (/^(R\d*\/)?P[\dYMDTHS.]+$/.test(value) || /^\d{4}-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?)?)?$/.test(value) || /^\$\{.+\}$/.test(value)) { return null; }
	return 'Expected ISO 8601 duration (PT5M), date (2026-12-31T23:59), repeat (R3/PT10M), or expression (${...})';
}

export function validateRetryCycle(value: string): string | null {
	if (!value.trim()) { return null; }
	if (/^R\d*\/P[\dYMDTHS.]+$/.test(value) || /^\$\{.+\}$/.test(value)) { return null; }
	return 'Expected repeat pattern (R3/PT10M) or expression (${...})';
}
