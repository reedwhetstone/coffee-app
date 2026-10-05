/** Shapes returned by `/api/catalog/filters?counts=1` for the catalog filter controls. */

export interface CatalogFacetCount {
	value: string;
	count: number;
}

export interface CatalogVocabularyEntry {
	code: string;
	label: string;
	/** Family this value belongs to, when it has one (Pink Bourbon belongs to Bourbon). */
	parent_code: string | null;
}

export interface CatalogFilterVocabulary {
	varieties: CatalogVocabularyEntry[];
	species: CatalogVocabularyEntry[];
	drying_methods: CatalogVocabularyEntry[];
}

export interface CatalogFilterOptions {
	values: Record<string, string[]>;
	facets: Record<string, CatalogFacetCount[]>;
	/** Present only for callers who may use the standardized filters. */
	vocabulary?: CatalogFilterVocabulary;
	/**
	 * Coffees matching the other active filters that carry no standardized
	 * variety, so a variety choice can never match them. Null when unknown.
	 */
	unstandardizedVarietyCount?: number | null;
}
