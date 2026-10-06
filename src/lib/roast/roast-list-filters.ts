import { readCoffeeFilter } from './coffee-links';
import { formatDay } from './profile-picker-model';
import { readBatchFilter, roastListHref } from './roast-batches';

/** Roasts the list asks for at a time. "Load more" asks for the next page. */
export const ROAST_PAGE_SIZE = 50;

/** The longest search term the roast list accepts. */
export const MAX_ROAST_SEARCH_LENGTH = 100;

export const ROAST_RANGES = [
	{ value: '7d', label: 'Last 7 days', phrase: 'in the last 7 days' },
	{ value: '30d', label: 'Last 30 days', phrase: 'in the last 30 days' },
	{ value: 'ytd', label: 'This year', phrase: 'this year' }
] as const;

export type RoastRange = (typeof ROAST_RANGES)[number]['value'];
export type RoastMarket = 'retail' | 'wholesale';

/** Every filter the roast list carries in its address. */
export interface RoastListFilters {
	/** A portfolio coffee, by inventory ID. */
	coffee: number | null;
	/** One batch, by batch ID. */
	batch: string | null;
	/** A date preset. When it is set, `from` and `to` are not. */
	range: RoastRange | null;
	/** The first roast day to include, `YYYY-MM-DD`. */
	from: string | null;
	/** The last roast day to include, `YYYY-MM-DD`. */
	to: string | null;
	/** One search term across coffee name, batch name, and roast number. Empty when none. */
	q: string;
	/** Retail or wholesale. Null is All. */
	market: RoastMarket | null;
}

export const NO_ROAST_LIST_FILTERS: RoastListFilters = {
	coffee: null,
	batch: null,
	range: null,
	from: null,
	to: null,
	q: '',
	market: null
};

const FILTER_PARAMS = ['coffee', 'batch', 'range', 'from', 'to', 'q', 'market'] as const;

/** A calendar day as a link or a query carries it, `YYYY-MM-DD`, or null when the text is not one. */
export function parseRoastDay(value: string | null | undefined): string | null {
	const text = value?.trim();
	const parts = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!text || !parts) return null;
	const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
	// A day the calendar does not have, such as February 30, is not a filter.
	return date.toISOString().slice(0, 10) === text ? text : null;
}

/** Read the roast list's filters from its address. A value that cannot be read is no filter. */
export function readRoastListFilters(searchParams: URLSearchParams): RoastListFilters {
	const rangeParam = searchParams.get('range');
	const range = ROAST_RANGES.find((option) => option.value === rangeParam)?.value ?? null;
	const market = searchParams.get('market');
	return {
		coffee: readCoffeeFilter(searchParams),
		batch: readBatchFilter(searchParams),
		range,
		from: range ? null : parseRoastDay(searchParams.get('from')),
		to: range ? null : parseRoastDay(searchParams.get('to')),
		q: searchParams.get('q')?.trim() ?? '',
		market: market === 'retail' || market === 'wholesale' ? market : null
	};
}

/**
 * The address's query with the filters written into it. Everything else the address
 * carries, such as the open roast, is kept.
 */
export function writeRoastListFilters(
	filters: RoastListFilters,
	searchParams: URLSearchParams
): URLSearchParams {
	const next = new URLSearchParams(searchParams);
	for (const name of FILTER_PARAMS) next.delete(name);
	const written = new URLSearchParams(roastListHref(filters).split('?')[1] ?? '');
	for (const [name, value] of written) next.set(name, value);
	return next;
}

export function hasRoastListFilters(filters: RoastListFilters): boolean {
	return (
		filters.coffee !== null ||
		filters.batch !== null ||
		filters.range !== null ||
		filters.from !== null ||
		filters.to !== null ||
		filters.q !== '' ||
		filters.market !== null
	);
}

/** One value per combination of filters, to tell when the list has to be asked for again. */
export function roastListFilterKey(filters: RoastListFilters): string {
	return roastListHref(filters);
}

function localDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The first roast day a date preset includes, on the member's own calendar. "Last 7 days"
 * reaches back to the same weekday last week, so a roast from a week ago is in it.
 */
export function roastRangeStart(range: RoastRange, today: Date): string {
	if (range === 'ytd') return `${today.getFullYear()}-01-01`;
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
	return localDay(start);
}

/** The roast days the filters cover. Either end is null when it is open. */
export function roastListDates(
	filters: Pick<RoastListFilters, 'range' | 'from' | 'to'>,
	today: Date
): { start: string | null; end: string | null } {
	if (filters.range) return { start: roastRangeStart(filters.range, today), end: null };
	return { start: filters.from, end: filters.to };
}

/**
 * The query the roast list route is asked with: every filter in force and one page.
 * `market` becomes `is_wholesale`, and a date preset becomes the day it starts on. With no
 * page, the route returns every roast the filters match.
 */
export function roastListQuery(
	filters: RoastListFilters,
	page: { limit: number; offset: number } | null,
	today: Date
): URLSearchParams {
	const query = new URLSearchParams();
	if (filters.coffee !== null) query.set('coffee_id', String(filters.coffee));
	if (filters.batch !== null) query.set('batch_id', filters.batch);
	const dates = roastListDates(filters, today);
	if (dates.start) query.set('date_start', dates.start);
	if (dates.end) query.set('date_end', dates.end);
	if (filters.q) query.set('q', filters.q);
	if (filters.market) query.set('is_wholesale', String(filters.market === 'wholesale'));
	if (page) {
		query.set('limit', String(page.limit));
		query.set('offset', String(page.offset));
	}
	return query;
}

/** A page is the last one when it reaches the number of roasts the filters match. */
export function isLastRoastPage(offset: number, rows: number, matchingRoasts: number): boolean {
	return offset + rows >= matchingRoasts;
}

function datePhrase(filters: RoastListFilters): string | null {
	const preset = ROAST_RANGES.find((option) => option.value === filters.range);
	if (preset) return preset.phrase;
	const from = formatDay(filters.from);
	const to = formatDay(filters.to);
	if (from && to) return from === to ? `on ${from}` : `from ${from} to ${to}`;
	if (from) return `since ${from}`;
	return to ? `up to ${to}` : null;
}

/**
 * What the filters in force left out, said under "No roasts match.": "Nothing was roasted
 * in the last 7 days for Ethiopia Yirgacheffe Wush Wush." A search or a retail or wholesale
 * choice leads the sentence: "No wholesale roasts match “guji” this year."
 */
export function roastListEmptyDetail(
	filters: RoastListFilters,
	names: { coffee?: string | null; batch?: string | null } = {}
): string {
	if (!hasRoastListFilters(filters)) return '';

	// A batch named on its own holds every one of its roasts, so an empty list means it has none.
	if (!hasRoastListFilters({ ...filters, batch: null })) {
		return 'That batch has no roasts. It may have been deleted.';
	}

	const market = filters.market ? `${filters.market} ` : '';
	const parts = [
		filters.q
			? `No ${market}roasts match “${filters.q}”`
			: market
				? `No ${market}roasts`
				: 'Nothing was roasted'
	];
	const dates = datePhrase(filters);
	if (dates) parts.push(dates);
	if (filters.coffee !== null) parts.push(`for ${names.coffee ?? 'this coffee'}`);
	if (filters.batch !== null) parts.push(`in ${names.batch ?? 'that batch'}`);
	return `${parts.join(' ')}.`;
}
