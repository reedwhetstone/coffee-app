import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import RoastPage from './+page.svelte';
import { roastListRequests, roastListResponse } from './__test-fixtures__/roastListBackend';

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
const SEP_27 = 'aaaaaaaa-0000-4000-8000-000000000002';
const SEP_20 = 'aaaaaaaa-0000-4000-8000-000000000003';

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

// Two coffees share the Oct 1 batch; the Sep 27 batch is all one coffee; Sep 20 is another.
const roasts = [
	roast({ roast_id: 4531, weight_loss_percent: 14 }),
	roast({ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' }),
	roast({
		roast_id: 4529,
		batch_id: SEP_27,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		weight_loss_percent: 12
	}),
	roast({
		roast_id: 4520,
		coffee_id: 103,
		coffee_name: 'Kenya Nyeri',
		batch_id: SEP_20,
		batch_name: 'Kenya sample',
		roast_date: '2026-09-20'
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

const roastRows = () =>
	screen
		.getAllByRole('button')
		.filter((button) => /ID: \d+/.test(button.textContent ?? ''))
		.map((button) => Number(button.textContent?.match(/ID: (\d+)/)?.[1]));

describe('the roast list opened for one coffee', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', fetchMock);
		Element.prototype.scrollIntoView =
			vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
	});

	it('shows every roast when the link names no coffee', async () => {
		visit('/roast');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(roastRows()).toEqual([4531, 4530, 4529, 4520]);
		expect(screen.getByText('4 roasts in 3 batches · 14.0% average loss')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Show roasts of every coffee' })).toBeNull();
	});

	it("shows only that coffee's roasts, named in a chip, with the count line for what is shown", async () => {
		visit('/roast?coffee=101');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		// The Oct 1 batch keeps its one roast of this coffee; the other coffee's batch is gone.
		expect(roastRows()).toEqual([4531, 4529]);
		expect(screen.getAllByRole('button', { name: /Toggle .* batch/ })).toHaveLength(2);
		expect(screen.queryByText('Colombia Sierra Nevada')).toBeNull();
		expect(screen.queryByText('Kenya Nyeri')).toBeNull();
		expect(screen.getByText('2 roasts in 2 batches · 13.0% average loss')).toBeInTheDocument();

		const clear = screen.getByRole('button', { name: 'Show roasts of every coffee' });
		expect(clear.parentElement).toHaveTextContent('Ethiopia Yirgacheffe Wush Wush');
		// The coffee narrows the list in the request, not in the browser.
		expect(roastListRequests(fetchMock)[0].get('coffee_id')).toBe('101');
	});

	it('removes the coffee from the address when the chip is removed', async () => {
		visit('/roast?coffee=101');
		renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });

		await fireEvent.click(screen.getByRole('button', { name: 'Show roasts of every coffee' }));

		expect(goto).toHaveBeenLastCalledWith('/roast', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('keeps the coffee in the address when a roast opens, and returns to the narrowed list', async () => {
		visit('/roast?coffee=101');
		renderPage();
		await screen.findByRole('heading', { level: 1, name: 'Roasts' });

		await fireEvent.click(screen.getByRole('button', { name: /ID: 4529/ }));

		await screen.findByRole('heading', { level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' });
		expect(goto).toHaveBeenLastCalledWith('/roast?coffee=101&roast=4529', expect.anything());

		const back = screen.getByRole('link', { name: '← Roasts' });
		expect(back).toHaveAttribute('href', '/roast?coffee=101');
		visit('/roast?coffee=101&roast=4529');
		await fireEvent.click(back);

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(goto).toHaveBeenLastCalledWith('/roast?coffee=101', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('keeps the other coffee of the batch on an open roast', async () => {
		visit('/roast?coffee=101&roast=4531');
		renderPage();

		await screen.findByRole(
			'heading',
			{ level: 1, name: 'Ethiopia Yirgacheffe Wush Wush' },
			{ timeout: 3000 }
		);
		expect(screen.getByText('Also in this batch:')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Colombia Sierra Nevada #4530' })
		).toBeInTheDocument();
	});

	it('says nothing was roasted for a coffee with no roasts, and clears back to every roast', async () => {
		visit('/roast?coffee=999');
		renderPage();

		await screen.findByRole('heading', { level: 1, name: 'Roasts' });
		expect(screen.getByText('No roasts match.')).toBeInTheDocument();
		expect(screen.getByText('Nothing was roasted for this coffee.')).toBeInTheDocument();
		expect(screen.queryByText('No roasts yet.')).toBeNull();
		expect(
			screen.getByRole('button', { name: 'Show roasts of every coffee' }).parentElement
		).toHaveTextContent('This coffee');

		await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

		expect(goto).toHaveBeenLastCalledWith(
			'/roast',
			expect.objectContaining({ replaceState: true })
		);
	});

	it.each(['/roast?coffee=abc', '/roast?coffee=0', '/roast?coffee='])(
		'ignores a coffee it cannot read: %s',
		async (address) => {
			visit(address);
			renderPage();

			await screen.findByRole('heading', { level: 1, name: 'Roasts' });
			expect(roastRows()).toEqual([4531, 4530, 4529, 4520]);
			expect(screen.queryByRole('button', { name: 'Show roasts of every coffee' })).toBeNull();
		}
	);
});
