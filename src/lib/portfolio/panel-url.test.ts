import { describe, expect, it } from 'vitest';
import {
	PORTFOLIO_PANEL_TABS,
	portfolioCoffeeHref,
	readPortfolioUrl,
	writePortfolioUrl,
	type PortfolioUrlState
} from './panel-url';

const read = (query: string) => readPortfolioUrl(new URLSearchParams(query));
const write = (query: string, state: PortfolioUrlState) =>
	writePortfolioUrl(new URLSearchParams(query), state).toString();

describe('/beans?coffee=&tab= links', () => {
	it.each(PORTFOLIO_PANEL_TABS)('opens a coffee on its %s tab', (tab) => {
		expect(read(`coffee=101&tab=${tab}`)).toEqual({ section: 'purchased', coffeeId: 101, tab });
	});

	it('opens a coffee on Overview when no tab, or an unknown one, is named', () => {
		expect(read('coffee=101')).toEqual({ section: 'purchased', coffeeId: 101, tab: 'overview' });
		expect(read('coffee=101&tab=profit').tab).toBe('overview');
	});

	it('opens the bookmarked section, which never opens a purchased coffee', () => {
		expect(read('tab=bookmarked')).toEqual({
			section: 'bookmarked',
			coffeeId: null,
			tab: 'overview'
		});
		expect(read('tab=bookmarked&coffee=101').coffeeId).toBeNull();
	});

	it.each(['', 'tab=roasting', 'coffee=0', 'coffee=abc', 'coffee=-1', 'coffee=1.5'])(
		'opens the portfolio with no panel for "%s"',
		(query) => {
			expect(read(query)).toEqual({ section: 'purchased', coffeeId: null, tab: 'overview' });
		}
	);

	it('writes the open coffee and tab, leaving Overview out as the default', () => {
		expect(write('', { section: 'purchased', coffeeId: 101, tab: 'roasting' })).toBe(
			'coffee=101&tab=roasting'
		);
		expect(write('', { section: 'purchased', coffeeId: 101, tab: 'overview' })).toBe('coffee=101');
	});

	it('writes the bookmarked section and clears it again', () => {
		expect(
			write('coffee=101&tab=cupping', { section: 'bookmarked', coffeeId: null, tab: 'overview' })
		).toBe('tab=bookmarked');
		expect(write('tab=bookmarked', { section: 'purchased', coffeeId: null, tab: 'overview' })).toBe(
			''
		);
	});

	it('removes the coffee and tab when the panel closes, and keeps every other parameter', () => {
		expect(
			write('share=token&coffee=101&tab=roasting&modal=new', {
				section: 'purchased',
				coffeeId: null,
				tab: 'overview'
			})
		).toBe('share=token&modal=new');
	});

	it('reads back exactly what it wrote', () => {
		const states: PortfolioUrlState[] = [
			{ section: 'purchased', coffeeId: null, tab: 'overview' },
			{ section: 'bookmarked', coffeeId: null, tab: 'overview' },
			...PORTFOLIO_PANEL_TABS.map((tab) => ({ section: 'purchased' as const, coffeeId: 101, tab }))
		];
		for (const state of states) {
			expect(read(write('share=token', state))).toEqual(state);
		}
	});

	it('builds the link another page uses to open a coffee on a tab', () => {
		expect(portfolioCoffeeHref(101, 'roasting')).toBe('/beans?coffee=101&tab=roasting');
		expect(portfolioCoffeeHref(101)).toBe('/beans?coffee=101');
		expect(read(portfolioCoffeeHref(101, 'analytics').split('?')[1])).toEqual({
			section: 'purchased',
			coffeeId: 101,
			tab: 'analytics'
		});
	});
});
