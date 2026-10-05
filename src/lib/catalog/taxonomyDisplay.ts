/**
 * Standardized variety, species and drying names for a catalog coffee.
 *
 * The Parchment catalog returns a `taxonomy` object beside the supplier's own
 * text when that text matched its vocabulary. The standardized names make lots
 * from different suppliers read the same way; the supplier's wording stays
 * visible because it can hold detail the vocabulary does not cover.
 */

interface TaxonomyLabel {
	label: string;
}

export interface TaxonomyDisplay {
	/** What to show: standardized names when the lot has them, else supplier text. */
	value: string | null;
	/** The supplier's own wording, when it adds to or differs from `value`. */
	supplierText: string | null;
}

function labelsOf(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const labels: string[] = [];
	for (const entry of value as Partial<TaxonomyLabel>[]) {
		const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
		if (label && !labels.includes(label)) labels.push(label);
	}
	return labels;
}

function taxonomyOf(coffee: unknown): Record<string, unknown> {
	const taxonomy = (coffee as { taxonomy?: unknown } | null)?.taxonomy;
	return taxonomy && typeof taxonomy === 'object' ? (taxonomy as Record<string, unknown>) : {};
}

function clean(text: string | null | undefined): string | null {
	const trimmed = text?.trim();
	return trimmed ? trimmed : null;
}

/**
 * Same names in the same order, ignoring case, accents, punctuation and the
 * joining words suppliers use between names ("Caturra and Catuaí").
 */
function sameWording(a: string, b: string): boolean {
	const normalize = (text: string) =>
		text
			.normalize('NFD')
			.replace(/\p{M}+/gu, '')
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.split(' ')
			.filter((word) => word && word !== 'and' && word !== 'y')
			.join(' ');
	return normalize(a) === normalize(b);
}

function display(labels: string[], supplierText: string | null | undefined): TaxonomyDisplay {
	const raw = clean(supplierText);
	if (labels.length === 0) return { value: raw, supplierText: null };
	const value = labels.join(', ');
	return { value, supplierText: raw && !sameWording(raw, value) ? raw : null };
}

/** Varieties, then any species the supplier states (for example Robusta). */
export function varietyDisplay(coffee: unknown): TaxonomyDisplay {
	const taxonomy = taxonomyOf(coffee);
	return display(
		[...labelsOf(taxonomy.varieties), ...labelsOf(taxonomy.species)],
		(coffee as { cultivar_detail?: string | null } | null)?.cultivar_detail
	);
}

export function dryingDisplay(coffee: unknown, supplierText: string | null): TaxonomyDisplay {
	return display(labelsOf(taxonomyOf(coffee).drying_methods), supplierText);
}
