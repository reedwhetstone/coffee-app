/** Mirrors Parchment's CatalogComparisonResponse (GET /v1/catalog/compare). */
export interface ComparisonLot {
	id: number;
	name: string;
	source: string | null;
	link: string | null;
	stocked: boolean | null;
	wholesale: boolean | null;
	price: {
		quantityLbs: number;
		atQuantityLb: number | null;
		smallestTierLb: number | null;
		minOrderLbs: number | null;
		tiers: { minLbs: number | null; priceLb: number }[];
		originMedianLb: number | null;
		vsOriginMedianPct: number | null;
	};
}

export type ComparisonRelation = 'same' | 'different' | 'partial';

export interface ComparisonRow {
	key: string;
	group: 'Price' | 'Availability' | 'Origin' | 'Process' | 'Coffee' | 'Taste' | 'Listing';
	label: string;
	values: (string | number | null)[];
	relation: ComparisonRelation;
	bestLotIds: number[];
}

export interface CatalogComparison {
	quantityLbs: number;
	lots: ComparisonLot[];
	rows: ComparisonRow[];
	bestPriceLotIds: number[];
	missingIds: number[];
}

export type CompareLoadState =
	| { status: 'ready'; comparison: CatalogComparison; maxLots: number }
	| { status: 'empty' }
	| { status: 'sign_in' }
	| { status: 'limit'; message: string }
	| { status: 'error'; message: string };
