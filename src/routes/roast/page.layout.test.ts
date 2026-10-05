import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import RoastPage from './+page.svelte';
import { roastListResponse } from './__test-fixtures__/roastListBackend';

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
		batch_id: 'aaaaaaaa-0000-4000-8000-000000000001',
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
		batch_id: 'aaaaaaaa-0000-4000-8000-000000000002',
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
	if (url.startsWith('/api/roast-profiles')) return roastListResponse(roasts, url);
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
			}
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

	it('opens on the roast list, with no Studio section on the page', async () => {
		const { container } = renderPage();

		const title = await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(screen.getByText('3 roasts in 2 batches · 15.0% average loss')).toBeInTheDocument();

		const batches = screen.getAllByRole('button', { name: /Toggle .* batch/ });
		expect(batches).toHaveLength(2);
		for (const batch of batches) expect(batch).toHaveAttribute('aria-expanded', 'true');

		expect(precedes(title, batches[0])).toBe(true);
		// Comparing, planning, and the saved library each have their own page, one link away.
		const compare = screen.getByRole('link', { name: 'Compare roasts' });
		expect(compare).toHaveAttribute('href', '/roast/compare');
		expect(precedes(compare, batches[0])).toBe(true);
		expect(screen.getByRole('link', { name: 'Plan next roast' })).toHaveAttribute(
			'href',
			'/roast/plan'
		);
		const segments = screen.getByRole('navigation', {
			name: 'Roasts, and saved references and plans'
		});
		expect(within(segments).getByRole('link', { name: 'Roasts' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		const saved = within(segments).getByRole('link', { name: 'Saved references and plans' });
		expect(saved).toHaveAttribute('href', '/roast/saved');
		expect(saved).not.toHaveAttribute('aria-current');
		expect(precedes(segments, batches[0])).toBe(true);
		expect(screen.queryByRole('link', { name: 'Compare and plan' })).toBeNull();

		// The Studio section is gone, with its upload, snapshot, and numbered steps.
		expect(container.querySelector('#profile-studio')).toBeNull();
		expect(container.querySelector('[href="#profile-studio"]')).toBeNull();
		expect(container.textContent).not.toMatch(/profile studio|roast studio/i);
		expect(screen.queryByText('Upload an Artisan reference')).toBeNull();
		expect(screen.queryByText('Save a historical roast')).toBeNull();
		expect(screen.queryByText(/Ask Cherry/)).toBeNull();

		// The hero, the four tiles, and the debugging line are gone.
		expect(screen.queryByText('Roast studio')).toBeNull();
		expect(screen.queryByText('New roast profile')).toBeNull();
		expect(screen.queryByText('Logged roasts')).toBeNull();
		expect(screen.queryByText(/items in raw data/)).toBeNull();
	});

	it('opens a roast from the list at the top of the page, with no Studio section under it', async () => {
		const { container } = renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });

		await fireEvent.click(screen.getByRole('button', { name: /Guatemala/ }));

		const title = await screen.findByRole('heading', { level: 1, name: 'Guatemala' });
		expect(screen.getByRole('link', { name: '← Roasts' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Roasts' })).toBeNull();
		expect(title).toBeInTheDocument();
		expect(container.querySelector('#profile-studio')).toBeNull();
		expect(container.textContent).not.toMatch(/profile studio|roast studio/i);

		// The roast is written to the link, and the page is not told to keep its scroll
		// position, so the roast is read from its title down.
		expect(goto).toHaveBeenLastCalledWith('/roast?roast=3', {
			replaceState: true,
			keepFocus: true,
			noScroll: false
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('opens a roast by link without moving the page', async () => {
		visit('/roast?roast=2');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });
		expect(
			screen.getByText('Roast #2 · Oct 1, 2026 · Morning batch · 16 → 13.6 oz (15.0% loss)')
		).toBeInTheDocument();
		expect(screen.getByRole('list', { name: 'Milestones' })).toHaveTextContent('First crack');

		expect(goto).toHaveBeenLastCalledWith('/roast?roast=2', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('still opens a roast from a link written with the earlier ?profileId= name', async () => {
		visit('/roast?profileId=2');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });

		// The address is rewritten to the current name, without a second copy of the roast.
		expect(goto).toHaveBeenLastCalledWith('/roast?roast=2', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('reads ?roast= ahead of ?profileId= when a link carries both', async () => {
		visit('/roast?profileId=2&roast=3');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Guatemala' }, { timeout: 3000 });
		expect(goto).toHaveBeenLastCalledWith('/roast?roast=3', expect.anything());
	});

	it('offers the open roast for comparison, with that roast already chosen', async () => {
		visit('/roast?roast=2');
		renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });

		expect(screen.getByRole('link', { name: 'Compare with…' })).toHaveAttribute(
			'href',
			'/roast/compare?a=roast:2'
		);
	});

	it('shows a roast as cleared once its recorded data is cleared from More', async () => {
		let cleared = false;
		const clearedRoast = roast({
			roast_id: 2,
			coffee_id: 8,
			coffee_name: 'Colombia',
			oz_out: null,
			weight_loss_percent: null,
			charge_time: null,
			fc_start_time: null,
			drop_time: null,
			total_roast_time: null
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.startsWith('/api/clear-roast') && init?.method === 'DELETE') {
					cleared = true;
					return json({ success: true });
				}
				if (url.startsWith('/api/roast-profiles') && cleared) {
					return roastListResponse([roasts[0], clearedRoast, roasts[2]], url);
				}
				return fetchMock(input);
			})
		);
		vi.stubGlobal(
			'confirm',
			vi.fn(() => true)
		);
		visit('/roast?roast=2');
		renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Colombia' }, { timeout: 3000 });
		expect(screen.getByRole('list', { name: 'Milestones' })).toBeInTheDocument();
		// The page ignores a second selection for 100 ms after a roast opens.
		await new Promise((resolve) => setTimeout(resolve, 150));

		await fireEvent.click(screen.getByRole('button', { name: 'More' }));
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Clear recorded data' }));

		// The roast stays open and reads as it now is, without a reload of the page.
		expect(await screen.findByText('Nothing recorded for this roast yet.')).toBeInTheDocument();
		expect(screen.queryByRole('list', { name: 'Milestones' })).toBeNull();
		expect(screen.getByRole('heading', { level: 1, name: 'Colombia' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Compare with…' })).toBeDisabled();
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
