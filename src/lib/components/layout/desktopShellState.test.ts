import { describe, expect, it } from 'vitest';
import { countActiveCatalogFilters, DESKTOP_SHELL_CONTENT_MARGIN } from './desktopShellState';

describe('desktop shell state', () => {
	it.each([
		['defaults', true, false, {}, 0],
		['home-roaster suppliers', false, false, {}, 1],
		['wholesale-only suppliers', true, true, {}, 1],
		['exclusive supplier modes', false, true, {}, 1],
		['range value', true, false, { price: { min: 2, max: 10 } }, 1],
		['array value', true, false, { country: ['Ethiopia'] }, 1],
		['trimmed string', true, false, { process: ' Washed ' }, 1],
		['empty values', true, false, { country: [], process: ' ', certified: false }, 0],
		['boolean true', true, false, { certified: true }, 1]
	])('counts %s', (_label, showWholesale, wholesaleOnly, filters, expected) => {
		expect(countActiveCatalogFilters({ showWholesale, wholesaleOnly, filters })).toBe(expected);
	});

	it('keeps medium and wide content offsets in one stable geometry contract', () => {
		expect(DESKTOP_SHELL_CONTENT_MARGIN).toBe('md:ml-20 xl:ml-72');
	});
});
