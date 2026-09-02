/** Catalog discovery controls reserved for any paid app subscription or API tier. */
export const PREMIUM_DISCOVERY_FILTER_KEYS = [
	'type',
	'grade',
	'elevation_masl',
	'appearance'
] as const;

/** Stable URL params that request paid discovery leverage. */
export const PREMIUM_DISCOVERY_QUERY_KEYS = [
	'type',
	'grade',
	'elevation_min_masl',
	'elevation_max_masl',
	'include_unknown_elevation',
	'appearance'
] as const;
