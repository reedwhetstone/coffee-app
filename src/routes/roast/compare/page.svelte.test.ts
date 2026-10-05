import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import ComparePage from './+page.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('http://localhost/roast/compare') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';

function roast(overrides: Partial<RoastProfile>): RoastProfile {
	return {
		roast_id: 4531,
		batch_name: 'Wednesday roast',
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		roast_date: '2026-10-01',
		charge_time: 0,
		fc_start_time: 498,
		drop_time: 618,
		...overrides
	} as RoastProfile;
}

const roasts = [
	roast({ roast_id: 4531 }),
	roast({ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' }),
	roast({ roast_id: 4507, roast_date: '2026-09-17' })
];

const references = [
	{ id: KEEPER, title: 'Guji natural, September keeper', sourceClass: 'artisan_upload' },
	{ id: PLAN, title: 'Guji plan: +5°F through drying', sourceClass: 'generated_revision' }
].map((entry) => ({
	...entry,
	notes: null,
	status: 'active',
	currentRevisionId: `${entry.id}-revision`,
	createdAt: '2026-09-28T00:00:00Z',
	updatedAt: '2026-09-28T00:00:00Z'
}));

const comparison = {
	alignment: 'charge',
	targetUnit: 'F',
	left: { type: 'executed_roast', id: '4531', revision: 'l' },
	right: { type: 'executed_roast', id: '4507', revision: 'r' },
	series: [],
	milestones: [
		{ name: 'charge', leftMilliseconds: 0, rightMilliseconds: 0, deltaMilliseconds: 0 },
		{
			name: 'fc_start',
			leftMilliseconds: 498_000,
			rightMilliseconds: 453_000,
			deltaMilliseconds: -45_000
		}
	]
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

let roastListFails = false;
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
	const url = String(input);
	if (url === '/api/reference-profiles/compare') return json({ data: comparison });
	if (url === '/api/reference-profiles') return json({ data: references });
	if (url === '/api/roast-profiles') {
		return roastListFails ? json({ error: 'unavailable' }, 503) : json({ data: roasts });
	}
	throw new Error(`Unexpected request: ${url}`);
});

/** Opens the page at a comparison link, as a shared link or a reload would. */
function visit(path: string, initial: unknown = { data: { data: roasts }, error: null }) {
	pageState.url = new URL(`http://localhost${path}`);
	return render(ComparePage, {
		data: {
			auth: { isSignedIn: true, user: { id: 'member-1' }, role: 'member', ppiAccess: false },
			initialRoasts: Promise.resolve(initial)
		}
	} as never);
}

const compareBodies = () =>
	fetchMock.mock.calls
		.filter(([url]) => String(url) === '/api/reference-profiles/compare')
		.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1]?.body)));

describe('/roast/compare', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		roastListFails = false;
		vi.stubGlobal('fetch', fetchMock);
	});

	it('is titled for what it does and leads back to the roasts', async () => {
		visit('/roast/compare');

		expect(screen.getByRole('heading', { level: 1, name: 'Compare roasts' })).toBeInTheDocument();
		expect(
			screen.getByText('Line up any two roasts or saved references. Both curves start at charge.')
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute('href', '/roast');
		expect(document.body.textContent).not.toMatch(/profile studio|roast studio/i);
		// With neither side in the link, both pickers wait to be used.
		const first = await screen.findByRole('combobox', { name: 'First (A)' });
		expect(first).toHaveValue('');
		expect(screen.getByRole('combobox', { name: 'Second (B)' })).toHaveValue('');
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(compareBodies()).toEqual([]);
	});

	it('draws the comparison named by a and b in the link', async () => {
		visit('/roast/compare?a=roast:4531&b=roast:4507');

		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		expect(compareBodies()).toEqual([
			{
				left: { kind: 'executed_roast', id: '4531' },
				right: { kind: 'executed_roast', id: '4507' },
				targetUnit: 'F'
			}
		]);
		// Opening a shared link does not rewrite it.
		expect(goto).not.toHaveBeenCalled();
	});

	it('opens the second picker when the link names only a', async () => {
		visit('/roast/compare?a=roast:4531');

		const listbox = await screen.findByRole('listbox', { name: 'Second (B)' });
		expect(
			screen.getByText(
				'Choose a second roast or saved reference to compare with Ethiopia Yirgacheffe Wush Wush, Oct 1.'
			)
		).toBeInTheDocument();

		// The same coffee's other roast leads the list; choosing it completes the link in place.
		const options = within(listbox).getAllByRole('option');
		expect(options[0]).toHaveTextContent('Roast #4507');
		await fireEvent.click(options[0]);

		expect(goto).toHaveBeenCalledWith('/roast/compare?a=roast:4531&b=roast:4507', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('compares two saved references named in the link, with no roast', async () => {
		visit(`/roast/compare?a=ref:${KEEPER}&b=ref:${PLAN}`);

		await waitFor(() =>
			expect(compareBodies()).toEqual([
				{
					left: { kind: 'reference_profile', id: KEEPER },
					right: { kind: 'reference_profile', id: PLAN },
					targetUnit: 'F'
				}
			])
		);
		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
	});

	it('writes a saved reference chosen on the page as ref:<id>', async () => {
		visit('/roast/compare?a=roast:4531');

		const listbox = await screen.findByRole('listbox', { name: 'Second (B)' });
		await fireEvent.click(await within(listbox).findByRole('option', { name: /September keeper/ }));

		expect(goto).toHaveBeenCalledWith(
			`/roast/compare?a=roast:4531&b=ref:${KEEPER}`,
			expect.objectContaining({ replaceState: true })
		);
	});

	it('ignores a side it cannot read and keeps the one it can', async () => {
		visit('/roast/compare?a=nonsense&b=roast:4507');

		const second = await screen.findByRole('combobox', { name: 'Second (B)' });
		expect(second).toHaveValue('Ethiopia Yirgacheffe Wush Wush');
		expect(compareBodies()).toEqual([]);
	});

	it('says when the roasts could not be loaded, and tries again', async () => {
		roastListFails = true;
		visit('/roast/compare?a=roast:4531&b=roast:4507', { data: null, error: 'Failed (503)' });

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Roasts could not be loaded.');
		// Neither roast is blamed, and nothing is compared until they load.
		expect(screen.queryByText('That roast could not be found')).toBeNull();
		expect(compareBodies()).toEqual([]);

		roastListFails = false;
		await fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('still compares two saved references when the roasts could not be loaded', async () => {
		roastListFails = true;
		visit(`/roast/compare?a=ref:${KEEPER}&b=ref:${PLAN}`, { data: null, error: 'Failed (503)' });

		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		expect(compareBodies()).toEqual([
			{
				left: { kind: 'reference_profile', id: KEEPER },
				right: { kind: 'reference_profile', id: PLAN },
				targetUnit: 'F'
			}
		]);
		expect(screen.getByRole('alert')).toHaveTextContent('Roasts could not be loaded.');
	});

	it('keeps a drawn comparison on screen while the roasts are tried again', async () => {
		roastListFails = true;
		visit(`/roast/compare?a=ref:${KEEPER}&b=ref:${PLAN}`, { data: null, error: 'Failed (503)' });
		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() =>
			expect(
				fetchMock.mock.calls.filter(([url]) => String(url) === '/api/roast-profiles')
			).toHaveLength(1)
		);
		expect(screen.getByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		// The comparison was not run a second time.
		expect(compareBodies()).toHaveLength(1);
	});
});
