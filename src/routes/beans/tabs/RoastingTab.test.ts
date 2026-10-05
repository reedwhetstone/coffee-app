import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryWithCatalog } from '$lib/types/component.types';
import RoastingTab from './RoastingTab.svelte';

const coffee = {
	id: 101,
	purchased_qty_lbs: 10,
	roast_profiles: []
} as unknown as InventoryWithCatalog;

// The plan's five roasts of one coffee, as the roast list returns them.
const roasts = [
	{
		roast_id: 4531,
		coffee_id: 101,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		oz_in: 16,
		oz_out: 13.7,
		weight_loss_percent: 14.4,
		total_roast_time: 618,
		drop_temp: 402,
		development_percent: 19.4,
		temperature_unit: 'F'
	},
	{
		roast_id: 4529,
		coffee_id: 101,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		oz_in: 12,
		oz_out: null,
		weight_loss_percent: null,
		total_roast_time: 596,
		drop_temp: 398,
		development_percent: 17.4,
		temperature_unit: 'F'
	},
	{
		roast_id: 4528,
		coffee_id: 101,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		oz_in: 12,
		oz_out: 10.4,
		weight_loss_percent: 13.3,
		total_roast_time: 640,
		drop_temp: 407,
		development_percent: 21.9,
		temperature_unit: 'F'
	},
	{
		roast_id: 4507,
		coffee_id: 101,
		batch_name: 'Wednesday roast',
		roast_date: '2026-09-17',
		oz_in: 16,
		oz_out: 13.8,
		weight_loss_percent: 13.7,
		total_roast_time: 605,
		drop_temp: 400,
		development_percent: 18.3,
		temperature_unit: 'F'
	},
	{
		roast_id: 4480,
		coffee_id: 101,
		batch_name: 'First Guji',
		roast_date: '2026-08-30',
		oz_in: 8,
		oz_out: 6.9,
		weight_loss_percent: 13.7,
		total_roast_time: 580,
		drop_temp: 395,
		development_percent: 17.2,
		temperature_unit: 'F'
	}
];

function respondWith(data: unknown, status = 200) {
	vi.mocked(fetch).mockImplementation(
		async () => new Response(JSON.stringify({ data }), { status })
	);
}

function renderTab(props: Record<string, unknown> = {}) {
	const onStartNewRoast = vi.fn();
	render(RoastingTab, { selectedBean: coffee, role: 'member', onStartNewRoast, ...props });
	return { onStartNewRoast };
}

/** The text of each cell in a table row, phone-only labels removed. */
function cellsOf(row: HTMLElement): string[] {
	return within(row)
		.getAllByRole('cell')
		.map((cell) => {
			const copy = cell.cloneNode(true) as HTMLElement;
			copy.querySelectorAll('.sr-only, .sm\\:hidden').forEach((hidden) => hidden.remove());
			return copy.textContent?.replace(/\s+/g, ' ').trim() ?? '';
		});
}

async function dataRows(): Promise<HTMLElement[]> {
	const table = await screen.findByRole('table', { name: /Roasts of this coffee/ });
	return within(table).getAllByRole('row').slice(1);
}

describe('portfolio Roasting tab', () => {
	beforeEach(() => {
		vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
		vi.stubGlobal('fetch', vi.fn());
		respondWith(roasts);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("reads this coffee's roasts from the roast list", async () => {
		renderTab();

		await dataRows();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/roast-profiles?coffee_id=101');
	});

	it('shows the summary line', async () => {
		renderTab();

		expect(await screen.findByRole('heading', { name: 'Roasts of this coffee' })).toBeTruthy();
		expect(
			await screen.findByText('5 roasts · 64 oz roasted · 6.0 lb left · 13.8% average loss')
		).toBeTruthy();
	});

	it('lists date, batch, weights, loss, time, drop, and development, newest first', async () => {
		renderTab();

		const table = await screen.findByRole('table', { name: /Roasts of this coffee/ });
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((header) => header.textContent?.trim())
		).toEqual(['Compare', 'Date', 'Batch', 'In → out', 'Loss', 'Time', 'Drop', 'Dev']);

		const rows = await dataRows();
		expect(rows.map((row) => cellsOf(row).slice(1, 8))).toEqual([
			['Oct 1', 'Wednesday roast', '16 → 13.7 oz', '14.4%', '10:18', '402°F', '19.4%'],
			['Sep 27', 'Guji drop test', '12 oz', '—', '9:56', '398°F', '17.4%'],
			['Sep 27', 'Guji drop test', '12 → 10.4 oz', '13.3%', '10:40', '407°F', '21.9%'],
			['Sep 17', 'Wednesday roast', '16 → 13.8 oz', '13.7%', '10:05', '400°F', '18.3%'],
			['Aug 30', 'First Guji', '8 → 6.9 oz', '13.7%', '9:40', '395°F', '17.2%']
		]);
	});

	it('shows "—" for values that were not recorded, never zero', async () => {
		respondWith([
			{
				roast_id: 4600,
				coffee_id: 101,
				batch_name: null,
				roast_date: '2026-10-02',
				oz_in: 0,
				oz_out: 0,
				weight_loss_percent: 0,
				total_roast_time: 0,
				drop_temp: null,
				development_percent: 0
			}
		]);
		renderTab();

		const [row] = await dataRows();
		expect(cellsOf(row).slice(1, 8)).toEqual(['Oct 2', '—', '—', '—', '—', '—', '—']);
		expect(row.textContent).not.toMatch(/\b0(\.0)?\s?(%|°|oz)/);
		// Nothing was weighed in, so the purchase is still all there and no loss is averaged.
		expect(screen.getByText('1 roast · 10.0 lb left')).toBeTruthy();
	});

	it('says how the newest roast differs from the one before it, under the newest row', async () => {
		renderTab();

		const [newest, previous] = await dataRows();
		expect(within(newest).getByText('22 sec longer · 4°F hotter drop than Sep 27')).toBeTruthy();
		expect(within(previous).queryByText(/longer|shorter|hotter|cooler/)).toBeNull();
	});

	it('says nothing about a difference when there is only one roast', async () => {
		respondWith(roasts.slice(0, 1));
		renderTab();

		await dataRows();
		expect(screen.queryByText(/longer|shorter|hotter|cooler|Same time/)).toBeNull();
	});

	it('links each row to its roast, inside the app', async () => {
		renderTab();

		const rows = await dataRows();
		const links = rows.map((row) => within(row).getByRole('link'));
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/roast?roast=4531',
			'/roast?roast=4529',
			'/roast?roast=4528',
			'/roast?roast=4507',
			'/roast?roast=4480'
		]);
		expect(links[0].textContent).toContain('Oct 1');
		// A plain link: the app's router follows it without reloading the page.
		for (const link of links) {
			expect(link.hasAttribute('target')).toBe(false);
			expect(link.hasAttribute('data-sveltekit-reload')).toBe(false);
			expect(link.hasAttribute('rel')).toBe(false);
		}
	});

	it('offers Compare once two rows are ticked, newer roast as side A', async () => {
		renderTab();

		await dataRows();
		expect(screen.getByText('Tick two roasts to compare them.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

		// Ticked oldest first; the link still puts the newer roast first.
		await fireEvent.click(screen.getByRole('checkbox', { name: /roast #4507/ }));
		expect(screen.getByText('1 selected')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('checkbox', { name: /roast #4531/ }));
		expect(screen.getByText('2 selected')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Compare' }).getAttribute('href')).toBe(
			'/roast/compare?a=roast:4531&b=roast:4507'
		);
	});

	it('keeps two rows ticked at most, dropping the earliest tick', async () => {
		renderTab();

		await dataRows();
		const tick = (roastId: number) =>
			screen.getByRole('checkbox', { name: `Compare roast #${roastId}, ${dateOf(roastId)}` });
		await fireEvent.click(tick(4507));
		await fireEvent.click(tick(4531));
		await fireEvent.click(tick(4528));

		expect((tick(4507) as HTMLInputElement).checked).toBe(false);
		expect((tick(4531) as HTMLInputElement).checked).toBe(true);
		expect((tick(4528) as HTMLInputElement).checked).toBe(true);
		expect(screen.getByRole('link', { name: 'Compare' }).getAttribute('href')).toBe(
			'/roast/compare?a=roast:4531&b=roast:4528'
		);

		await fireEvent.click(tick(4531));
		expect(screen.getByText('1 selected')).toBeTruthy();
		expect(screen.queryByRole('link', { name: 'Compare' })).toBeNull();
	});

	it('links to this coffee in Roasts and starts a roast of it', async () => {
		const { onStartNewRoast } = renderTab();

		await dataRows();
		expect(screen.getByRole('link', { name: /See all in Roasts/ }).getAttribute('href')).toBe(
			'/roast?coffee=101'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Roast this coffee' }));
		expect(onStartNewRoast).toHaveBeenCalledOnce();
	});

	it('says there are no roasts yet and offers to roast the coffee', async () => {
		respondWith([]);
		const { onStartNewRoast } = renderTab();

		expect(await screen.findByText('No roasts of this coffee yet.')).toBeTruthy();
		expect(screen.getByText('Roast it and its history will build here.')).toBeTruthy();
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.queryByRole('link', { name: /See all in Roasts/ })).toBeNull();
		expect(screen.queryByText(/No Roasts Yet|N\/A/)).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Roast this coffee' }));
		expect(onStartNewRoast).toHaveBeenCalledOnce();
	});

	it('says when the roasts could not be loaded and tries again', async () => {
		respondWith(null, 500);
		renderTab();

		expect(await screen.findByText('Roasts could not be loaded.')).toBeTruthy();
		expect(screen.queryByText('No roasts of this coffee yet.')).toBeNull();

		respondWith(roasts);
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		expect(await dataRows()).toHaveLength(5);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('draws no row menu until a page offers links for it', async () => {
		renderTab();

		await dataRows();
		expect(screen.queryByLabelText(/More for roast/)).toBeNull();
	});

	it('draws the row menu from the links it is given', async () => {
		renderTab({
			rowMenu: (roast: { roast_id: number }) => [
				{ label: 'Plan next roast', href: `/roast/plan?from=roast:${roast.roast_id}` }
			]
		});

		const [newest] = await dataRows();
		expect(within(newest).getByLabelText('More for roast #4531')).toBeTruthy();
		expect(
			within(newest)
				.getByRole('link', { name: 'Plan next roast', hidden: true })
				.getAttribute('href')
		).toBe('/roast/plan?from=roast:4531');
	});
});

describe('portfolio Roasting tab without Mallard Studio', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => vi.unstubAllGlobals());

	it.each(['viewer', undefined] as const)(
		'says roast history is part of Mallard Studio (role: %s)',
		async (role) => {
			const onStartNewRoast = vi.fn();
			render(RoastingTab, { selectedBean: coffee, role, onStartNewRoast });

			expect(screen.getByRole('heading', { name: 'Roasts of this coffee' })).toBeTruthy();
			expect(screen.getByText('Roast history is part of Mallard Studio.')).toBeTruthy();
			expect(
				screen.getByText('Log roasts against this coffee, compare them, and plan the next one.')
			).toBeTruthy();
			expect(screen.getByRole('link', { name: 'See Mallard Studio' }).getAttribute('href')).toBe(
				'/subscription?plan=studio-monthly'
			);

			// No roast request, no table, and nothing to roast or compare.
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(fetch).not.toHaveBeenCalled();
			expect(screen.queryByRole('table')).toBeNull();
			expect(screen.queryByRole('button', { name: 'Roast this coffee' })).toBeNull();
			expect(screen.queryByRole('link', { name: /See all in Roasts/ })).toBeNull();
			expect(screen.queryByText(/No roasts|No Roasts Yet/)).toBeNull();
		}
	);
});

describe('portfolio Roasting tab in a shared portfolio', () => {
	beforeEach(() => {
		vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('lists the roasts the share carries, with no links or actions of the viewer’s own', async () => {
		const shared = {
			...coffee,
			roast_profiles: [
				{
					roast_id: 4531,
					batch_name: 'Wednesday roast',
					roast_date: '2026-10-01',
					oz_in: 16,
					oz_out: 13.7,
					weight_loss_percent: 14.4
				}
			]
		} as unknown as InventoryWithCatalog;
		render(RoastingTab, {
			selectedBean: shared,
			role: 'member',
			readOnly: true,
			onStartNewRoast: vi.fn()
		});

		const [row] = await dataRows();
		expect(cellsOf(row).slice(1, 8)).toEqual([
			'Oct 1',
			'Wednesday roast',
			'16 → 13.7 oz',
			'14.4%',
			'—',
			'—',
			'—'
		]);
		expect(fetch).not.toHaveBeenCalled();
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('says a shared coffee has no roasts without offering to roast it', async () => {
		render(RoastingTab, {
			selectedBean: coffee,
			role: 'member',
			readOnly: true,
			onStartNewRoast: vi.fn()
		});

		expect(screen.getByText('No roasts of this coffee yet.')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
		await waitFor(() => expect(fetch).not.toHaveBeenCalled());
	});
});

function dateOf(roastId: number): string {
	return { 4531: 'Oct 1', 4529: 'Sep 27', 4528: 'Sep 27', 4507: 'Sep 17', 4480: 'Aug 30' }[
		roastId
	] as string;
}
