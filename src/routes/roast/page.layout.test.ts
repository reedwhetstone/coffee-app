import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import RoastPage from './+page.svelte';

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

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 1,
		batch_name: 'Morning batch',
		coffee_id: 7,
		coffee_name: 'Ethiopia',
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

const roasts = [
	roast({ roast_id: 1, coffee_id: 7, coffee_name: 'Ethiopia' }),
	roast({ roast_id: 2, coffee_id: 8, coffee_name: 'Colombia' }),
	roast({
		roast_id: 3,
		coffee_id: 9,
		coffee_name: 'Guatemala',
		batch_name: 'Last week',
		roast_date: '2026-09-24'
	})
];

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
	const url = String(input);
	if (url.startsWith('/api/roast-chart-settings')) return json({ settings: null });
	if (url.startsWith('/api/roast-chart-data')) return json({ series: [], events: [] });
	if (url.startsWith('/api/roast-profiles')) return json({ data: roasts });
	return json({ data: [] });
});

function renderPage() {
	return render(RoastPage, {
		data: {
			auth: {
				isSignedIn: true,
				user: { id: 'member-1', email: 'member@example.com' },
				role: 'member',
				ppiAccess: false
			},
			initialRoasts: Promise.resolve({ data: { data: roasts }, error: null })
		}
	} as never);
}

/** Puts the browser on a roast page address, as a link or a reload would. */
function visit(path: string) {
	const url = `http://localhost${path}`;
	pageState.url = new URL(url);
	(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
}

/** True when `first` comes before `second` in the document. */
function precedes(first: Element, second: Element): boolean {
	return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('roast page layout', () => {
	let scrollIntoView: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		visit('/roast');
		vi.stubGlobal('fetch', fetchMock);
		scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView =
			scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
	});

	it('opens on the roast list, with the Studio section below it', async () => {
		const { container } = renderPage();

		const title = await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(screen.getByText('3 roasts in 2 batches · 15.0% average loss')).toBeInTheDocument();

		const batches = screen.getAllByRole('button', { name: /Toggle .* batch/ });
		expect(batches).toHaveLength(2);
		for (const batch of batches) expect(batch).toHaveAttribute('aria-expanded', 'true');

		const studio = container.querySelector('#profile-studio');
		expect(studio).not.toBeNull();
		expect(precedes(title, batches[0])).toBe(true);
		expect(precedes(batches[batches.length - 1], studio!)).toBe(true);
		expect(screen.getByRole('link', { name: 'Compare and plan' })).toHaveAttribute(
			'href',
			'#profile-studio'
		);

		// The hero, the four tiles, and the debugging line are gone.
		expect(screen.queryByText('Roast studio')).toBeNull();
		expect(screen.queryByText('New roast profile')).toBeNull();
		expect(screen.queryByText('Logged roasts')).toBeNull();
		expect(screen.queryByText(/items in raw data/)).toBeNull();
	});

	it('opens a roast from the list at the top of the page, with the Studio section below', async () => {
		const { container } = renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });

		await fireEvent.click(screen.getByRole('button', { name: /Guatemala/ }));

		const title = await screen.findByRole('heading', { level: 1, name: 'Guatemala' });
		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Roasts' })).toBeNull();
		expect(precedes(title, container.querySelector('#profile-studio')!)).toBe(true);

		// The roast is written to the link, and the page is not told to keep its scroll
		// position, so the roast is read from its title down.
		expect(goto).toHaveBeenLastCalledWith('/roast?profileId=3', {
			replaceState: true,
			keepFocus: true,
			noScroll: false
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('opens a roast by link without moving the page', async () => {
		visit('/roast?profileId=2');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });
		expect(
			screen.getByText('Roast #2 · Oct 1, 2026 · Morning batch · 16 → 13.6 oz (15.0% loss)')
		).toBeInTheDocument();
		expect(screen.getByRole('list', { name: 'Milestones' })).toHaveTextContent('First crack');

		expect(goto).toHaveBeenLastCalledWith('/roast?profileId=2', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('returns to the list from an open roast', async () => {
		visit('/roast?profileId=2');
		renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });

		await fireEvent.click(screen.getByRole('link', { name: '← Roasts' }));

		await waitFor(() =>
			expect(screen.getByRole('heading', { level: 1, name: 'Roasts' })).toBeInTheDocument()
		);
		expect(goto).toHaveBeenLastCalledWith('/roast', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});
});
