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

/** One grade designation from Parchment's vocabulary, such as "Kenya AA". */
export interface CatalogGradeEntry {
	code: string;
	label: string;
	description: string;
	/** What the designation grades: size, altitude, defects, cup, preparation. One code can grade several. */
	dimensions: string[];
	sort_order: number;
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
	/** Grade designations. Present only for callers who may use the grading filters. */
	grades?: CatalogGradeEntry[];
}
