/**
 * Purveyors chart palette.
 *
 * Earth-tone series derived from the brand illustration palette (see the
 * blog hero artwork and OrganicBand), with two cool anchors (teal, plum)
 * so adjacent series stay distinguishable for color-blind readers.
 *
 * Charts must take colors from this module — never raw Tailwind hexes.
 * Keep in sync with the `chart` token family in tailwind.config.ts.
 */

/** Ordered categorical series palette for multi-series charts. */
export const CHART_SERIES: string[] = [
	'#C05B2E', // rust — primary series
	'#7FB069', // growth green
	'#4E8098', // teal anchor
	'#D9A05B', // harvest gold
	'#6D5BD0', // plum anchor (intelligence family)
	'#586048', // deep olive
	'#F9A57B', // brand peach
	'#8FA382', // sage
	'#9C4356', // wine
	'#695C4D' // roast brown
];

/** Structured process categories. "Unknown"/"Other" stays neutral. */
export const PROCESS_COLORS: Record<string, string> = {
	Washed: '#4E8098',
	Natural: '#D9A05B',
	Honey: '#C97E4E',
	Anaerobic: '#9C4356',
	'Wet Hulled': '#586048',
	Unknown: '#A8A29E'
};

export const PROCESS_FALLBACK_COLORS: string[] = CHART_SERIES.slice(0, 5);

/** ADR-004 processing disclosure levels, ordered least → most disclosed. */
export const DISCLOSURE_COLORS: Record<string, string> = {
	undisclosed: '#A8A29E',
	none: '#C9C2B6',
	label_only: '#D9A05B',
	structured: '#7FB069',
	narrative: '#4E8098',
	high_detail: '#586048'
};

export const DISCLOSURE_LABELS: Record<string, string> = {
	undisclosed: 'Undisclosed',
	none: 'None stated',
	label_only: 'Label only',
	structured: 'Structured',
	narrative: 'Narrative',
	high_detail: 'High detail'
};

/** Price-tier series. */
export const RETAIL_COLOR = '#C05B2E';
export const WHOLESALE_COLOR = '#4E8098';

/** Highlight/marker accents inside charts. */
export const MARKER_PRIMARY = '#C05B2E';
export const MARKER_SECONDARY = '#7FB069';

/** Axis, gridline, and tooltip chrome — brand inks instead of gray-500s. */
export const AXIS_LABEL_COLOR = '#695c4d';
export const AXIS_TICK_COLOR = '#a39a8c';
export const GRIDLINE_COLOR = '#E4E4E2';
export const TOOLTIP_BG = '#FCFAF8';
export const TOOLTIP_BORDER = '#E4E4E2';
export const TOOLTIP_TITLE_COLOR = '#302f2a';
export const TOOLTIP_TEXT_COLOR = '#695c4d';
export const TOOLTIP_MUTED_COLOR = '#a39a8c';
