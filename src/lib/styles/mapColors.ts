/**
 * Map-specific colors for the catalog's geographic canvas.
 *
 * These are deliberately warmer and quieter than the chart-series palette.
 * Repeating categorical chart colors across most of the land surface made the
 * map feel analytical and predominantly green. This hypsometric scale instead
 * reads like a printed coffee-origin atlas while retaining the established
 * elevation boundaries.
 */
export const TERRAIN_ELEVATION_BANDS = [
	{ key: 'below_1000', shortLabel: '<1k', label: 'Below 1,000 MASL', color: '#E9DDC8' },
	{ key: '1000_to_1399', shortLabel: '1–1.4k', label: '1,000–1,399 MASL', color: '#DDBE83' },
	{ key: '1400_to_1799', shortLabel: '1.4–1.8k', label: '1,400–1,799 MASL', color: '#C9855D' },
	{ key: '1800_to_2199', shortLabel: '1.8–2.2k', label: '1,800–2,199 MASL', color: '#A95E46' },
	{ key: '2200_and_above', shortLabel: '2.2k+', label: '2,200+ MASL', color: '#704C3D' }
] as const;

export const MAP_SURFACE_COLORS = {
	canvas: '#F7F2EA',
	park: '#E7E5D8',
	water: '#E5E0D7',
	waterway: '#C8BEB2',
	waterLabel: '#75695E'
} as const;
