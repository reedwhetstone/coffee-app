import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeforeNavigate } from '@sveltejs/kit';
import type { RoastProfile } from '$lib/types/component.types';
import RoastPage from './+page.svelte';
import { eventEntries, roastData, roastEvents, temperatureEntries } from './stores';

const { goto, replaceState, pageState, navigationGuards } = vi.hoisted(() => ({
	goto: vi.fn(async (url: string | URL, options?: unknown) => ({ url, options })),
	replaceState: vi.fn(),
	pageState: { url: new URL('http://localhost/roast?profileId=1') },
	navigationGuards: [] as Array<(navigation: BeforeNavigate) => void>
}));

vi.mock('$app/navigation', () => ({
	goto,
	replaceState,
	beforeNavigate: (guard: (navigation: BeforeNavigate) => void) => {
		navigationGuards.push(guard);
	}
}));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/components/roast/ProfileStudio.svelte', () => ({ default: vi.fn() }));

const SAVED_AT = '2026-10-01T12:00:00.000Z';
const EDITED_AT = '2026-10-01T12:05:00.000Z';

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 1,
		batch_name: 'Morning batch',
		coffee_id: 7,
		coffee_name: 'Ethiopia',
		roast_date: '2026-10-01',
		roast_notes: '',
		last_updated: SAVED_AT,
		...overrides
	} as RoastProfile;
}

const roasts = [
	roast({ roast_id: 1, coffee_id: 7, coffee_name: 'Ethiopia' }),
	roast({ roast_id: 2, coffee_id: 8, coffee_name: 'Colombia' })
];
/** What the roast list request returns; a create adds the new roast to it. */
let listedRoasts = roasts;

type Request = { url: string; method: string; headers: Headers; body: unknown };
let requests: Request[] = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	const method = init?.method ?? 'GET';
	const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
	requests.push({ url, method, headers: new Headers(init?.headers), body });

	if (url.startsWith('/api/roast-chart-settings')) return json({ settings: null });
	if (url.startsWith('/api/roast-chart-data')) return json({ series: [], events: [] });
	if (url.startsWith('/api/beans')) {
		return json({ data: [{ id: 7, name: 'Ethiopia', stocked: true }] });
	}
	if (url.startsWith('/api/roast-profiles')) {
		if (method === 'PUT') return json(roast({ roast_notes: 'Windy day', last_updated: EDITED_AT }));
		if (method === 'POST') {
			const created = roast({ roast_id: 3, batch_name: 'Next batch' });
			listedRoasts = [...roasts, created];
			return json({ profiles: [created], roast_ids: [3] });
		}
		return json({ data: listedRoasts });
	}
	return json({ data: [] });
});

function sent(method: string) {
	return requests.filter(
		(request) => request.method === method && request.url.startsWith('/api/roast-profiles')
	);
}

function timerButton() {
	return document.querySelector<HTMLButtonElement>('#start-end-roast');
}

function timerDisplay() {
	return timerButton()?.parentElement?.querySelector('div')?.textContent?.trim();
}

/** Roast IDs the page has put in the address bar, in order. */
function openedRoastIds() {
	return goto.mock.calls
		.map(([url]) => new URL(String(url), 'http://localhost').searchParams.get('roast'))
		.filter((id) => id !== null);
}

function backLink() {
	return screen.getByRole('link', { name: '← Roasts' });
}

function roastListTitle() {
	return screen.queryByRole('heading', { level: 1, name: 'Roasts' });
}

function leaveQuestion() {
	return screen.queryByRole('alertdialog', { name: 'A roast is still recording.' });
}

function loggedEvents() {
	return get(eventEntries).map((entry) => entry.event_string);
}

/** selectProfile ignores clicks for 100 ms after each selection. */
function selectionSettled() {
	return new Promise((resolve) => setTimeout(resolve, 150));
}

async function openRoast(search = '?profileId=1', listed = roasts) {
	listedRoasts = listed;
	pageState.url = new URL(`http://localhost/roast${search}`);
	render(RoastPage, {
		data: {
			auth: {
				isSignedIn: true,
				user: { id: 'member-1', email: 'member@example.com' },
				role: 'member',
				ppiAccess: false
			},
			initialRoasts: Promise.resolve({ data: { data: listed }, error: null })
		}
	} as never);

	await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
	await selectionSettled();
}

async function startRoast() {
	await fireEvent.click(timerButton()!);
	await waitFor(() => expect(timerButton()).toHaveTextContent('Stop'));
}

async function logEvent(name: string) {
	// The timeline renders a phone layout and a desktop layout of the same buttons.
	await fireEvent.click(screen.getAllByRole('button', { name })[0]);
}

async function pauseRoast() {
	await fireEvent.click(timerButton()!);
	await waitFor(() => expect(timerButton()).toHaveTextContent('Resume'));
}

async function saveRoast() {
	await fireEvent.click(await screen.findByRole('button', { name: 'Save roast' }));
}

function leavePage(to = '/beans') {
	const cancel = vi.fn();
	navigationGuards.at(-1)!({
		from: { url: new URL('http://localhost/roast?profileId=1') },
		to: { url: new URL(`http://localhost${to}`) },
		type: 'link',
		willUnload: false,
		cancel
	} as unknown as BeforeNavigate);
	return cancel;
}

function unload() {
	const event = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(event);
	return event;
}

beforeEach(() => {
	vi.clearAllMocks();
	requests = [];
	listedRoasts = roasts;
	navigationGuards.length = 0;
	sessionStorage.clear();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal(
		'confirm',
		vi.fn(() => true)
	);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	eventEntries.set([]);
	temperatureEntries.set([]);
	roastData.set([]);
	roastEvents.set([]);
});

describe('roast page live logging', () => {
	it('starts the timer and records the start of the roast', async () => {
		await openRoast();
		expect(timerDisplay()).toBe('0:00.00');
		expect(screen.getAllByRole('button', { name: 'Charge' })[0]).toBeDisabled();

		await startRoast();

		expect(loggedEvents()).toEqual(['start']);
		expect(get(temperatureEntries)).toEqual([
			expect.objectContaining({ roast_id: 1, time_seconds: 0, data_source: 'live' })
		]);
		expect(screen.getAllByRole('button', { name: 'Charge' })[0]).toBeEnabled();
		await waitFor(() => expect(timerDisplay()).not.toBe('0:00.00'));
	});

	it('logs a milestone with the fan and heat settings in force', async () => {
		await openRoast();
		await startRoast();

		await logEvent('Charge');
		await fireEvent.click(screen.getByRole('button', { name: 'Increase fan setting' }));
		await logEvent('FC Start');

		const entries = get(eventEntries);
		expect(entries.filter((entry) => entry.category === 'milestone')).toEqual([
			expect.objectContaining({ event_string: 'start', roast_id: 1 }),
			expect.objectContaining({ event_string: 'charge', roast_id: 1 }),
			expect.objectContaining({ event_string: 'fc_start', roast_id: 1 })
		]);
		expect(entries.at(-2)).toEqual(
			expect.objectContaining({ event_string: 'fan_setting', event_value: '9' })
		);
		expect(get(roastEvents).map((event) => event.name)).toEqual(['Charge', 'FC Start']);
	});

	it('pauses and resumes without dropping what was logged', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();

		await pauseRoast();
		const pausedAt = timerDisplay();
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(timerDisplay()).toBe(pausedAt);
		expect(loggedEvents()).toEqual(logged);

		await fireEvent.click(timerButton()!);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Stop'));
		expect(loggedEvents()).toEqual(logged);
	});

	it('refuses to save while the timer is running and keeps the readings', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');

		await saveRoast();

		expect(await screen.findByText('Please stop the roast before saving.')).toBeInTheDocument();
		expect(sent('PUT')).toEqual([]);
		expect(loggedEvents()).toContain('charge');
		expect(timerButton()).toHaveTextContent('Stop');
	});

	it('saves the readings to the roast and returns to an idle timer', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		await logEvent('Drop');
		await pauseRoast();

		await saveRoast();

		await waitFor(() => expect(sent('PUT')).toHaveLength(1));
		const [save] = sent('PUT');
		expect(save.url).toBe('/api/roast-profiles?id=1');
		expect(save.headers.get('If-Match')).toBe(SAVED_AT);
		const saved = save.body as {
			temperatureEntries: Array<{ roast_id: number }>;
			eventEntries: Array<{ roast_id: number; event_string: string; category: string }>;
		};
		expect(saved.temperatureEntries).toEqual([expect.objectContaining({ roast_id: 1 })]);
		expect(
			saved.eventEntries
				.filter((entry) => entry.category === 'milestone')
				.map((entry) => entry.event_string)
		).toEqual(['start', 'charge', 'drop']);

		// The page reloads the roast from the server once the save lands.
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
		expect(get(eventEntries)).toEqual([]);
		expect(get(temperatureEntries)).toEqual([]);
		expect(leaveQuestion()).not.toBeInTheDocument();
	});
});

describe('roast page live roast guard', () => {
	it('switches roasts without asking when nothing is recording', async () => {
		await openRoast();

		await fireEvent.click(screen.getByRole('button', { name: 'Colombia #2' }));

		await waitFor(() => expect(openedRoastIds()).toContain('2'));
		expect(leaveQuestion()).not.toBeInTheDocument();
		expect(leavePage()).not.toHaveBeenCalled();
		expect(unload().defaultPrevented).toBe(false);
	});

	it('keeps the roast when the member picks another roast and then stays', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();
		goto.mockClear();

		// The other roasts of the batch are listed under the chart of the open roast.
		expect(screen.getByText('Also in this batch:')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Colombia #2' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
		await selectionSettled();

		expect(leaveQuestion()).not.toBeInTheDocument();
		expect(loggedEvents()).toEqual(logged);
		expect(get(temperatureEntries)).toHaveLength(1);
		expect(timerButton()).toHaveTextContent('Stop');
		expect(goto).not.toHaveBeenCalled();
	});

	it('switches and discards the readings only after the member chooses to leave', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');

		await fireEvent.click(screen.getByRole('button', { name: 'Colombia #2' }));
		expect(await screen.findByRole('alertdialog')).toHaveAccessibleDescription(
			'Leaving now loses the readings that are not saved.'
		);
		expect(loggedEvents()).toContain('charge');
		await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(openedRoastIds()).toContain('2'));
		expect(get(eventEntries)).toEqual([]);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'));
	});

	it('asks before returning to the roast list, and stays on the roast when declined', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();
		goto.mockClear();

		await fireEvent.click(backLink());
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
		await selectionSettled();

		expect(timerButton()).toHaveTextContent('Stop');
		expect(loggedEvents()).toEqual(logged);
		expect(roastListTitle()).toBeNull();
		// The address still names the roast.
		expect(goto).not.toHaveBeenCalled();
		expect(replaceState).not.toHaveBeenCalled();

		await fireEvent.click(backLink());
		await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(timerButton()).toBeNull());
		expect(roastListTitle()).toBeInTheDocument();
		expect(get(eventEntries)).toEqual([]);
		expect(get(temperatureEntries)).toEqual([]);
		// The roast is taken out of the address, in place.
		expect(goto).toHaveBeenCalledOnce();
		expect(openedRoastIds()).toEqual([]);
		expect(goto.mock.calls[0][1]).toEqual({ replaceState: true, keepFocus: true, noScroll: true });
	});

	it('keeps the roast list off the page while a roast is recording', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');

		// The list, and the "New roast" button beside it, are reached only through
		// the back link, which asks first.
		expect(roastListTitle()).toBeNull();
		expect(screen.queryAllByRole('button', { name: /Toggle .* batch/ })).toEqual([]);
		expect(screen.queryByRole('link', { name: 'New roast' })).toBeNull();

		await fireEvent.click(backLink());
		expect(leaveQuestion()).toBeInTheDocument();
		expect(roastListTitle()).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
		await waitFor(() => expect(roastListTitle()).toBeInTheDocument());

		// With the roast left behind, a roast opens from the list on an idle timer.
		goto.mockClear();
		await fireEvent.click(screen.getByRole('button', { name: /Colombia/ }));

		await waitFor(() => expect(openedRoastIds()).toEqual(['2']));
		expect(leaveQuestion()).not.toBeInTheDocument();
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'));
		expect(timerDisplay()).toBe('0:00.00');
		expect(get(eventEntries)).toEqual([]);
	});

	it('stops sampling once the member leaves a running roast', async () => {
		const startInterval = vi.spyOn(globalThis, 'setInterval');
		const stopInterval = vi.spyOn(globalThis, 'clearInterval');
		await openRoast();
		await startRoast();
		const sampler =
			startInterval.mock.results[startInterval.mock.calls.findIndex(([, delay]) => delay === 2000)]
				?.value;
		expect(sampler).toBeDefined();
		stopInterval.mockClear();

		await fireEvent.click(backLink());
		await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));
		await waitFor(() => expect(timerButton()).toBeNull());

		// A sampler left running would keep adding points to the next roast opened.
		expect(stopInterval).toHaveBeenCalledWith(sampler);
	});

	it('holds navigation away, a reload, and a closed tab while a roast is recording', async () => {
		await openRoast();
		await startRoast();

		expect(unload().defaultPrevented).toBe(true);
		const cancel = leavePage();
		expect(cancel).toHaveBeenCalledOnce();
		expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Keep roasting' }));
		expect(timerButton()).toHaveTextContent('Stop');

		// Paused with unsaved readings is still a roast in progress.
		await pauseRoast();
		expect(unload().defaultPrevented).toBe(true);
		expect(leavePage()).toHaveBeenCalledOnce();
	});

	it('asks before leaving for portfolio, and goes there only once the member chooses to leave', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();
		goto.mockClear();

		expect(leavePage('/beans')).toHaveBeenCalledOnce();
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
		await selectionSettled();

		expect(goto).not.toHaveBeenCalled();
		expect(timerButton()).toHaveTextContent('Stop');
		expect(loggedEvents()).toEqual(logged);

		expect(leavePage('/beans')).toHaveBeenCalledOnce();
		await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(goto).toHaveBeenCalledOnce());
		expect(String(goto.mock.calls[0][0])).toBe('http://localhost/beans');
	});

	it('asks before leaving a recording roast for the comparison page', async () => {
		// A roast with weights on record can be compared and can still have its curve logged.
		const weighed = roast({ roast_id: 1, oz_in: 16, oz_out: 13.6 });
		await openRoast('?roast=1', [weighed, roasts[1]]);
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();
		goto.mockClear();

		// "Compare with…" is a plain link, so the click is an ordinary navigation that the
		// guard sees. It is not disabled and it does not navigate on its own.
		const compare = screen.getByRole('link', { name: 'Compare with…' });
		expect(compare).toHaveAttribute('href', '/roast/compare?a=roast:1');

		expect(leavePage('/roast/compare?a=roast:1')).toHaveBeenCalledOnce();
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
		await selectionSettled();

		expect(goto).not.toHaveBeenCalled();
		expect(timerButton()).toHaveTextContent('Stop');
		expect(loggedEvents()).toEqual(logged);

		expect(leavePage('/roast/compare?a=roast:1')).toHaveBeenCalledOnce();
		await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(goto).toHaveBeenCalledOnce());
		expect(String(goto.mock.calls[0][0])).toBe('http://localhost/roast/compare?a=roast:1');
	});

	it('lets the comparison page open without asking when nothing is recording', async () => {
		const weighed = roast({ roast_id: 1, oz_in: 16, oz_out: 13.6 });
		await openRoast('?roast=1', [weighed, roasts[1]]);

		expect(leavePage('/roast/compare?a=roast:1')).not.toHaveBeenCalled();
		expect(leaveQuestion()).not.toBeInTheDocument();
	});

	it('does not offer comparison for a roast with nothing recorded yet', async () => {
		await openRoast();

		expect(screen.queryByRole('link', { name: 'Compare with…' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Compare with…' })).toBeDisabled();
	});

	it('opens a roast reached from portfolio on a clean timer, without asking', async () => {
		// Portfolio opens a roast inside the app, so readings from a roast left
		// earlier in the same visit are still in memory when this page starts.
		const leftBehind = { roast_id: 1, time_seconds: 42, event_string: 'charge' };
		eventEntries.set([leftBehind] as never);
		temperatureEntries.set([{ roast_id: 1, time_seconds: 42, data_source: 'live' }] as never);

		await openRoast('?profileId=2');

		expect(screen.getByRole('heading', { level: 1, name: 'Colombia' })).toBeInTheDocument();
		expect(openedRoastIds()).toEqual(['2']);
		expect(leaveQuestion()).not.toBeInTheDocument();
		expect(timerDisplay()).toBe('0:00.00');
		expect(get(eventEntries)).toEqual([]);
		expect(get(temperatureEntries)).toEqual([]);
		expect(unload().defaultPrevented).toBe(false);
	});

	it('stops asking once the roast is saved', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		await pauseRoast();
		await saveRoast();
		await waitFor(() => expect(sent('PUT')).toHaveLength(1));
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'), { timeout: 3000 });
		await selectionSettled();

		expect(unload().defaultPrevented).toBe(false);
		expect(leavePage()).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Colombia #2' }));
		await waitFor(() => expect(openedRoastIds()).toContain('2'));
		expect(leaveQuestion()).not.toBeInTheDocument();
	});

	it('keeps recording when the details of the roast are edited mid-roast', async () => {
		await openRoast();
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();

		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(sent('PUT')).toHaveLength(1));
		await selectionSettled();

		expect(leaveQuestion()).not.toBeInTheDocument();
		expect(timerButton()).toHaveTextContent('Stop');
		expect(loggedEvents()).toEqual(logged);
		// No reload of the roast list, which would unmount the logger.
		expect(sent('GET')).toEqual([]);

		// The later save carries the version the edit produced.
		await pauseRoast();
		await saveRoast();
		await waitFor(() => expect(sent('PUT')).toHaveLength(2));
		expect(sent('PUT')[1].headers.get('If-Match')).toBe(EDITED_AT);
	});

	it('asks before creating a new roast, which would replace the one recording', async () => {
		await openRoast('?profileId=1&modal=new&beanId=7&beanName=Ethiopia');
		await startRoast();
		await logEvent('Charge');
		const logged = loggedEvents();
		const form = document.querySelector('form')!;
		await fireEvent.input(screen.getByLabelText('Batch Name'), {
			target: { value: 'Next batch' }
		});

		await fireEvent.submit(form);
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
		await selectionSettled();

		expect(sent('POST')).toEqual([]);
		expect(loggedEvents()).toEqual(logged);
		expect(timerButton()).toHaveTextContent('Stop');
	});

	it('creates the new roast and opens it once the member chooses to leave', async () => {
		await openRoast('?profileId=1&modal=new&beanId=7&beanName=Ethiopia');
		await startRoast();
		await logEvent('Charge');
		await fireEvent.input(screen.getByLabelText('Batch Name'), {
			target: { value: 'Next batch' }
		});

		await fireEvent.submit(document.querySelector('form')!);
		expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
		expect(sent('POST')).toEqual([]);
		await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

		await waitFor(() => expect(sent('POST')).toHaveLength(1));
		await waitFor(() => expect(openedRoastIds()).toContain('3'));
		expect(get(eventEntries)).toEqual([]);
		await waitFor(() => expect(timerButton()).toHaveTextContent('Start'));
	});
});
