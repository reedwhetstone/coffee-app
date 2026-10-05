import { legacyPortfolioPage } from '$lib/server/portfolioPage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from './__test-fixtures__/reactivePage.svelte';
import BeansPage from './+page.svelte';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/state', async () => await import('./__test-fixtures__/reactivePage.svelte'));
vi.mock('$app/navigation', () => ({ goto }));

const ORIGIN = 'https://purveyors.io';
const member = {
	isSignedIn: true,
	user: { id: 'owner', email: null },
	role: 'member' as const,
	ppiAccess: true
};
// Parchment Intelligence without Mallard Studio: portfolio opens, roasting does not.
const intelligenceOnly = { ...member, role: 'viewer' as const };

const coffee = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
	id,
	stocked: true,
	purchased_qty_lbs: 10,
	bean_cost: 50,
	tax_ship_cost: 5,
	purchase_date: '2026-07-28',
	last_updated: '2026-10-01T15:00:00Z',
	rank: null,
	notes: null,
	cupping_notes: null,
	catalog_id: id,
	coffee_catalog: { id, name, source: 'Supplier A', country: 'Ethiopia' },
	roasted_oz_in: 64,
	roast_profiles: [],
	...extra
});
const guji = coffee(7, 'Ethiopia Guji', { roast_count: 5, last_roast_date: '2026-10-01' });
const huila = coffee(8, 'Colombia Huila', { roast_count: 0, last_roast_date: null });
// Finished and unstocked, so it is not among the cards on screen.
const finished = coffee(99, 'Kenya Nyeri', { stocked: false });

const WEDNESDAY_BATCH = 'aaaaaaaa-0000-4000-8000-000000000001';

const gujiRoasts = [
	{
		roast_id: 4531,
		coffee_id: 7,
		batch_id: WEDNESDAY_BATCH,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		oz_in: 16,
		oz_out: 13.7,
		weight_loss_percent: 14.4,
		total_roast_time: 618,
		drop_temp: 402,
		development_percent: 19.4
	},
	{
		roast_id: 4529,
		coffee_id: 7,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		oz_in: 12,
		oz_out: null,
		weight_loss_percent: null,
		total_roast_time: 596,
		drop_temp: 398,
		development_percent: 17.4
	}
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function respond(input: RequestInfo | URL): Response {
	const url = new URL(String(input), ORIGIN);
	if (url.pathname === '/api/beans/watchlist') return json({ trackedLots: [], trackedCatalog: [] });
	if (url.pathname === '/api/beans') {
		const row = [guji, huila, finished].find(
			(bean) => String(bean.id) === url.searchParams.get('id')
		);
		return row ? json({ data: [row] }) : json({ data: [] });
	}
	if (url.pathname === '/api/roast-profiles') {
		const coffeeId = Number(url.searchParams.get('coffee_id'));
		return json({ data: gujiRoasts.filter((roast) => roast.coffee_id === coffeeId) });
	}
	return json({});
}

function renderPortfolio(address: string, auth: typeof member | typeof intelligenceOnly = member) {
	page.url = new URL(address, ORIGIN);
	const portfolio = legacyPortfolioPage([guji, huila], {
		filters: { stocked: 'TRUE' },
		sortField: 'purchase_date',
		sortDirection: 'desc',
		limit: 50,
		offset: 0
	});
	return render(BeansPage, {
		data: { auth, purchases: Promise.resolve({ ...portfolio, error: null }) }
	});
}

/** What the page last wrote to the address, and whether it added a history entry. */
function lastWrite(): { address: string; addsEntry: boolean } {
	const [address, options] = goto.mock.calls.at(-1) as [string, { replaceState?: boolean }];
	return { address, addsEntry: options.replaceState !== true };
}

const panel = () => screen.queryByRole('dialog');
const openTab = () =>
	within(screen.getByRole('tablist', { name: 'Coffee detail tabs' }))
		.getByRole('tab', {
			selected: true
		})
		.textContent?.trim();

describe('/beans?coffee=&tab= round trip', () => {
	beforeEach(() => {
		vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
		vi.clearAllMocks();
		// The address follows what the page writes, as the app's router makes it.
		goto.mockImplementation(async (address: string) => {
			page.url = new URL(address, ORIGIN);
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => respond(input))
		);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('offers "Log sale" in a roast\'s row menu, with the coffee, batch, and roast filled in', async () => {
		renderPortfolio('/beans?coffee=7&tab=roasting');

		const dialog = await screen.findByRole('dialog');
		const menu = await within(dialog).findByLabelText('More for roast #4531');
		expect(
			within(menu.closest('details')!)
				.getByRole('link', { name: 'Log sale', hidden: true })
				.getAttribute('href')
		).toBe(`/profit?modal=new&coffee=7&batch=${WEDNESDAY_BATCH}&roast=4531`);
		// A roast whose batch is not known by its ID has no sale to offer.
		expect(within(dialog).queryByLabelText('More for roast #4529')).toBeNull();
	});

	it('opens the linked coffee on the linked tab', async () => {
		renderPortfolio('/beans?coffee=7&tab=roasting');

		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByRole('heading', { name: 'Ethiopia Guji' })).toBeTruthy();
		await within(dialog).findByRole('heading', { name: 'Roasts of this coffee' });
		expect(openTab()).toBe('Roasting');
		expect(
			await within(dialog).findByText('22 sec longer · 4°F hotter drop than Sep 27')
		).toBeTruthy();
		// Reading a link writes nothing back.
		expect(goto).not.toHaveBeenCalled();
	});

	it.each([
		['cupping', 'Cupping'],
		['analytics', 'Analytics'],
		['overview', 'Overview']
	])('opens the %s tab from its link', async (tab, label) => {
		renderPortfolio(`/beans?coffee=7&tab=${tab}`);

		await screen.findByRole('dialog');
		await screen.findByRole('tablist', { name: 'Coffee detail tabs' });
		expect(openTab()).toBe(label);
	});

	it('opens no panel for a plain portfolio link', async () => {
		renderPortfolio('/beans');

		await screen.findByText('Ethiopia Guji');
		expect(panel()).toBeNull();
	});

	it('writes the coffee when a card opens, the tab when it changes, and clears both on close', async () => {
		renderPortfolio('/beans');

		await fireEvent.click(
			await screen.findByRole('button', { name: 'View details for Ethiopia Guji' })
		);
		await screen.findByRole('dialog');
		// Opening a coffee adds a history entry, so Back closes it.
		expect(lastWrite()).toEqual({ address: '/beans?coffee=7', addsEntry: true });

		await fireEvent.click(await screen.findByRole('tab', { name: 'Roasting' }));
		expect(lastWrite()).toEqual({ address: '/beans?coffee=7&tab=roasting', addsEntry: false });
		expect(page.url.search).toBe('?coffee=7&tab=roasting');

		await fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
		expect(lastWrite()).toEqual({ address: '/beans?coffee=7', addsEntry: false });

		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(lastWrite()).toEqual({ address: '/beans', addsEntry: false });
		await waitFor(() => expect(panel()).toBeNull());
	});

	it('reopens the same panel and tab from the address it wrote', async () => {
		const first = renderPortfolio('/beans');
		await fireEvent.click(
			await screen.findByRole('button', { name: 'View details for Ethiopia Guji' })
		);
		await fireEvent.click(await screen.findByRole('tab', { name: 'Roasting' }));
		const written = lastWrite().address;
		first.unmount();
		goto.mockClear();

		renderPortfolio(written);

		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByRole('heading', { name: 'Ethiopia Guji' })).toBeTruthy();
		await screen.findByRole('tablist', { name: 'Coffee detail tabs' });
		expect(openTab()).toBe('Roasting');
		expect(goto).not.toHaveBeenCalled();
	});

	it('follows Back and Forward: the panel closes, reopens, and changes coffee with the address', async () => {
		renderPortfolio('/beans?coffee=7&tab=roasting');
		await screen.findByRole('dialog');

		// Back to the portfolio.
		page.url = new URL('/beans', ORIGIN);
		await waitFor(() => expect(panel()).toBeNull());

		// Forward to another coffee on another tab.
		page.url = new URL('/beans?coffee=8&tab=cupping', ORIGIN);
		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByRole('heading', { name: 'Colombia Huila' })).toBeTruthy();
		await screen.findByRole('tablist', { name: 'Coffee detail tabs' });
		expect(openTab()).toBe('Cupping');
		expect(goto).not.toHaveBeenCalled();
	});

	it('adds one history entry for the panel, however many coffees are opened after it', async () => {
		renderPortfolio('/beans');

		await fireEvent.click(
			await screen.findByRole('button', { name: 'View details for Ethiopia Guji' })
		);
		expect(lastWrite()).toEqual({ address: '/beans?coffee=7', addsEntry: true });

		await fireEvent.click(screen.getByRole('button', { name: 'View details for Colombia Huila' }));
		await waitFor(() =>
			expect(
				within(screen.getByRole('dialog')).getByRole('heading', { name: 'Colombia Huila' })
			).toBeTruthy()
		);
		expect(lastWrite()).toEqual({ address: '/beans?coffee=8', addsEntry: false });
		expect(goto.mock.calls.filter(([, options]) => options.replaceState !== true)).toHaveLength(1);
	});

	it('writes ?tab=bookmarked when the section changes and removes it on the way back', async () => {
		renderPortfolio('/beans');

		await fireEvent.click(await screen.findByRole('tab', { name: 'Bookmarked' }));
		expect(lastWrite()).toEqual({ address: '/beans?tab=bookmarked', addsEntry: false });
		await screen.findByText('No Bookmarked Lots Yet');

		await fireEvent.click(screen.getByRole('tab', { name: 'Purchased' }));
		expect(lastWrite()).toEqual({ address: '/beans', addsEntry: false });
		await screen.findByText('Ethiopia Guji');
	});

	it('keeps other parameters when it writes the open coffee', async () => {
		renderPortfolio('/beans?modal=new');

		await fireEvent.click(
			await screen.findByRole('button', { name: 'View details for Ethiopia Guji' })
		);

		expect(lastWrite().address).toBe('/beans?modal=new&coffee=7');
	});

	it('opens a linked coffee that is not among the cards on screen', async () => {
		renderPortfolio('/beans?coffee=99&tab=roasting');

		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByRole('heading', { name: 'Kenya Nyeri' })).toBeTruthy();
		expect(openTab()).toBe('Roasting');
		expect(screen.queryByRole('button', { name: 'View details for Kenya Nyeri' })).toBeNull();

		await fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
		expect(lastWrite()).toEqual({ address: '/beans', addsEntry: false });
		await waitFor(() => expect(panel()).toBeNull());
	});

	it('opens the portfolio with no panel when the linked coffee is not in it', async () => {
		renderPortfolio('/beans?coffee=12345');

		await screen.findByText('Ethiopia Guji');
		await waitFor(() => expect(lastWrite()).toEqual({ address: '/beans', addsEntry: false }));
		expect(panel()).toBeNull();
	});
});

describe('portfolio cards', () => {
	beforeEach(() => {
		vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
		vi.clearAllMocks();
		goto.mockImplementation(async (address: string) => {
			page.url = new URL(address, ORIGIN);
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => respond(input))
		);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('says what is left, when the coffee was last roasted, and how often', async () => {
		renderPortfolio('/beans');

		expect(
			await screen.findByText(
				'10.0 lb purchased · 6.0 lb remaining · last roasted Oct 1 · 5 roasts'
			)
		).toBeTruthy();
		expect(screen.getByText('10.0 lb purchased · 6.0 lb remaining · not roasted yet')).toBeTruthy();
	});

	it('offers Roast on each card, with the coffee filled in on the new-roast form', async () => {
		renderPortfolio('/beans');

		const roast = await screen.findByRole('link', { name: 'Roast Ethiopia Guji' });
		expect(roast.textContent?.trim()).toBe('Roast');
		expect(roast.getAttribute('href')).toBe('/roast?modal=new&beanId=7&beanName=Ethiopia%20Guji');
	});

	it('puts the cards before "Portfolio by source"', async () => {
		renderPortfolio('/beans');

		const card = await screen.findByRole('button', { name: 'View details for Ethiopia Guji' });
		const bySource = screen.getByRole('heading', { name: 'Portfolio by source' });
		expect(card.compareDocumentPosition(bySource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('uses one tab style in the coffee panel: labeled tabs with no emoji', async () => {
		renderPortfolio('/beans?coffee=7');

		const tabs = within(
			await screen.findByRole('tablist', { name: 'Coffee detail tabs' })
		).getAllByRole('tab');
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
			'Overview',
			'Cupping',
			'Roasting',
			'Analytics'
		]);
	});
});

describe('portfolio without Mallard Studio', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		goto.mockImplementation(async (address: string) => {
			page.url = new URL(address, ORIGIN);
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => respond(input))
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('offers no Roast action and says roast history is part of Mallard Studio', async () => {
		renderPortfolio('/beans?coffee=7&tab=roasting', intelligenceOnly);

		const dialog = await screen.findByRole('dialog');
		expect(
			await within(dialog).findByText('Roast history is part of Mallard Studio.')
		).toBeTruthy();
		expect(within(dialog).getByRole('link', { name: 'See Mallard Studio' })).toBeTruthy();
		expect(screen.queryByRole('link', { name: /^Roast / })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Roast this coffee' })).toBeNull();
		expect(
			vi.mocked(fetch).mock.calls.some(([input]) => String(input).startsWith('/api/roast-profiles'))
		).toBe(false);
	});
});
