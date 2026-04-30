const PLACEHOLDER_PROCESS_VALUES = new Set([
	'unknown',
	'not specified',
	'not stated',
	'none stated',
	'not disclosed',
	'undisclosed',
	'unspecified',
	'n/a',
	'na'
]);

export function normalizeProcessDisplayValue(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const normalized = trimmed.toLowerCase();
	if (PLACEHOLDER_PROCESS_VALUES.has(normalized)) {
		return null;
	}
	return trimmed;
}

export function formatProcessDisplayValue(value: string): string {
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function isPublicProcessFacetOption(value: unknown): boolean {
	if (value === undefined || value === null) return false;
	return normalizeProcessDisplayValue(String(value)) !== null;
}
