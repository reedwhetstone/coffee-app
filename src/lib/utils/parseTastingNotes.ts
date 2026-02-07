import type { TastingNotes } from '$lib/types/coffee.types';

/**
 * Parses tasting notes JSON into TastingNotes object.
 * Accepts string (JSON), object, or null.
 * Returns null if parsing fails or required fields are missing.
 */
export function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
	if (!tastingNotesJson) return null;
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let parsed: any;
		if (typeof tastingNotesJson === 'string') {
			parsed = JSON.parse(tastingNotesJson);
		} else if (typeof tastingNotesJson === 'object') {
			parsed = tastingNotesJson;
		} else {
			return null;
		}
		if (
			parsed.body &&
			parsed.flavor &&
			parsed.acidity &&
			parsed.sweetness &&
			parsed.fragrance_aroma
		) {
			return parsed as TastingNotes;
		}
	} catch (error) {
		console.error('Error parsing tasting notes:', error);
	}
	return null;
}
