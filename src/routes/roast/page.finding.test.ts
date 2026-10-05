import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import { page } from './__test-fixtures__/reactivePage.svelte';
import { roastListRequests, roastListResponse } from './__test-fixtures__/roastListBackend';
import RoastPage from './+page.svelte';
import { eventEntries, roastData, roastEvents, temperatureEntries } from './stores';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/state', async () => await import('./__test-fixtures__/reactivePage.svelte'));
vi.mock('$app/navigation', () => ({
	goto,
	replaceState: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn()
}));

const ORIGIN = 'http://localhost';
const batchId = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 1,
		batch_id: batchId(1),
		batch_name: 'Wednesday roast',
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		roast_date: '2026-10-01',
		oz_in: 16,
		oz_out: 13.6,
		weight_loss_percent: 15,
		charge_time: 0,
		fc_start_time: 498,
		drop_time: 618,
		total_roast_time: 618,
		is_wholesale: false,
		last_updated: '2026-10-01T12:00:00.000Z',
		...overrides
	} as RoastProfile;
}

const day = (daysBeforeOct5: number) =>
	new Date(Date.UTC(2026, 9, 5 - daysBeforeOct5)).toISOString().slice(0, 10);

// 120 roasts in 60 batches of two, one batch a day going back from October 4, 2026: an
// Ethiopia (14% loss) and a Colombia (16%) each day. Six batches, the newest on September 27,
// are of a wholesale Kenya instead. The older half has no weight out, so no loss.
const history: RoastProfile[] = Array.from({ length: 60 }, (_, index) => {
	const batch = 60 - index;
	const wholesale = batch % 10 === 3;
	const weighed = batch > 30;
	const base = {
		batch_id: batchId(batch),
		batch_name: batch % 7 === 0 ? 'Guji drop test' : 'Daily roast',
		roast_date: day(index + 1),
		...(weighed ? {} : { oz_out: null, weight_loss_percent: null })
	};
	return [
		roast({
			...base,
			roast_id: 5000 + batch * 2,
			weight_loss_percent: weighed ? 14 : null,
			...(wholesale ? { coffee_id: 103, coffee_name: 'Kenya Nyeri AA', is_wholesale: true } : {})
		}),
		roast({
			...base,
			roast_id: 5000 + batch * 2 - 1,
			coffee_id: wholesale ? 103 : 102,
			coffee_name: wholesale ? 'Kenya Nyeri AA' : 'Colombia Sierra Nevada',
			is_wholesale: wholesale,
			weight_loss_percent: weighed ? 16 : null
		})
	];
}).flat();

/** A roast with nothing recorded, so the timer can be started on it. */
const planned = roast({
	roast_id: 6001,
	batch_id: batchId(900),
	batch_name: 'Today',
	roast_date: '2026-10-05',
	oz_out: null,
	weight_loss_percent: null,
	charge_time: null,
	fc_start_time: null,
	drop_time: null,
	total_roast_time: null
});

let listed: RoastProfile[] = history;
let listStatus = 200;
type Sent = { url: string; method: string };
let requests: Sent[] = [];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	const method = init?.method ?? 'GET';
	requests.push({ url, method });
	if (url.startsWith('/api/roast-chart-settings')) return Response.json({ settings: null });
	if (url.startsWith('/api/roast-chart-data')) return Response.json({ series: [], events: [] });
	if (url.startsWith('/api/roast-coffees') || url.startsWith('/api/beans')) {
		return Response.json({
			data: [
				{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush', stocked: true },
				{ id: 102, name: 'Colombia Sierra Nevada', stocked: true },
				{ id: 103, name: 'Kenya Nyeri AA', stocked: false }
			]
		});
	}
	if (url.startsWith('/api/roast-profiles') && method === 'POST') {
		const created = roast({ roast_id: 7001, batch_id: batchId(901), batch_name: 'Next batch' });
		listed = [created, ...listed];
		return Response.json({ profiles: [created], roast_ids: [7001] });
	}
	if (url.startsWith('/api/roast-profiles')) {
		if (listStatus !== 200) return Response.json({ error: 'Failed' }, { status: listStatus });
		return roastListResponse(listed, url);
	}
	return Response.json({ data: [] });
});

const member = {
	isSignedIn: true,
	user: { id: 'member-1', email: 'member@example.com' },
	role: 'member',
	ppiAccess: false
};

function visit(address: string) {
	page.url = new URL(address, ORIGIN);
	(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
		page.url.href
	);
}

function renderPage(data: Record<string, unknown> = {}) {
	return render(RoastPage, { data: { auth: member, ...data } } as never);
}

const listRequests = () => roastListRequests(fetchMock);
const pageRequests = () => listRequests().filter((query) => query.has('limit'));
const lastPageRequest = () => Object.fromEntries(pageRequests().at(-1)!);

const roastRows = () =>
	screen
		.queryAllByRole('button')
		.filter((button) => /ID: \d+/.test(button.textContent ?? ''))
		.map((button) => Number(button.textContent?.match(/ID: (\d+)/)?.[1]));

const listTitle = () => screen.findByRole('heading', { level: 1, name: 'Roasts' });
const search = () => screen.getByRole('searchbox', { name: 'Search roasts' });

async function choose(name: string, value: string) {
	const control = screen.getByRole('combobox', { name }) as HTMLSelectElement;
	control.value = value;
	await fireEvent.change(control);
}

function timerButton() {
	return document.querySelector<HTMLButtonElement>('#start-end-roast');
}

beforeEach(() => {
	vi.clearAllMocks();
	// Monday, October 5, 2026, in the afternoon. Only the clock is held; timers run.
	vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 5, 15, 0) });
	listed = history;
	listStatus = 200;
	requests = [];
	sessionStorage.clear();
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// A filter change rewrites the address in place, as the router does.
	goto.mockImplementation(async (address: string) => visit(address));
	Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
	eventEntries.set([]);
	temperatureEntries.set([]);
	roastData.set([]);
	roastEvents.set([]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('loading the roast list a page at a time', () => {
	it('asks for the first page, not every roast, and counts everything that matches', async () => {
		visit('/roast');
		renderPage();
		await listTitle();

		await waitFor(() => expect(roastRows()).toHaveLength(50));
		expect(lastPageRequest()).toEqual({ limit: '50', offset: '0' });
		// Newest first.
		expect(roastRows().slice(0, 3)).toEqual([5120, 5119, 5118]);
		// The count line is for all 120 roasts, of which 60 have a loss on record.
		expect(screen.getByText('120 roasts in 60 batches · 15.0% average loss')).toBeInTheDocument();
		expect(screen.getByText('Showing 50 of 120 roasts')).toBeInTheDocument();
		// No request asks for the whole list.
		expect(listRequests().every((query) => query.has('limit') || query.has('batch_id'))).toBe(true);
	});

	it('reads the coffee choices from the portfolio alone, not from a request that reads roasts', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await waitFor(() =>
			expect(requests.some((request) => request.url === '/api/roast-coffees')).toBe(true)
		);
		// The portfolio route reads every roast to describe each coffee; the list does not call it.
		expect(requests.some((request) => request.url.startsWith('/api/beans'))).toBe(false);
	});

	it('loads the next pages on "Load more" and stops at the last one', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
		await waitFor(() => expect(roastRows()).toHaveLength(100));
		expect(lastPageRequest()).toEqual({ limit: '50', offset: '50' });
		expect(screen.getByText('Showing 100 of 120 roasts')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
		await waitFor(() => expect(roastRows()).toHaveLength(120));
		expect(lastPageRequest()).toEqual({ limit: '50', offset: '100' });
		// 100 + 20 reaches the 120 the totals name, so this was the last page.
		expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
		expect(new Set(roastRows()).size).toBe(120);
		// The totals did not change with the pages.
		expect(screen.getByText('120 roasts in 60 batches · 15.0% average loss')).toBeInTheDocument();
	});

	it('finishes the batch a page ends partway through', async () => {
		// One more roast today shifts every page by one, so page one ends on the first roast
		// of a batch of two.
		listed = [planned, ...history];
		visit('/roast');
		renderPage();
		await listTitle();

		await waitFor(() => expect(roastRows()).toHaveLength(51));
		const lastBatch = screen.getAllByRole('button', { name: /Toggle .* batch/ }).at(-1)!;
		expect(lastBatch).toHaveTextContent('2 roasts');
		expect(screen.getByText('Showing 51 of 121 roasts')).toBeInTheDocument();

		// The next page starts where the first one ended, and the roast already shown is not repeated.
		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
		await waitFor(() => expect(roastRows()).toHaveLength(101));
		expect(lastPageRequest()).toMatchObject({ offset: '50' });
		expect(new Set(roastRows()).size).toBe(101);
	});

	it('uses the first page the server sent with the page, and asks for nothing again', async () => {
		visit('/roast?coffee=101');
		renderPage({
			initialRoastsKey: '/roast?coffee=101',
			initialRoasts: Promise.resolve({
				data: await roastListResponse(history, '/api/roast-profiles?coffee_id=101&limit=50').json(),
				error: null
			})
		});
		await listTitle();

		await waitFor(() => expect(roastRows()).toHaveLength(50));
		expect(pageRequests()).toEqual([]);
		expect(screen.getByText('54 roasts in 54 batches · 14.0% average loss')).toBeInTheDocument();
	});

	it('asks again when the first page the server sent is for other filters, or failed', async () => {
		visit('/roast?coffee=101');
		renderPage({
			initialRoastsKey: '/roast',
			initialRoasts: Promise.resolve({ data: null, error: 'Failed to load data (500)' })
		});

		await waitFor(() => expect(roastRows()).toHaveLength(50));
		expect(lastPageRequest()).toEqual({ coffee_id: '101', limit: '50', offset: '0' });
	});

	it('says the roasts could not be loaded, keeps the controls, and loads them on "Try again"', async () => {
		listStatus = 500;
		visit('/roast?q=guji');
		renderPage();
		await listTitle();

		expect(await screen.findByRole('alert')).toHaveTextContent('Roasts could not be loaded.');
		expect(search()).toHaveValue('guji');
		expect(screen.queryByText('No roasts match.')).toBeNull();

		listStatus = 200;
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(roastRows()).toHaveLength(16));
		expect(screen.queryByRole('alert')).toBeNull();
	});
});

describe('filters on the roast list', () => {
	it('searches coffee, batch, and roast number through the list request', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await fireEvent.input(search(), { target: { value: 'guji' } });
		await fireEvent.keyDown(search(), { key: 'Enter' });

		expect(goto).toHaveBeenLastCalledWith('/roast?q=guji', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		await waitFor(() => expect(lastPageRequest()).toEqual({ q: 'guji', limit: '50', offset: '0' }));
		// Eight batches are named "Guji drop test".
		await waitFor(() => expect(roastRows()).toHaveLength(16));
		expect(screen.getByText('16 roasts in 8 batches · 15.0% average loss')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();

		await fireEvent.input(search(), { target: { value: '#5120' } });
		await fireEvent.keyDown(search(), { key: 'Enter' });
		await waitFor(() => expect(roastRows()).toEqual([5120]));
		expect(screen.getByText('1 roast in 1 batch · 14.0% average loss')).toBeInTheDocument();
	});

	it('narrows to one coffee from the coffee control', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));
		await waitFor(() =>
			expect(
				within(screen.getByRole('combobox', { name: 'Coffee' })).getAllByRole('option')
			).toHaveLength(4)
		);

		await choose('Coffee', '103');

		expect(goto).toHaveBeenLastCalledWith('/roast?coffee=103', expect.anything());
		await waitFor(() => expect(roastRows()).toHaveLength(12));
		expect(lastPageRequest()).toEqual({ coffee_id: '103', limit: '50', offset: '0' });
		// Its chip names it, from the portfolio, and removing the chip shows every coffee again.
		const chip = screen.getByRole('button', { name: 'Show roasts of every coffee' });
		expect(chip.parentElement).toHaveTextContent('Kenya Nyeri AA');
		await fireEvent.click(chip);
		expect(goto).toHaveBeenLastCalledWith('/roast', expect.anything());
		await waitFor(() => expect(roastRows()).toHaveLength(50));
	});

	it.each([
		['7d', '2026-09-28', 14],
		['30d', '2026-09-05', 50],
		['ytd', '2026-01-01', 50]
	])('turns the %s date preset into the day it starts on', async (range, start, shown) => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await choose('Roast date', range);

		expect(goto).toHaveBeenLastCalledWith(`/roast?range=${range}`, expect.anything());
		await waitFor(() =>
			expect(lastPageRequest()).toEqual({ date_start: start, limit: '50', offset: '0' })
		);
		await waitFor(() => expect(roastRows()).toHaveLength(shown));
	});

	it('finds last week’s roasts in two steps: the date preset, then the roast', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await choose('Roast date', '7d');
		await waitFor(() => expect(roastRows()).toHaveLength(14));
		expect(screen.getByText('14 roasts in 7 batches · 15.0% average loss')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /ID: 5108/ }));

		await screen.findByRole('link', { name: '← Roasts' });
		// The roast opens over the filtered list, and "← Roasts" returns to it.
		expect(goto).toHaveBeenLastCalledWith('/roast?range=7d&roast=5108', expect.anything());
		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute(
			'href',
			'/roast?range=7d'
		);
	});

	it('sends a first and last day from a link as they are', async () => {
		visit('/roast?from=2026-09-01&to=2026-09-03');
		renderPage();
		await listTitle();

		await waitFor(() => expect(roastRows()).toHaveLength(6));
		expect(lastPageRequest()).toEqual({
			date_start: '2026-09-01',
			date_end: '2026-09-03',
			limit: '50',
			offset: '0'
		});
		expect(screen.getByRole('combobox', { name: 'Roast date' })).toHaveValue('custom');
		expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
	});

	it('filters to wholesale and to retail through the list request, and All sends neither', async () => {
		visit('/roast');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await fireEvent.click(screen.getByRole('button', { name: 'Wholesale' }));
		expect(goto).toHaveBeenLastCalledWith('/roast?market=wholesale', expect.anything());
		await waitFor(() => expect(roastRows()).toHaveLength(12));
		expect(lastPageRequest()).toEqual({ is_wholesale: 'true', limit: '50', offset: '0' });
		expect(screen.getByText('12 roasts in 6 batches · 15.0% average loss')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Retail' }));
		expect(goto).toHaveBeenLastCalledWith('/roast?market=retail', expect.anything());
		await waitFor(() =>
			expect(lastPageRequest()).toEqual({ is_wholesale: 'false', limit: '50', offset: '0' })
		);
		await waitFor(() => expect(screen.getByText(/^108 roasts in 54 batches/)).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'All' }));
		expect(goto).toHaveBeenLastCalledWith('/roast', expect.anything());
		await waitFor(() => expect(lastPageRequest()).toEqual({ limit: '50', offset: '0' }));
	});

	it('reads every filter from a shared link, shows it in the controls, and asks for it', async () => {
		visit('/roast?coffee=102&range=30d&q=daily&market=retail');
		renderPage();
		await listTitle();

		await waitFor(() =>
			expect(lastPageRequest()).toEqual({
				coffee_id: '102',
				date_start: '2026-09-05',
				q: 'daily',
				is_wholesale: 'false',
				limit: '50',
				offset: '0'
			})
		);
		expect(search()).toHaveValue('daily');
		expect(screen.getByRole('combobox', { name: 'Roast date' })).toHaveValue('30d');
		expect(screen.getByRole('button', { name: 'Retail' })).toHaveAttribute('aria-pressed', 'true');
		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: 'Coffee' })).toHaveValue('102')
		);
	});

	it('loads the list an address change names, as Back or a link within the page does', async () => {
		visit('/roast?q=guji');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(16));

		visit('/roast?market=wholesale');

		await waitFor(() => expect(roastRows()).toHaveLength(12));
		expect(search()).toHaveValue('');
		expect(screen.getByRole('button', { name: 'Wholesale' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('keeps "Load more" on the filters in force', async () => {
		visit('/roast?market=retail');
		renderPage();
		await waitFor(() => expect(roastRows()).toHaveLength(50));

		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

		await waitFor(() => expect(roastRows()).toHaveLength(100));
		expect(lastPageRequest()).toEqual({ is_wholesale: 'false', limit: '50', offset: '50' });
	});

	it('says no roasts match, names the filters, and clears them', async () => {
		visit('/roast?range=7d&coffee=103');
		renderPage();
		await listTitle();

		expect(await screen.findByRole('heading', { name: 'No roasts match.' })).toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByText('Nothing was roasted in the last 7 days for Kenya Nyeri AA.')
			).toBeInTheDocument()
		);
		expect(screen.queryByText('No roasts yet.')).toBeNull();
		expect(screen.queryByText(/average loss/)).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

		expect(goto).toHaveBeenLastCalledWith(
			'/roast',
			expect.objectContaining({ replaceState: true })
		);
		await waitFor(() => expect(roastRows()).toHaveLength(50));
	});

	it('says there are no roasts yet only when no filter is in force', async () => {
		listed = [];
		visit('/roast');
		renderPage();

		expect(await screen.findByRole('heading', { name: 'No roasts yet.' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
	});

	it('explains a search that cannot be used, without calling it a failure', async () => {
		visit(`/roast?q=${'x'.repeat(101)}&market=retail`);
		renderPage();
		await listTitle();

		expect(
			await screen.findByRole('heading', { name: 'That search cannot be used.' })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Search for a coffee, a batch, or a roast number, in 100 characters or fewer.'
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Roasts could not be loaded.')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

		// The search goes; the other filter stays.
		expect(goto).toHaveBeenLastCalledWith('/roast?market=retail', expect.anything());
		await waitFor(() => expect(roastRows()).toHaveLength(50));
	});

	it('names the whole batch in its chip when another filter narrows what is shown', async () => {
		// Batch 60 holds roasts 5120 and 5119; only 5119 is of coffee 102.
		visit(`/roast?batch=${batchId(60)}&coffee=102`);
		renderPage();
		await listTitle();

		await waitFor(() => expect(roastRows()).toEqual([5119]));
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Show every batch' }).parentElement
			).toHaveTextContent('Oct 4 · Daily roast')
		);
		expect(lastPageRequest()).toEqual({
			coffee_id: '102',
			batch_id: batchId(60),
			limit: '50',
			offset: '0'
		});
	});
});

describe('what an open roast needs, asked for on its own', () => {
	it('opens a roast by link that the first page does not hold, with the rest of its batch', async () => {
		// Roast 5002 is the oldest: page three of the list.
		visit('/roast?roast=5002');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' });
		expect(listRequests().some((query) => query.get('roast_id') === '5002')).toBe(true);
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Colombia Sierra Nevada #5001' })
			).toBeInTheDocument()
		);
		expect(listRequests().some((query) => query.get('batch_id') === batchId(1))).toBe(true);
	});

	it('opens a roast by link that the filters in the address leave out', async () => {
		visit('/roast?market=wholesale&roast=5120');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' });
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Colombia Sierra Nevada #5119' })
			).toBeInTheDocument()
		);
		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute(
			'href',
			'/roast?market=wholesale'
		);
	});

	it('shows the list when the link names a roast the account does not have', async () => {
		visit('/roast?roast=99999');
		renderPage();

		await listTitle();
		await waitFor(() => expect(roastRows()).toHaveLength(50));
	});

	it('steps to another roast of the batch and reads that batch once more', async () => {
		visit('/roast?roast=5002');
		renderPage();
		const sibling = await screen.findByRole('button', { name: 'Colombia Sierra Nevada #5001' });
		await new Promise((resolve) => setTimeout(resolve, 150));

		await fireEvent.click(sibling);

		await screen.findByRole('heading', { level: 1, name: 'Colombia Sierra Nevada' });
		expect(
			await screen.findByRole('button', { name: 'Ethiopia Yirgacheffe Wush Wush #5002' })
		).toBeInTheDocument();
	});

	it('opens a new roast that the filters in force leave out', async () => {
		visit('/roast?q=kenya&modal=new&beanId=101&beanName=Ethiopia%20Yirgacheffe%20Wush%20Wush');
		renderPage();
		await listTitle();
		await fireEvent.input(await screen.findByLabelText('Batch Name'), {
			target: { value: 'Next batch' }
		});

		await fireEvent.submit(document.querySelector('form')!);

		// The new Ethiopia roast is not a match for "kenya", and it opens all the same.
		await screen.findByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' });
		expect(listRequests().some((query) => query.get('roast_id') === '7001')).toBe(true);
		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute(
			'href',
			'/roast?q=kenya'
		);
	});
});

describe('a roast that is recording', () => {
	async function startRecording() {
		listed = [planned, ...history];
		visit('/roast?roast=6001');
		renderPage();
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
		await new Promise((resolve) => setTimeout(resolve, 150));
		await fireEvent.click(timerButton()!);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Stop'));
		await fireEvent.click(screen.getAllByRole('button', { name: 'Charge' })[0]);
	}

	it('keeps recording when the filters in the address change', async () => {
		await startRecording();
		const events = get(eventEntries);
		const readings = get(temperatureEntries);
		expect(events.map((entry) => entry.event_string)).toContain('charge');
		const pagesBefore = pageRequests().length;

		// Back, a link, or the address bar changes every filter under the open roast.
		visit('/roast?roast=6001&range=7d&q=daily&market=retail&coffee=102');

		// The list for the new filters loads behind the roast.
		await waitFor(() => expect(pageRequests().length).toBe(pagesBefore + 1));
		expect(lastPageRequest()).toEqual({
			coffee_id: '102',
			date_start: '2026-09-28',
			q: 'daily',
			is_wholesale: 'false',
			limit: '50',
			offset: '0'
		});
		await new Promise((resolve) => setTimeout(resolve, 50));

		// The roast is still open and still recording, with everything it had logged.
		expect(timerButton()).toHaveTextContent('Stop');
		expect(get(eventEntries)).toEqual(events);
		expect(get(temperatureEntries)).toEqual(readings);
		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(screen.queryByRole('heading', { level: 1, name: 'Roasts' })).toBeNull();
	});

	it('keeps recording when the list behind it cannot be loaded', async () => {
		await startRecording();
		const events = get(eventEntries);

		listStatus = 500;
		visit('/roast?roast=6001&q=guji');
		await waitFor(() =>
			expect(pageRequests().some((query) => query.get('q') === 'guji')).toBe(true)
		);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(timerButton()).toHaveTextContent('Stop');
		expect(get(eventEntries)).toEqual(events);
	});
});
