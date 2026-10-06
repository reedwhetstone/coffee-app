import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastTimer } from '$lib/roast';
import { groupRoastsByBatch } from '$lib/roast/roast-batches';
import { NO_ROAST_LIST_FILTERS } from '$lib/roast/roast-list-filters';
import type { RoastProfile } from '$lib/types/component.types';
import RoastProfileTabs from './RoastProfileTabs.svelte';

const WEDNESDAY = 'aaaaaaaa-0000-4000-8000-000000000001';
const GUJI_TEST = 'aaaaaaaa-0000-4000-8000-000000000002';
const LAST_WEDNESDAY = 'aaaaaaaa-0000-4000-8000-000000000003';

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 4531,
		batch_id: WEDNESDAY,
		batch_name: 'Wednesday roast',
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		roast_date: '2026-10-01T00:00:00+00:00',
		oz_in: 16,
		oz_out: 13.7,
		weight_loss_percent: 14.4,
		temperature_unit: 'F',
		charge_time: 0,
		charge_temp: 392,
		tp_time: 78,
		dry_end_time: 266,
		fc_start_time: 498,
		drop_time: 618,
		drop_temp: 402,
		total_roast_time: 618,
		development_percent: 19.4,
		data_source: 'artisan_import',
		last_updated: '2026-10-02T12:00:00Z',
		...overrides
	} as RoastProfile;
}

const wushWush = roast({});
const colombia = roast({ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' });
const guji = roast({
	roast_id: 4529,
	batch_id: GUJI_TEST,
	batch_name: 'Guji drop test',
	roast_date: '2026-09-27T00:00:00+00:00'
});
// The same name a week earlier: another batch.
const lastWednesday = roast({
	roast_id: 4521,
	batch_id: LAST_WEDNESDAY,
	roast_date: '2026-09-24T00:00:00+00:00'
});

const batches = groupRoastsByBatch([wushWush, colombia, guji]);

const idleTimer = { isIdle: true } as RoastTimer;

function props(overrides: Record<string, unknown> = {}) {
	return {
		batches,
		collapsedBatches: new Set<string>(),
		currentRoastProfile: null,
		currentProfileIndex: 0,
		// The chart panel is drawn as its loading placeholder; the chart itself is not under test.
		chartComponentLoading: true,
		RoastChartInterface: null,
		countLine: '3 roasts in 2 batches · 14.4% average loss',
		canCreateRoast: true,
		onToggleBatch: vi.fn(),
		onSelectProfile: vi.fn(),
		onProfileUpdate: vi.fn(),
		onProfileDelete: vi.fn(),
		onDeleteBatch: vi.fn(),
		onClearProfile: vi.fn(async () => true),
		onClearFilters: vi.fn(),
		onSaveReference: vi.fn(),
		onProfileRefresh: vi.fn(),
		selectedBean: { name: 'Ethiopia Yirgacheffe Wush Wush' },
		timer: idleTimer,
		fanValue: 8,
		heatValue: 1,
		selectedEvent: null,
		updateFan: vi.fn(),
		updateHeat: vi.fn(),
		saveRoastProfile: vi.fn(),
		clearRoastData: vi.fn(),
		...overrides
	};
}

/** True when `first` comes before `second` in the document. */
function precedes(first: Element, second: Element): boolean {
	return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('roast list', () => {
	it('opens on the title, the count line, and the roasts, with nothing above them', () => {
		const { container } = render(RoastProfileTabs, props());

		const title = screen.getByRole('heading', { level: 1, name: 'Roasts' });
		expect(container.querySelector('h1')).toBe(title);
		expect(screen.getByText('3 roasts in 2 batches · 14.4% average loss')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'New roast' })).toHaveAttribute(
			'href',
			'/roast?modal=new'
		);

		const firstBatch = screen.getByRole('button', { name: /Toggle Wednesday roast batch/ });
		expect(precedes(title, firstBatch)).toBe(true);
		// Nothing but the header sits between the top of the page and the first batch.
		expect(screen.queryByText('Roast studio')).not.toBeInTheDocument();
		expect(screen.queryByText('Browse Profiles')).not.toBeInTheDocument();
	});

	it('shows every batch open, with its roasts, before anything is clicked', () => {
		render(RoastProfileTabs, props());

		for (const batch of ['Wednesday roast', 'Guji drop test']) {
			expect(
				screen.getByRole('button', { name: new RegExp(`Toggle ${batch} batch`) })
			).toHaveAttribute('aria-expanded', 'true');
		}
		expect(screen.getByRole('region', { name: /Roasts in .*Wednesday roast/ })).toBeInTheDocument();
		expect(
			within(screen.getByRole('region', { name: /Roasts in .*Guji drop test/ })).getByText(
				/ID: 4529/
			)
		).toBeInTheDocument();
	});

	it('closes only the batches the roaster closed', async () => {
		const onToggleBatch = vi.fn();
		render(RoastProfileTabs, props({ collapsedBatches: new Set([GUJI_TEST]), onToggleBatch }));

		expect(screen.queryByRole('region', { name: /Roasts in .*Guji drop test/ })).toBeNull();
		expect(screen.getByRole('region', { name: /Roasts in .*Wednesday roast/ })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Toggle Guji drop test batch/ }));
		expect(onToggleBatch).toHaveBeenCalledWith(GUJI_TEST);
	});

	it('heads each batch with its date, on the calendar day it was stored with', () => {
		vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] });
		render(RoastProfileTabs, props());

		expect(
			screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.trim())
		).toEqual(['Oct 1 · Wednesday roast', 'Sep 27 · Guji drop test']);
		expect(screen.getByText('2 roasts')).toBeInTheDocument();
		vi.useRealTimers();
	});

	it('lists two batches that share a name separately, each under its own date', () => {
		vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] });
		render(
			RoastProfileTabs,
			props({ batches: groupRoastsByBatch([wushWush, colombia, guji, lastWednesday]) })
		);

		expect(
			screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.trim())
		).toEqual(['Oct 1 · Wednesday roast', 'Sep 27 · Guji drop test', 'Sep 24 · Wednesday roast']);
		expect(
			screen.getByRole('button', {
				name: 'Toggle Wednesday roast batch, Oct 1, 2026 (2 roasts)'
			})
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'Toggle Wednesday roast batch, Sep 24, 2026 (1 roast)'
			})
		).toBeInTheDocument();
		vi.useRealTimers();
	});

	it('keeps a batch whose roasts span two days as one group, and says which days', () => {
		vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] });
		const afterMidnight = roast({
			roast_id: 4532,
			roast_date: '2026-10-02T00:00:00+00:00'
		});
		render(
			RoastProfileTabs,
			props({ batches: groupRoastsByBatch([afterMidnight, wushWush, colombia, guji]) })
		);

		expect(
			screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.trim())
		).toEqual(['Oct 1 · Wednesday roast', 'Sep 27 · Guji drop test']);
		expect(screen.getByText('3 roasts · Oct 1 to Oct 2')).toBeInTheDocument();
		vi.useRealTimers();
	});

	it('offers "Log sale" on each batch header, with the batch filled in by its ID', () => {
		render(
			RoastProfileTabs,
			props({ batches: groupRoastsByBatch([wushWush, colombia, guji, lastWednesday]) })
		);

		const links = screen.getAllByRole('link', { name: /^Log sale from / });
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			// Two coffees were roasted on Oct 1, so the form asks which one was sold.
			`/profit?modal=new&batch=${WEDNESDAY}`,
			`/profit?modal=new&coffee=101&batch=${GUJI_TEST}`,
			`/profit?modal=new&coffee=101&batch=${LAST_WEDNESDAY}`
		]);
		// A plain link beside the header's toggle, not inside it.
		for (const link of links) {
			expect(link.tagName).toBe('A');
			expect(link.closest('button')).toBeNull();
			expect(link).toHaveTextContent('Log sale');
		}
	});

	it('does not offer "Log sale" to an account that cannot record one', () => {
		render(RoastProfileTabs, props({ canCreateRoast: false }));

		expect(screen.queryByRole('link', { name: /Log sale/ })).toBeNull();
	});

	it('names the batch the list is narrowed to in a chip that can be removed', async () => {
		const onClearBatchFilter = vi.fn();
		render(
			RoastProfileTabs,
			props({
				batches: batches.filter((batch) => batch.id === GUJI_TEST),
				filters: { ...NO_ROAST_LIST_FILTERS, batch: GUJI_TEST },
				batchFilter: { id: GUJI_TEST, label: 'Sep 27 · Guji drop test' },
				onClearBatchFilter
			})
		);

		expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
		const remove = screen.getByRole('button', { name: 'Show every batch' });
		expect(remove.parentElement).toHaveTextContent('Sep 27 · Guji drop test');

		await fireEvent.click(remove);
		expect(onClearBatchFilter).toHaveBeenCalledOnce();
	});

	it('says so when the batch a link names has no roasts', () => {
		render(
			RoastProfileTabs,
			props({
				batches: [],
				countLine: '',
				filters: { ...NO_ROAST_LIST_FILTERS, batch: LAST_WEDNESDAY },
				emptyDetail: 'That batch has no roasts. It may have been deleted.',
				batchFilter: { id: LAST_WEDNESDAY, label: null }
			})
		);

		expect(screen.getByRole('heading', { name: 'No roasts match.' })).toBeInTheDocument();
		expect(
			screen.getByText('That batch has no roasts. It may have been deleted.')
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Show every batch' }).parentElement
		).toHaveTextContent('One batch');
	});

	it('opens a roast when its row is chosen', async () => {
		const onSelectProfile = vi.fn();
		render(RoastProfileTabs, props({ onSelectProfile }));

		await fireEvent.click(screen.getByRole('button', { name: /Colombia Sierra Nevada/ }));

		expect(onSelectProfile).toHaveBeenCalledWith(colombia);
	});

	it('hides the create button from an account that cannot create roasts', () => {
		render(RoastProfileTabs, props({ canCreateRoast: false }));

		expect(screen.queryByRole('link', { name: 'New roast' })).toBeNull();
	});

	it('says there are no roasts yet when the account has none', () => {
		render(RoastProfileTabs, props({ batches: [], countLine: '' }));

		expect(screen.getByRole('heading', { name: 'No roasts yet.' })).toBeInTheDocument();
		expect(
			screen.getByText('Log a roast live or import one from Artisan, and it will appear here.')
		).toBeInTheDocument();
		expect(screen.queryByText(/items in raw data/)).toBeNull();
		expect(screen.queryByText(/batches/)).toBeNull();
	});

	it('says no roasts match, and offers to clear the filters, when filters hide them all', async () => {
		const onClearFilters = vi.fn();
		render(
			RoastProfileTabs,
			props({
				batches: [],
				countLine: '',
				filters: { ...NO_ROAST_LIST_FILTERS, range: '7d', coffee: 101 },
				emptyDetail: 'Nothing was roasted in the last 7 days for Ethiopia Yirgacheffe Wush Wush.',
				onClearFilters
			})
		);

		expect(screen.getByRole('heading', { name: 'No roasts match.' })).toBeInTheDocument();
		expect(
			screen.getByText('Nothing was roasted in the last 7 days for Ethiopia Yirgacheffe Wush Wush.')
		).toBeInTheDocument();
		expect(screen.queryByText('No roasts yet.')).toBeNull();
		// Nothing matches, so there is no count to state.
		expect(screen.queryByText(/average loss/)).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
		expect(onClearFilters).toHaveBeenCalledOnce();
	});
});

describe('finding roasts in the list', () => {
	const listed = (overrides: Record<string, unknown> = {}) =>
		props({ onFiltersChange: vi.fn(), loadedRoasts: 3, matchingRoasts: 3, ...overrides });

	it('puts search, coffee, date, and retail or wholesale on the page, above the roasts', () => {
		render(
			RoastProfileTabs,
			listed({ coffeeOptions: [{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush' }] })
		);

		const search = screen.getByRole('searchbox', { name: 'Search roasts' });
		expect(search).toHaveAttribute('placeholder', 'Coffee, batch, or roast number');
		expect(
			within(screen.getByRole('combobox', { name: 'Coffee' }))
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['All coffees', 'Ethiopia Yirgacheffe Wush Wush']);
		expect(
			within(screen.getByRole('combobox', { name: 'Roast date' }))
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['Any time', 'Last 7 days', 'Last 30 days', 'This year', 'Custom dates']);
		expect(
			within(screen.getByRole('group', { name: 'Retail or wholesale' }))
				.getAllByRole('button')
				.map((button) => button.textContent?.trim())
		).toEqual(['All', 'Retail', 'Wholesale']);
		expect(
			precedes(search, screen.getByRole('button', { name: /Toggle Wednesday roast batch/ }))
		).toBe(true);
	});

	it('shows the filters in force in the controls', () => {
		render(
			RoastProfileTabs,
			listed({
				filters: {
					...NO_ROAST_LIST_FILTERS,
					coffee: 101,
					range: '30d',
					q: 'guji',
					market: 'wholesale'
				},
				coffeeOptions: [{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush' }]
			})
		);

		expect(screen.getByRole('searchbox', { name: 'Search roasts' })).toHaveValue('guji');
		expect(screen.getByRole('combobox', { name: 'Coffee' })).toHaveValue('101');
		expect(screen.getByRole('combobox', { name: 'Roast date' })).toHaveValue('30d');
		expect(screen.getByRole('button', { name: 'Wholesale' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('returns to the list with every filter from an open roast', () => {
		render(
			RoastProfileTabs,
			props({
				currentRoastProfile: wushWush,
				filters: {
					...NO_ROAST_LIST_FILTERS,
					coffee: 101,
					range: '30d',
					q: 'guji',
					market: 'wholesale'
				}
			})
		);

		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute(
			'href',
			'/roast?coffee=101&range=30d&q=guji&market=wholesale'
		);
	});

	it('offers "Load more" while the filters match more roasts than are shown', async () => {
		const onLoadMore = vi.fn();
		render(
			RoastProfileTabs,
			listed({ hasMore: true, loadedRoasts: 50, matchingRoasts: 1257, onLoadMore })
		);

		expect(screen.getByText('Showing 50 of 1,257 roasts')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

		expect(onLoadMore).toHaveBeenCalledOnce();
	});

	it('offers no "Load more" on the last page', () => {
		render(RoastProfileTabs, listed({ hasMore: false }));

		expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
		expect(screen.queryByText(/^Showing/)).toBeNull();
	});

	it('waits while more roasts load, and offers to try again when they do not arrive', async () => {
		const onLoadMore = vi.fn();
		const view = render(
			RoastProfileTabs,
			listed({ hasMore: true, isLoadingMore: true, onLoadMore })
		);
		expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();

		await view.rerender(
			listed({ hasMore: true, isLoadingMore: false, loadMoreFailed: true, onLoadMore })
		);
		expect(screen.getByRole('alert')).toHaveTextContent('More roasts could not be loaded.');
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		expect(onLoadMore).toHaveBeenCalledOnce();
		// The roasts already loaded stay on screen.
		expect(
			screen.getByRole('button', { name: /Toggle Wednesday roast batch/ })
		).toBeInTheDocument();
	});

	it('keeps the roasts on screen, marked busy, while a change of filters loads', () => {
		const { container } = render(RoastProfileTabs, listed({ isRefreshing: true }));

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(
			screen.getByRole('button', { name: /Toggle Wednesday roast batch/ })
		).toBeInTheDocument();
	});

	it('explains a search that cannot be used instead of reporting a failure', async () => {
		const onFiltersChange = vi.fn();
		const filters = { ...NO_ROAST_LIST_FILTERS, q: 'x'.repeat(101), range: '7d' };
		render(
			RoastProfileTabs,
			listed({ batches: [], countLine: '', searchInvalid: true, filters, onFiltersChange })
		);

		expect(
			screen.getByRole('heading', { name: 'That search cannot be used.' })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Search for a coffee, a batch, or a roast number, in 100 characters or fewer.'
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Roasts could not be loaded.')).toBeNull();
		expect(screen.queryByText('No roasts match.')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

		// The other filters stay as they were.
		expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, q: '' });
	});

	it('says the roasts could not be loaded and offers to try again, with the controls still there', async () => {
		const onRetryList = vi.fn();
		render(RoastProfileTabs, listed({ batches: [], countLine: '', listFailed: true, onRetryList }));

		expect(screen.getByRole('alert')).toHaveTextContent('Roasts could not be loaded.');
		expect(screen.queryByText('No roasts yet.')).toBeNull();
		expect(screen.getByRole('searchbox', { name: 'Search roasts' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetryList).toHaveBeenCalledOnce();
	});
});

describe('an open roast', () => {
	let scrollIntoView: ReturnType<typeof vi.fn>;
	let scrollTo: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		scrollIntoView = vi.fn();
		scrollTo = vi.fn();
		Element.prototype.scrollIntoView =
			scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
		vi.stubGlobal('scrollTo', scrollTo);
		// Everything measures as far below the fold, where a page that scrolled to its
		// content would have to move.
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 5000, 800, 400)
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('draws the back link, the title, the milestone line, and the chart, in that order', () => {
		const { container } = render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		const back = screen.getByRole('link', { name: '← Roasts' });
		const title = screen.getByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' });
		const milestones = screen.getByRole('list', { name: 'Milestones' });
		const chart = container.querySelector('.animate-pulse');
		const details = screen.getByRole('button', { name: 'Edit' });

		const compare = screen.getByRole('link', { name: 'Compare with…' });
		const more = screen.getByRole('button', { name: 'More' });

		expect(chart).not.toBeNull();
		expect(container.firstElementChild?.querySelector('a, h1, ul, button')).toBe(back);
		expect(precedes(back, title)).toBe(true);
		// The actions sit on the roast: under its title, above the milestone line and the chart.
		expect(precedes(title, compare)).toBe(true);
		expect(precedes(compare, more)).toBe(true);
		expect(precedes(more, milestones)).toBe(true);
		expect(precedes(milestones, chart!)).toBe(true);
		// The editable details follow the chart. Neither delete button is drawn on the page;
		// both are in the More menu.
		expect(precedes(chart!, details)).toBe(true);
		expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();

		expect(
			screen.getByText('Roast #4531 · Oct 1, 2026 · Wednesday roast · 16 → 13.7 oz (14.4% loss)')
		).toBeInTheDocument();
		// The list header and the list are not drawn around an open roast.
		expect(screen.queryByRole('heading', { name: 'Roasts' })).toBeNull();
		expect(screen.queryByRole('button', { name: /Toggle .* batch/ })).toBeNull();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
	});

	it('reads the milestones in words', () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		const items = within(screen.getByRole('list', { name: 'Milestones' }))
			.getAllByRole('listitem')
			.map((item) => item.textContent?.replace(/·/g, '').replace(/\s+/g, ' ').trim());

		expect(items).toEqual([
			'Charge 392°F',
			'Turning point 1:18',
			'Dry end 4:26',
			'First crack 8:18',
			'Drop 10:18 at 402°F',
			'Development 19.4%'
		]);
	});

	it('names a milestone that was not marked instead of leaving it out', () => {
		render(
			RoastProfileTabs,
			props({
				currentRoastProfile: roast({ fc_start_time: null, development_percent: null })
			})
		);

		const firstCrack = within(screen.getByRole('list', { name: 'Milestones' }))
			.getAllByRole('listitem')
			.find((item) => item.textContent?.includes('First crack'));

		expect(firstCrack?.textContent?.replace(/·/g, '').replace(/\s+/g, ' ').trim()).toBe(
			'First crack not marked'
		);
	});

	it('says so, in place of the milestone line, when nothing was recorded', () => {
		const setUp = roast({
			roast_id: 4540,
			oz_out: null,
			weight_loss_percent: null,
			charge_time: null,
			charge_temp: null,
			tp_time: null,
			dry_end_time: null,
			fc_start_time: null,
			drop_time: null,
			drop_temp: null,
			total_roast_time: null,
			development_percent: null,
			data_source: null
		});
		render(RoastProfileTabs, props({ currentRoastProfile: setUp }));

		expect(screen.getByText('Nothing recorded for this roast yet.')).toBeInTheDocument();
		expect(
			screen.getByText(
				/Start the timer to log it live, or import the Artisan file from this roast\./
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('list', { name: 'Milestones' })).toBeNull();
	});

	it('does not say nothing is recorded while the timer is running', () => {
		const setUp = roast({
			charge_time: null,
			tp_time: null,
			dry_end_time: null,
			fc_start_time: null,
			drop_time: null,
			total_roast_time: null,
			data_source: null
		});
		render(
			RoastProfileTabs,
			props({ currentRoastProfile: setUp, timer: { isIdle: false } as RoastTimer })
		);

		expect(screen.queryByText('Nothing recorded for this roast yet.')).toBeNull();
	});

	it('does not scroll the page when a roast opens', async () => {
		const { rerender } = render(RoastProfileTabs, props());

		await rerender(props({ currentRoastProfile: wushWush }));
		await vi.advanceTimersByTimeAsync(1000);

		expect(scrollIntoView).not.toHaveBeenCalled();
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('returns to the list through the page, without leaving it', async () => {
		const onClearProfile = vi.fn(async () => true);
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, onClearProfile }));

		const back = screen.getByRole('link', { name: '← Roasts' });
		expect(back).toHaveAttribute('href', '/roast');

		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		back.dispatchEvent(click);

		expect(onClearProfile).toHaveBeenCalledOnce();
		expect(click.defaultPrevented).toBe(true);
	});

	it('stays on the roast when the page keeps it open', async () => {
		// The page answers false when a roast is recording and the member keeps roasting.
		const onClearProfile = vi.fn(async () => false);
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, onClearProfile }));

		await fireEvent.click(screen.getByRole('link', { name: '← Roasts' }));
		await onClearProfile.mock.results[0].value;

		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' })
		).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Roasts' })).toBeNull();
	});

	it('leaves a modified click to the browser, which opens the list in another tab', () => {
		const onClearProfile = vi.fn(async () => true);
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, onClearProfile }));

		const back = screen.getByRole('link', { name: '← Roasts' });
		// Stop the event before the test browser acts on it; the handler has already run.
		back.parentElement!.addEventListener('click', (event) => event.preventDefault());
		for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
			back.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true })
			);
		}

		// The roast on this page is not closed, so a roast in progress keeps recording.
		expect(onClearProfile).not.toHaveBeenCalled();
	});

	it('lists the other roasts of the batch under the chart and switches to one', async () => {
		const onSelectProfile = vi.fn();
		const { container } = render(
			RoastProfileTabs,
			// The open roast's batch comes from its own request, whatever the list holds.
			props({
				currentRoastProfile: wushWush,
				batches: [],
				openBatchRoasts: [wushWush, colombia],
				onSelectProfile
			})
		);

		expect(screen.getByText('Also in this batch:')).toBeInTheDocument();
		const other = screen.getByRole('button', { name: 'Colombia Sierra Nevada #4530' });
		expect(precedes(container.querySelector('.animate-pulse')!, other)).toBe(true);
		expect(
			screen.queryByRole('button', { name: 'Ethiopia Yirgacheffe Wush Wush #4531' })
		).toBeNull();

		await fireEvent.click(other);
		expect(onSelectProfile).toHaveBeenCalledWith(colombia);
	});

	it('leaves the batch line out for a roast that is alone in its batch', () => {
		render(RoastProfileTabs, props({ currentRoastProfile: guji, openBatchRoasts: [guji] }));

		expect(screen.queryByText('Also in this batch:')).toBeNull();
	});
});

describe("an open roast's actions", () => {
	const moreItems = () =>
		within(screen.getByRole('menu', { name: 'More actions for this roast' })).getAllByRole(
			'menuitem'
		);

	async function openMore() {
		await fireEvent.click(screen.getByRole('button', { name: 'More' }));
	}

	async function chooseFromMore(name: string) {
		await openMore();
		await fireEvent.click(screen.getByRole('menuitem', { name }));
	}

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('links to the comparison page with this roast already chosen', () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		const compare = screen.getByRole('link', { name: 'Compare with…' });
		expect(compare).toHaveAttribute('href', '/roast/compare?a=roast:4531');
		// A plain link: the browser and the page's live-roast guard handle the navigation.
		expect(compare.tagName).toBe('A');
	});

	it('links to the plan page with this roast to start from', () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		const plan = screen.getByRole('link', { name: 'Plan next roast from this' });
		expect(plan).toHaveAttribute('href', '/roast/plan?from=roast:4531');
		// A plain link, like "Compare with…": the live-roast guard sees the navigation.
		expect(plan.tagName).toBe('A');
		// On a phone it gives way to "Compare with…" and sits in More instead.
		expect(plan).toHaveClass('hidden', 'sm:inline-flex');
	});

	it('links to the sale form with the coffee, the batch, and this roast filled in', () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		const sale = screen.getByRole('link', { name: 'Log sale' });
		expect(sale).toHaveAttribute(
			'href',
			`/profit?modal=new&coffee=101&batch=${WEDNESDAY}&roast=4531`
		);
		// A plain link, like "Compare with…": the live-roast guard sees the navigation.
		expect(sale.tagName).toBe('A');
		// On a phone it gives way to "Compare with…" and sits in More instead.
		expect(sale).toHaveClass('hidden', 'sm:inline-flex');
	});

	it('offers no sale or batch deletion for a roast whose batch is not known by its ID', async () => {
		const orphan = roast({ roast_id: 4600, batch_id: undefined as never });
		render(
			RoastProfileTabs,
			props({ currentRoastProfile: orphan, batches: groupRoastsByBatch([orphan]) })
		);

		expect(screen.queryByRole('link', { name: 'Log sale' })).toBeNull();
		await openMore();
		expect(screen.queryByRole('menuitem', { name: 'Log sale' })).toBeNull();
		expect(screen.queryByRole('menuitem', { name: 'Delete batch' })).toBeNull();
		expect(screen.getByRole('menuitem', { name: 'Delete roast' })).toBeEnabled();
	});

	it('holds the six further actions in More, with the two deletions last', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));
		const more = screen.getByRole('button', { name: 'More' });
		expect(more).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('menu')).toBeNull();

		await openMore();

		expect(more).toHaveAttribute('aria-expanded', 'true');
		expect(moreItems().map((item) => item.textContent?.trim())).toEqual([
			'Plan next roast from this',
			'Log sale',
			'Save as reference',
			'Edit details',
			'Import Artisan file',
			'Clear recorded data',
			'Delete roast',
			'Delete batch'
		]);
		for (const item of moreItems()) expect(item).toBeEnabled();
	});

	it('carries the plan link in More for a phone, where only one action is shown', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));
		await openMore();

		const plan = screen.getByRole('menuitem', { name: 'Plan next roast from this' });
		expect(plan.tagName).toBe('A');
		expect(plan).toHaveAttribute('href', '/roast/plan?from=roast:4531');
		expect(plan).toHaveClass('sm:hidden');
	});

	it('carries the sale link in More for a phone as well', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));
		await openMore();

		const sale = screen.getByRole('menuitem', { name: 'Log sale' });
		expect(sale.tagName).toBe('A');
		expect(sale).toHaveAttribute(
			'href',
			`/profit?modal=new&coffee=101&batch=${WEDNESDAY}&roast=4531`
		);
		expect(sale).toHaveClass('sm:hidden');
	});

	it('closes More on Escape and returns to its button', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));
		await openMore();

		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

		expect(screen.queryByRole('menu')).toBeNull();
		expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
	});

	it('saves the roast as a reference through the page and shows the confirmation', async () => {
		const onSaveReference = vi.fn();
		const { rerender } = render(
			RoastProfileTabs,
			props({ currentRoastProfile: wushWush, onSaveReference })
		);

		await chooseFromMore('Save as reference');

		expect(onSaveReference).toHaveBeenCalledOnce();
		expect(screen.queryByRole('menu')).toBeNull();

		await rerender({
			actionNotice: {
				message: 'Wednesday roast reference is saved as a reference.',
				link: { href: '/roast/saved', label: 'See saved references and plans' }
			}
		});
		const notice = screen.getByRole('status');
		expect(notice).toHaveTextContent('Wednesday roast reference is saved as a reference.');
		// The saved library is one link away, and leaving a recording roast for it asks first.
		expect(
			within(notice).getByRole('link', { name: 'See saved references and plans' })
		).toHaveAttribute('href', '/roast/saved');
	});

	it('offers the Artisan file in More only for a roast that has one on record', async () => {
		const onDownloadArtisan = vi.fn();
		const { unmount } = render(
			RoastProfileTabs,
			props({ currentRoastProfile: wushWush, onDownloadArtisan })
		);
		await openMore();
		// A roast logged live or entered by hand has no file, so there is nothing to offer.
		expect(screen.queryByRole('menuitem', { name: 'Download Artisan file' })).toBeNull();
		unmount();

		render(
			RoastProfileTabs,
			props({
				currentRoastProfile: roast({ artisan_file_available: true }),
				onDownloadArtisan
			})
		);
		await openMore();

		expect(moreItems().map((item) => item.textContent?.trim())).toEqual([
			'Plan next roast from this',
			'Log sale',
			'Save as reference',
			'Edit details',
			'Import Artisan file',
			'Download Artisan file',
			'Clear recorded data',
			'Delete roast',
			'Delete batch'
		]);
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Download Artisan file' }));

		expect(onDownloadArtisan).toHaveBeenCalledOnce();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('shows why a file could not be downloaded as a next step, not as a confirmation', async () => {
		render(
			RoastProfileTabs,
			props({
				currentRoastProfile: wushWush,
				actionNotice: {
					message:
						'This roast has no Artisan file on record, so there is no file to download. Import its .alog to keep a copy with the roast.',
					tone: 'note'
				}
			})
		);

		const notice = screen.getByRole('status');
		expect(notice).toHaveTextContent('This roast has no Artisan file on record');
		expect(notice).not.toHaveClass('bg-success-subtle');
	});

	it('opens the details for editing', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

		await chooseFromMore('Edit details');

		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
	});

	it('opens the Artisan import for this roast, after warning that it replaces the recording', async () => {
		const confirm = vi.fn(() => true);
		vi.stubGlobal('confirm', confirm);
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush }));

		await chooseFromMore('Import Artisan file');

		expect(confirm).toHaveBeenCalledOnce();
		expect(screen.getByRole('heading', { name: 'Import Artisan Roast File' })).toBeInTheDocument();
	});

	it('clears the recorded data only once the member confirms', async () => {
		const clearRoastData = vi.fn();
		const confirm = vi.fn(() => false);
		vi.stubGlobal('confirm', confirm);
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, clearRoastData }));

		await chooseFromMore('Clear recorded data');
		expect(clearRoastData).not.toHaveBeenCalled();

		confirm.mockReturnValue(true);
		await chooseFromMore('Clear recorded data');
		expect(clearRoastData).toHaveBeenCalledOnce();
	});

	it('deletes the roast only once the member confirms', async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const confirm = vi.fn(() => false);
		vi.stubGlobal('confirm', confirm);
		const onProfileDelete = vi.fn();
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, onProfileDelete }));

		await chooseFromMore('Delete roast');
		expect(fetchMock).not.toHaveBeenCalled();

		confirm.mockReturnValue(true);
		await chooseFromMore('Delete roast');
		await vi.waitFor(() => expect(onProfileDelete).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenLastCalledWith('/api/roast-profiles?id=4531', { method: 'DELETE' });
	});

	it("hands the open roast's batch, by its ID, to the page to delete", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const onDeleteBatch = vi.fn();
		render(
			RoastProfileTabs,
			props({
				// The roast open is from the earlier of two batches named "Wednesday roast".
				currentRoastProfile: lastWednesday,
				batches: groupRoastsByBatch([wushWush, colombia, guji, lastWednesday]),
				onDeleteBatch
			})
		);

		await chooseFromMore('Delete batch');

		expect(onDeleteBatch).toHaveBeenCalledOnce();
		expect(onDeleteBatch).toHaveBeenCalledWith(LAST_WEDNESDAY);
		// The page asks first and sends the request; nothing is deleted from here.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('offers nothing to compare, plan from, keep, or clear for a roast with nothing recorded', async () => {
		const planned = roast({
			roast_id: 4540,
			oz_out: null,
			weight_loss_percent: null,
			charge_time: null,
			charge_temp: null,
			tp_time: null,
			dry_end_time: null,
			fc_start_time: null,
			drop_time: null,
			drop_temp: null,
			total_roast_time: null,
			development_percent: null,
			data_source: null
		});
		render(RoastProfileTabs, props({ currentRoastProfile: planned }));

		expect(screen.queryByRole('link', { name: 'Compare with…' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Compare with…' })).toBeDisabled();
		expect(screen.queryByRole('link', { name: 'Plan next roast from this' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Plan next roast from this' })).toBeDisabled();

		await openMore();
		const enabled = Object.fromEntries(
			moreItems().map((item) => [item.textContent?.trim(), !(item as HTMLButtonElement).disabled])
		);
		expect(enabled).toEqual({
			'Plan next roast from this': false,
			'Log sale': true,
			'Save as reference': false,
			'Edit details': true,
			'Import Artisan file': true,
			'Clear recorded data': false,
			'Delete roast': true,
			'Delete batch': true
		});
	});

	it('holds the saving and deleting actions while one is already under way', async () => {
		render(RoastProfileTabs, props({ currentRoastProfile: wushWush, actionInProgress: true }));

		await openMore();

		expect(screen.getByRole('menuitem', { name: 'Save as reference' })).toBeDisabled();
		expect(screen.getByRole('menuitem', { name: 'Delete roast' })).toBeDisabled();
		expect(screen.getByRole('menuitem', { name: 'Edit details' })).toBeEnabled();
	});
});
