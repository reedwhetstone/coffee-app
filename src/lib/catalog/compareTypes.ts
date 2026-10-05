import type { components } from '@purveyors/sdk';

/** Parchment's comparison of 2 to 6 catalog coffees (GET /v1/catalog/compare). */
export type CatalogComparison = components['schemas']['CatalogComparisonResponse']['data'];
export type ComparisonLot = CatalogComparison['lots'][number];
export type ComparisonRow = CatalogComparison['rows'][number];

export type CompareLoadState =
	| { status: 'ready'; comparison: CatalogComparison; maxLots: number }
	| { status: 'empty'; unavailable?: number }
	| { status: 'sign_in' }
	| { status: 'limit'; message: string }
	| { status: 'error'; message: string };
