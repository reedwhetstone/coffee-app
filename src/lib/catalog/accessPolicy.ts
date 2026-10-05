/** Catalog discovery controls reserved for any paid app subscription or API tier. */
export const PREMIUM_DISCOVERY_FILTER_KEYS = [
	'type',
	'grade',
	'elevation_masl',
	'appearance',
	// ADR-016 grading filters share this gate.
	'grade_code',
	'peaberry',
	'lab_analyzed',
	'screen_size',
	'moisture_max',
	'score_protocol'
] as const;

/** Stable URL params that request paid discovery leverage. */
export const PREMIUM_DISCOVERY_QUERY_KEYS = [
	'type',
	'grade',
	'elevation_min_masl',
	'elevation_max_masl',
	'include_unknown_elevation',
	'appearance',
	'grade_code',
	'peaberry',
	'lab_analyzed',
	'screen_min',
	'screen_max',
	'include_unknown_screen',
	'moisture_max',
	'score_protocol'
] as const;
