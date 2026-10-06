import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@vercel/analytics/sveltekit', () => ({ track }));

const { changedFilterControls, filterControl, trackCatalogFilterEvent } = await import(
	'./filterAnalytics'
);

beforeEach(() => track.mockClear());

describe('catalog filter events', () => {
	it('names the control a chip belongs to, never its value', () => {
		expect(filterControl('country:Kenya')).toBe('country');
		expect(filterControl('grade_code:KE:AA')).toBe('grade_code');
		expect(filterControl('name')).toBe('name');
	});

	it('reports each changed control once, however many values changed', () => {
		expect(
			changedFilterControls(
				['country:Kenya', 'name', 'peaberry'],
				['country:Kenya', 'country:Peru', 'country:Brazil', 'peaberry', 'grade_code:KE:AA']
			)
		).toEqual({ added: ['country', 'grade_code'], removed: ['name'] });
		expect(changedFilterControls(['name'], ['name'])).toEqual({ added: [], removed: [] });
	});

	it('sends the event with the catalog surface and the given properties', () => {
		trackCatalogFilterEvent('catalog_filter_added', { control: 'country' });
		trackCatalogFilterEvent('catalog_filter_panel_opened');

		expect(track).toHaveBeenNthCalledWith(1, 'catalog_filter_added', {
			surface: 'catalog',
			control: 'country'
		});
		expect(track).toHaveBeenNthCalledWith(2, 'catalog_filter_panel_opened', {
			surface: 'catalog'
		});
	});
});
