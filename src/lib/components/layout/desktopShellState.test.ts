import { describe, expect, it } from 'vitest';
import { countActiveCatalogFilters, DESKTOP_SHELL_CONTENT_MARGIN } from './desktopShellState';

describe('desktop shell state', () => {
	it.each([
		['catalog defaults', '/catalog', true, false, {}, 0],
		['catalog home-roaster suppliers', '/catalog', false, false, {}, 1],
		['catalog wholesale-only suppliers', '/catalog', true, true, {}, 1],
		['catalog exclusive supplier modes', '/catalog', false, true, {}, 1],
		['range value', '/catalog', true, false, { price: { min: 2, max: 10 } }, 1],
		['array value', '/catalog', true, false, { country: ['Ethiopia'] }, 1],
		['trimmed string', '/catalog', true, false, { process: ' Washed ' }, 1],
		['empty values', '/catalog', true, false, { country: [], process: '' }, 0],
		['boolean true', '/catalog', true, false, { certified: true }, 1],
		['boolean false', '/catalog', true, false, { has_additives: false }, 1],
		['beans defaults', '/beans', false, false, { stocked: 'TRUE' }, 1],
		['roast defaults', '/roast', false, false, {}, 0]
	])('counts %s', (_label, routeId, showWholesale, wholesaleOnly, filters, expected) => {
		expect(countActiveCatalogFilters({ routeId, showWholesale, wholesaleOnly, filters })).toBe(
			expected
		);
	});

	it('keeps one compact desktop action-bar offset at every desktop width', () => {
		expect(DESKTOP_SHELL_CONTENT_MARGIN).toBe('md:ml-16');
	});
});
