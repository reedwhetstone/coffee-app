import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastTimer } from '$lib/roast';
import type { RoastProfile } from '$lib/types/component.types';
import RoastProfileTabs from './RoastProfileTabs.svelte';

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 4531,
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
	batch_name: 'Guji drop test',
	roast_date: '2026-09-27T00:00:00+00:00'
});

const grouped = {
	'Wednesday roast|||2026-10-01': [wushWush, colombia],
	'Guji drop test|||2026-09-27': [guji]
};

const idleTimer = { isIdle: true } as RoastTimer;

function props(overrides: Record<string, unknown> = {}) {
	return {
		sortedBatchNames: Object.keys(grouped),
		sortedGroupedProfiles: grouped,
		collapsedBatches: new Set<string>(),
		currentRoastProfile: null,
		currentProfileIndex: 0,
		// The chart panel is drawn as its loading placeholder; the chart itself is not under test.
		chartComponentLoading: true,
		RoastChartInterface: null,
		countLine: '3 roasts in 2 batches · 14.4% average loss',
		totalRoasts: 3,
		canCreateRoast: true,
		onToggleBatch: vi.fn(),
		onSelectProfile: vi.fn(),
		onProfileUpdate: vi.fn(),
		onProfileDelete: vi.fn(),
		onBatchDelete: vi.fn(),
		onClearProfile: vi.fn(async () => true),
		onClearFilters: vi.fn(),
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
		expect(screen.getByRole('region', { name: 'Roasts in Wednesday roast' })).toBeInTheDocument();
		expect(
			within(screen.getByRole('region', { name: 'Roasts in Guji drop test' })).getByText(/ID: 4529/)
		).toBeInTheDocument();
	});

	it('closes only the batches the roaster closed', async () => {
		const onToggleBatch = vi.fn();
		render(
			RoastProfileTabs,
			props({ collapsedBatches: new Set(['Guji drop test|||2026-09-27']), onToggleBatch })
		);

		expect(screen.queryByRole('region', { name: 'Roasts in Guji drop test' })).toBeNull();
		expect(screen.getByRole('region', { name: 'Roasts in Wednesday roast' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Toggle Guji drop test batch/ }));
		expect(onToggleBatch).toHaveBeenCalledWith('Guji drop test|||2026-09-27');
	});

	it('shows each roast on the calendar day it was stored with', () => {
		render(RoastProfileTabs, props());

		expect(screen.getByText(/2 roasts • Oct 1, 2026/)).toBeInTheDocument();
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
		render(
			RoastProfileTabs,
			props({ sortedBatchNames: [], sortedGroupedProfiles: {}, totalRoasts: 0 })
		);

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
			props({ sortedBatchNames: [], sortedGroupedProfiles: {}, totalRoasts: 3, onClearFilters })
		);

		expect(screen.getByRole('heading', { name: 'No roasts match.' })).toBeInTheDocument();
		expect(screen.queryByText('No roasts yet.')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
		expect(onClearFilters).toHaveBeenCalledOnce();
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

		expect(chart).not.toBeNull();
		expect(container.firstElementChild?.querySelector('a, h1, ul, button')).toBe(back);
		expect(precedes(back, title)).toBe(true);
		expect(precedes(title, milestones)).toBe(true);
		expect(precedes(milestones, chart!)).toBe(true);
		// The editable details and both delete buttons follow the chart.
		expect(precedes(chart!, details)).toBe(true);
		expect(precedes(chart!, screen.getByRole('button', { name: 'Delete batch' }))).toBe(true);

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
			props({ currentRoastProfile: wushWush, onSelectProfile })
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
		render(RoastProfileTabs, props({ currentRoastProfile: guji }));

		expect(screen.queryByText('Also in this batch:')).toBeNull();
	});
});
