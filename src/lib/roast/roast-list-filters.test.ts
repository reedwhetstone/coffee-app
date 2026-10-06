import { describe, expect, it } from 'vitest';
import { roastListHref } from './roast-batches';
import {
	hasRoastListFilters,
	isLastRoastPage,
	NO_ROAST_LIST_FILTERS,
	parseRoastDay,
	readRoastListFilters,
	roastListDates,
	roastListEmptyDetail,
	roastListFilterKey,
	roastListQuery,
	roastRangeStart,
	writeRoastListFilters,
	type RoastListFilters
} from './roast-list-filters';

const BATCH = 'aaaaaaaa-0000-4000-8000-000000000001';
const read = (query: string) => readRoastListFilters(new URLSearchParams(query));
const filters = (overrides: Partial<RoastListFilters>): RoastListFilters => ({
	...NO_ROAST_LIST_FILTERS,
	...overrides
});
// Monday, October 5, 2026, in the afternoon on the member's own clock.
const TODAY = new Date(2026, 9, 5, 15, 30);

describe('the roast list’s filters in its address', () => {
	it('reads the plan’s example link', () => {
		expect(read('coffee=101&range=30d&q=guji&market=wholesale')).toEqual({
			coffee: 101,
			batch: null,
			range: '30d',
			from: null,
			to: null,
			q: 'guji',
			market: 'wholesale'
		});
	});

	it.each<[string, Partial<RoastListFilters>]>([
		['coffee', { coffee: 101 }],
		['batch', { batch: BATCH }],
		['a date preset', { range: '7d' }],
		['the year so far', { range: 'ytd' }],
		['a first day', { from: '2026-09-01' }],
		['a last day', { to: '2026-09-30' }],
		['both days', { from: '2026-09-01', to: '2026-09-30' }],
		['a search', { q: 'guji drop' }],
		['a search with characters a link has to escape', { q: '50% & #4531 “natural”' }],
		['retail', { market: 'retail' }],
		['wholesale', { market: 'wholesale' }],
		[
			'every filter at once',
			{
				coffee: 101,
				batch: BATCH,
				from: '2026-09-01',
				to: '2026-09-30',
				q: 'guji',
				market: 'retail'
			}
		]
	])('writes %s to the address and reads the same filters back', (_name, overrides) => {
		const written = filters(overrides);
		const href = roastListHref(written);

		expect(read(href.split('?')[1] ?? '')).toEqual(written);
		// A reload, a shared link, and Back all carry the same address.
		expect(roastListFilterKey(read(href.split('?')[1] ?? ''))).toBe(href);
	});

	it('leaves All out of the address', () => {
		expect(roastListHref(filters({ market: null }))).toBe('/roast');
		expect(read('market=all').market).toBeNull();
		expect(read('market=WHOLESALE').market).toBeNull();
	});

	it('writes the filters in one order, whatever order they were set in', () => {
		expect(
			roastListHref(
				filters({ market: 'wholesale', q: 'guji', range: '30d', coffee: 101, batch: BATCH })
			)
		).toBe(`/roast?coffee=101&batch=${BATCH}&range=30d&q=guji&market=wholesale`);
	});

	it('lets a date preset stand in place of a first and last day', () => {
		expect(read('range=7d&from=2026-09-01&to=2026-09-30')).toMatchObject({
			range: '7d',
			from: null,
			to: null
		});
		expect(read('range=14d&from=2026-09-01')).toMatchObject({ range: null, from: '2026-09-01' });
	});

	it.each([
		['coffee=abc', 'coffee'],
		['coffee=0', 'coffee'],
		['batch=wednesday', 'batch'],
		['range=week', 'range'],
		['from=2026-02-30', 'from'],
		['from=09/01/2026', 'from'],
		['to=2026-13-01', 'to'],
		['market=trade', 'market']
	] as const)('treats %s as no filter', (query, name) => {
		expect(read(query)[name]).toBeNull();
		expect(hasRoastListFilters(read(query))).toBe(false);
	});

	it('trims a search and treats a blank one as none', () => {
		expect(read('q=%20guji%20').q).toBe('guji');
		expect(read('q=%20%20').q).toBe('');
		expect(hasRoastListFilters(read('q=%20'))).toBe(false);
	});

	it('keeps the open roast and the new-roast form in the address when a filter changes', () => {
		const current = new URLSearchParams('roast=4531&coffee=101&q=old&modal=new');

		const next = writeRoastListFilters(filters({ range: '7d', market: 'retail' }), current);

		expect(Object.fromEntries(next)).toEqual({
			roast: '4531',
			modal: 'new',
			range: '7d',
			market: 'retail'
		});
		expect(current.get('q')).toBe('old');
	});

	it('clears every filter and nothing else', () => {
		const next = writeRoastListFilters(
			NO_ROAST_LIST_FILTERS,
			new URLSearchParams(
				`coffee=101&batch=${BATCH}&range=7d&from=2026-09-01&to=2026-09-30&q=x&market=retail&roast=4531`
			)
		);

		expect(next.toString()).toBe('roast=4531');
	});
});

describe('a calendar day in a link', () => {
	it('accepts a real day and nothing else', () => {
		expect(parseRoastDay('2026-09-30')).toBe('2026-09-30');
		expect(parseRoastDay(' 2024-02-29 ')).toBe('2024-02-29');
		expect(parseRoastDay('2026-02-29')).toBeNull();
		expect(parseRoastDay('2026-9-3')).toBeNull();
		expect(parseRoastDay('')).toBeNull();
		expect(parseRoastDay(null)).toBeNull();
	});
});

describe('the dates a preset covers', () => {
	it('counts back from the member’s own calendar day', () => {
		expect(roastRangeStart('7d', TODAY)).toBe('2026-09-28');
		expect(roastRangeStart('30d', TODAY)).toBe('2026-09-05');
		expect(roastRangeStart('ytd', TODAY)).toBe('2026-01-01');
	});

	it('uses the local day late in the evening, when UTC is already tomorrow', () => {
		const lateEvening = new Date(2026, 9, 5, 23, 59);

		expect(roastRangeStart('7d', lateEvening)).toBe('2026-09-28');
	});

	it('crosses a month and a year', () => {
		expect(roastRangeStart('7d', new Date(2026, 0, 3, 9))).toBe('2025-12-27');
		expect(roastRangeStart('30d', new Date(2026, 2, 1, 9))).toBe('2026-01-30');
	});

	it('leaves a preset open-ended and passes a first and last day through', () => {
		expect(roastListDates(filters({ range: '7d' }), TODAY)).toEqual({
			start: '2026-09-28',
			end: null
		});
		expect(roastListDates(filters({ from: '2026-09-01', to: '2026-09-30' }), TODAY)).toEqual({
			start: '2026-09-01',
			end: '2026-09-30'
		});
		expect(roastListDates(NO_ROAST_LIST_FILTERS, TODAY)).toEqual({ start: null, end: null });
	});
});

describe('the query the roast list route is asked with', () => {
	const query = (overrides: Partial<RoastListFilters>, offset = 0) =>
		Object.fromEntries(roastListQuery(filters(overrides), { limit: 50, offset }, TODAY));

	it('asks for one page and nothing else when no filter is set', () => {
		expect(query({})).toEqual({ limit: '50', offset: '0' });
	});

	it('sends every filter under the name Parchment reads', () => {
		expect(
			query({
				coffee: 101,
				batch: BATCH,
				from: '2026-09-01',
				to: '2026-09-30',
				q: 'guji',
				market: 'wholesale'
			})
		).toEqual({
			coffee_id: '101',
			batch_id: BATCH,
			date_start: '2026-09-01',
			date_end: '2026-09-30',
			q: 'guji',
			is_wholesale: 'true',
			limit: '50',
			offset: '0'
		});
	});

	it('turns retail and wholesale into is_wholesale, and leaves it out for All', () => {
		expect(query({ market: 'retail' }).is_wholesale).toBe('false');
		expect(query({ market: 'wholesale' }).is_wholesale).toBe('true');
		expect(query({ market: null })).not.toHaveProperty('is_wholesale');
	});

	it.each([
		['7d', '2026-09-28'],
		['30d', '2026-09-05'],
		['ytd', '2026-01-01']
	] as const)('turns the %s preset into the day it starts on, with no last day', (range, start) => {
		expect(query({ range })).toEqual({ date_start: start, limit: '50', offset: '0' });
	});

	it('asks for the next page from where the last one ended', () => {
		expect(query({ q: 'guji' }, 50)).toEqual({ q: 'guji', limit: '50', offset: '50' });
	});

	it('asks for the whole set when no page is named', () => {
		expect(roastListQuery(filters({ batch: BATCH }), null, TODAY).toString()).toBe(
			`batch_id=${BATCH}`
		);
	});
});

describe('the last page of roasts', () => {
	it('is the page that reaches the number of roasts the filters match', () => {
		expect(isLastRoastPage(0, 50, 257)).toBe(false);
		expect(isLastRoastPage(200, 50, 257)).toBe(false);
		expect(isLastRoastPage(250, 7, 257)).toBe(true);
		expect(isLastRoastPage(0, 50, 50)).toBe(true);
		expect(isLastRoastPage(0, 0, 0)).toBe(true);
		// A roast deleted elsewhere leaves fewer than the page expected.
		expect(isLastRoastPage(250, 6, 256)).toBe(true);
	});
});

describe('what is said under "No roasts match."', () => {
	const names = { coffee: 'Ethiopia Yirgacheffe Wush Wush', batch: 'Oct 1 · Wednesday roast' };

	it('uses the plan’s sentence for a date preset and a coffee', () => {
		expect(roastListEmptyDetail(filters({ range: '7d', coffee: 101 }), names)).toBe(
			'Nothing was roasted in the last 7 days for Ethiopia Yirgacheffe Wush Wush.'
		);
	});

	it.each<[Partial<RoastListFilters>, string]>([
		[{ coffee: 101 }, 'Nothing was roasted for Ethiopia Yirgacheffe Wush Wush.'],
		[
			{ coffee: 101, batch: BATCH },
			'Nothing was roasted for Ethiopia Yirgacheffe Wush Wush in Oct 1 · Wednesday roast.'
		],
		[{ range: '30d' }, 'Nothing was roasted in the last 30 days.'],
		[{ range: 'ytd' }, 'Nothing was roasted this year.'],
		[
			{ from: '2026-09-01', to: '2026-09-30' },
			'Nothing was roasted from Sep 1, 2026 to Sep 30, 2026.'
		],
		[{ from: '2026-09-01', to: '2026-09-01' }, 'Nothing was roasted on Sep 1, 2026.'],
		[{ from: '2026-09-01' }, 'Nothing was roasted since Sep 1, 2026.'],
		[{ to: '2026-09-30' }, 'Nothing was roasted up to Sep 30, 2026.'],
		[{ q: 'guji' }, 'No roasts match “guji”.'],
		[{ market: 'wholesale' }, 'No wholesale roasts.'],
		[{ market: 'retail', range: '7d' }, 'No retail roasts in the last 7 days.'],
		[
			{ market: 'wholesale', q: 'guji', range: 'ytd', coffee: 101 },
			'No wholesale roasts match “guji” this year for Ethiopia Yirgacheffe Wush Wush.'
		]
	])('names the filters in force: %o', (overrides, sentence) => {
		expect(roastListEmptyDetail(filters(overrides), names)).toBe(sentence);
	});

	it('says a batch named on its own has no roasts', () => {
		expect(roastListEmptyDetail(filters({ batch: BATCH }), names)).toBe(
			'That batch has no roasts. It may have been deleted.'
		);
	});

	it('still reads when a name is not known', () => {
		expect(roastListEmptyDetail(filters({ coffee: 999, batch: BATCH }))).toBe(
			'Nothing was roasted for this coffee in that batch.'
		);
	});

	it('says nothing when no filter is in force', () => {
		expect(roastListEmptyDetail(NO_ROAST_LIST_FILTERS)).toBe('');
	});
});
