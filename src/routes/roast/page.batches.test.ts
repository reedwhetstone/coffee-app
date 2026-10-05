import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import RoastPage from './+page.svelte';
import { eventEntries, roastData, roastEvents, temperatureEntries } from './stores';

const { goto, replaceState, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	pageState: { url: new URL('http://localhost/roast') }
}));

vi.mock('$app/navigation', () => ({
	goto,
	replaceState,
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn()
}));
vi.mock('$app/state', () => ({ page: pageState }));

const OCT_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEP_24 = 'aaaaaaaa-0000-4000-8000-000000000002';
const LATE = 'aaaaaaaa-0000-4000-8000-000000000003';

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 1,
		batch_id: OCT_1,
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
		last_updated: '2026-10-01T12:00:00.000Z',
		...overrides
	} as RoastProfile;
}

// "Wednesday roast" is roasted every week, so Oct 1 and Sep 24 are two batches with one
// name. The late session starts on Sep 29 and its last roast drops after midnight.
const roasts = [
	roast({ roast_id: 4531 }),
	roast({ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' }),
	roast({ roast_id: 4527, batch_id: LATE, batch_name: 'Late session', roast_date: '2026-09-30' }),
	roast({ roast_id: 4526, batch_id: LATE, batch_name: 'Late session', roast_date: '2026-09-29' }),
	roast({ roast_id: 4521, batch_id: SEP_24, roast_date: '2026-09-24' }),
	roast({
		roast_id: 4520,
		batch_id: SEP_24,
		roast_date: '2026-09-24',
		coffee_id: 102,
		coffee_name: 'Colombia Sierra Nevada'
	})
];
/** A roast with nothing recorded, so the timer can be started on it. */
const planned = roast({
	roast_id: 4540,
	oz_out: null,
	weight_loss_percent: null,
	charge_time: null,
	fc_start_time: null,
	drop_time: null,
	total_roast_time: null
});

/** What the roast list request returns; deleting a batch takes its roasts out. */
let listed: RoastProfile[] = roasts;
let deleteStatus = 200;
type Sent = { url: string; method: string };
let requests: Sent[] = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	const method = init?.method ?? 'GET';
	requests.push({ url, method });
	if (url.startsWith('/api/roast-chart-settings')) return json({ settings: null });
	if (url.startsWith('/api/roast-chart-data')) return json({ series: [], events: [] });
	if (url.startsWith('/api/roast-batches/') && method === 'DELETE') {
		if (deleteStatus !== 200) return json({ error: 'Roast batch not found' }, deleteStatus);
		const batchId = url.split('/').pop();
		const removed = listed.filter((entry) => entry.batch_id === batchId);
		listed = listed.filter((entry) => entry.batch_id !== batchId);
		return json({ success: true, id: batchId, roastIds: removed.map((entry) => entry.roast_id) });
	}
	if (url.startsWith('/api/roast-profiles')) return json({ data: listed });
	return json({ data: [] });
});

const deletes = () => requests.filter((request) => request.method === 'DELETE');

function renderPage(initial = roasts) {
	listed = initial;
	return render(RoastPage, {
		data: {
			auth: {
				isSignedIn: true,
				user: { id: 'member-1', email: 'member@example.com' },
				role: 'member',
				ppiAccess: false
			},
			initialRoasts: Promise.resolve({ data: { data: initial }, error: null })
		}
	} as never);
}

/** Puts the browser on a roast page address, as a link or a reload would. */
function visit(path: string) {
	const url = `http://localhost${path}`;
	pageState.url = new URL(url);
	(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
}

const batchHeadings = () =>
	screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.trim());

const roastRows = () =>
	screen
		.getAllByRole('button')
		.filter((button) => /ID: \d+/.test(button.textContent ?? ''))
		.map((button) => Number(button.textContent?.match(/ID: (\d+)/)?.[1]));

const lastGoto = () => String(goto.mock.calls.at(-1)?.[0]);

/** selectProfile ignores clicks for 100 ms after each selection. */
const selectionSettled = () => new Promise((resolve) => setTimeout(resolve, 150));

async function chooseFromMore(label: string) {
	await fireEvent.click(screen.getByRole('button', { name: 'More' }));
	await fireEvent.click(screen.getByRole('menuitem', { name: label }));
}

const timerButton = () => document.querySelector<HTMLButtonElement>('#start-end-roast');

let confirmMock: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

beforeEach(() => {
	vi.clearAllMocks();
	requests = [];
	deleteStatus = 200;
	vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] });
	vi.stubGlobal('fetch', fetchMock);
	confirmMock = vi.fn<(message?: string) => boolean>(() => true);
	vi.stubGlobal('confirm', confirmMock);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
	eventEntries.set([]);
	temperatureEntries.set([]);
	roastData.set([]);
	roastEvents.set([]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('the roast list grouped by batch', () => {
	it('lists two batches that share a name separately, each under its date', async () => {
		visit('/roast');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(batchHeadings()).toEqual([
			'Oct 1 · Wednesday roast',
			'Sep 29 · Late session',
			'Sep 24 · Wednesday roast'
		]);
		expect(screen.getByText(/6 roasts in 3 batches/)).toBeInTheDocument();
		expect(
			within(screen.getByRole('region', { name: 'Roasts in Oct 1 · Wednesday roast' }))
				.getAllByRole('button')
				.map((button) => Number(button.textContent?.match(/ID: (\d+)/)?.[1]))
		).toEqual([4531, 4530]);
		expect(
			within(screen.getByRole('region', { name: 'Roasts in Sep 24 · Wednesday roast' }))
				.getAllByRole('button')
				.map((button) => Number(button.textContent?.match(/ID: (\d+)/)?.[1]))
		).toEqual([4521, 4520]);
	});

	it('keeps a batch whose roasts span two days as one group', async () => {
		visit('/roast');
		renderPage();

		const late = await screen.findByRole('region', { name: 'Roasts in Sep 29 · Late session' });
		expect(within(late).getAllByRole('button')).toHaveLength(2);
		expect(screen.getByText('2 roasts · Sep 29 to Sep 30')).toBeInTheDocument();
	});

	it('offers "Log sale" on each batch header for that batch alone', async () => {
		visit('/roast');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(
			screen
				.getAllByRole('link', { name: /^Log sale from / })
				.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])
		).toEqual([
			['Log sale from Oct 1 · Wednesday roast', `/profit?modal=new&batch=${OCT_1}`],
			['Log sale from Sep 29 · Late session', `/profit?modal=new&coffee=101&batch=${LATE}`],
			['Log sale from Sep 24 · Wednesday roast', `/profit?modal=new&batch=${SEP_24}`]
		]);
	});
});

describe('the roast list opened for one batch', () => {
	it('shows only that batch, named in a chip, and not the other batch with its name', async () => {
		visit(`/roast?batch=${SEP_24}`);
		renderPage();

		await waitFor(() => expect(roastRows()).toEqual([4521, 4520]));
		expect(batchHeadings()).toEqual(['Sep 24 · Wednesday roast']);
		expect(screen.getByText(/2 roasts in 1 batch/)).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Show every batch' }).parentElement
		).toHaveTextContent('Sep 24 · Wednesday roast');
	});

	it('removes the batch from the address when the chip is removed', async () => {
		visit(`/roast?batch=${SEP_24}`);
		renderPage();

		await fireEvent.click(await screen.findByRole('button', { name: 'Show every batch' }));

		expect(lastGoto()).toBe('/roast');
		expect(goto.mock.calls.at(-1)?.[1]).toMatchObject({ replaceState: true });
	});

	it('narrows by batch and by coffee together', async () => {
		visit(`/roast?coffee=102&batch=${SEP_24}`);
		renderPage();

		await waitFor(() => expect(roastRows()).toEqual([4520]));
		expect(screen.getByRole('button', { name: 'Show roasts of every coffee' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show every batch' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Show every batch' }));
		expect(lastGoto()).toBe('/roast?coffee=102');
	});

	it('keeps the batch in the address when a roast opens, and returns to the narrowed list', async () => {
		visit(`/roast?batch=${SEP_24}`);
		renderPage();

		await fireEvent.click(await screen.findByRole('button', { name: /ID: 4521/ }));

		const back = await screen.findByRole('link', { name: '← Roasts' });
		expect(back).toHaveAttribute('href', `/roast?batch=${SEP_24}`);
		const opened = new URL(lastGoto(), 'http://localhost');
		expect(opened.searchParams.get('batch')).toBe(SEP_24);
		expect(opened.searchParams.get('roast')).toBe('4521');

		await selectionSettled();
		await fireEvent.click(back);
		expect(lastGoto()).toBe(`/roast?batch=${SEP_24}`);
	});

	it('says so for a batch that has no roasts, and clears back to every roast', async () => {
		visit('/roast?batch=aaaaaaaa-0000-4000-8000-00000000ffff');
		renderPage();

		expect(await screen.findByRole('heading', { name: 'No roasts match.' })).toBeInTheDocument();
		expect(
			screen.getByText('That batch has no roasts. It may have been deleted.')
		).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
		expect(lastGoto()).toBe('/roast');
	});

	it('ignores a batch value that is not a batch ID', async () => {
		visit('/roast?batch=Wednesday%20roast');
		renderPage();

		await waitFor(() => expect(roastRows()).toHaveLength(6));
		expect(screen.queryByRole('button', { name: 'Show every batch' })).toBeNull();
	});
});

describe('deleting a batch', () => {
	it('asks by name, date, and roast count, and deletes nothing when declined', async () => {
		confirmMock.mockReturnValue(false);
		visit('/roast?roast=4521');
		renderPage();
		await screen.findByRole('link', { name: '← Roasts' });

		await chooseFromMore('Delete batch');

		expect(confirmMock).toHaveBeenCalledOnce();
		expect(confirmMock).toHaveBeenCalledWith(
			'Delete the batch “Wednesday roast” from Sep 24, 2026? This removes its 2 roasts and everything recorded for them, and cannot be undone. Sales recorded against the batch are kept.'
		);
		expect(deletes()).toEqual([]);
		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
	});

	it('deletes that batch by its ID and leaves the other batch with the same name', async () => {
		visit('/roast?roast=4521');
		renderPage();
		await screen.findByRole('link', { name: '← Roasts' });

		await chooseFromMore('Delete batch');

		await waitFor(() =>
			expect(deletes()).toEqual([{ url: `/api/roast-batches/${SEP_24}`, method: 'DELETE' }])
		);
		// The roast that was open is gone, so the list is back, without its batch.
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		await waitFor(() =>
			expect(batchHeadings()).toEqual(['Oct 1 · Wednesday roast', 'Sep 29 · Late session'])
		);
		expect(new URL(lastGoto(), 'http://localhost').searchParams.get('roast')).toBeNull();
	});

	it('counts every roast of the batch, whatever the list is narrowed to', async () => {
		confirmMock.mockReturnValue(false);
		visit('/roast?coffee=101&roast=4531');
		renderPage();
		await screen.findByRole('link', { name: '← Roasts' });

		await chooseFromMore('Delete batch');

		expect(confirmMock.mock.calls[0][0]).toContain(
			'“Wednesday roast” from Oct 1, 2026? This removes its 2 roasts'
		);
	});

	it('takes the batch out of the address when the list was narrowed to it', async () => {
		visit(`/roast?batch=${SEP_24}&roast=4521`);
		renderPage();
		await screen.findByRole('link', { name: '← Roasts' });

		await chooseFromMore('Delete batch');

		await waitFor(() => expect(deletes()).toHaveLength(1));
		await waitFor(() => expect(lastGoto()).toBe('/roast'));
	});

	it('says why when the batch could not be deleted, and keeps the roast open', async () => {
		deleteStatus = 404;
		visit('/roast?roast=4521');
		renderPage();
		await screen.findByRole('link', { name: '← Roasts' });

		await chooseFromMore('Delete batch');

		expect(await screen.findByText('Roast batch not found')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
	});

	it('asks about the roast being recorded first, and deletes nothing when the member keeps roasting', async () => {
		visit('/roast?roast=4540');
		renderPage([...roasts, planned]);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
		await selectionSettled();
		await fireEvent.click(timerButton()!);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Stop'));

		await chooseFromMore('Delete batch');
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));

		expect(confirmMock).not.toHaveBeenCalled();
		expect(deletes()).toEqual([]);
		expect(timerButton()).toHaveTextContent('Stop');
		expect(get(temperatureEntries)).toHaveLength(1);
	});

	it('deletes the batch of a recording roast once the member chooses to leave, and stops the timer', async () => {
		visit('/roast?roast=4540');
		renderPage([...roasts, planned]);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
		await selectionSettled();
		await fireEvent.click(timerButton()!);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Stop'));

		await chooseFromMore('Delete batch');
		expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
			'A roast is still recording.'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce());
		expect(confirmMock.mock.calls[0][0]).toContain('This removes its 3 roasts');
		await waitFor(() =>
			expect(deletes()).toEqual([{ url: `/api/roast-batches/${OCT_1}`, method: 'DELETE' }])
		);
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(get(temperatureEntries)).toEqual([]);
		expect(get(eventEntries)).toEqual([]);
	});
});
