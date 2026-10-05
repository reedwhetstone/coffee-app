import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedPage from './+page.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('http://localhost/roast/saved') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/profileStudio/analytics', () => ({ trackProfileStudioActivation: vi.fn() }));

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';

const reference = (id: string, title: string, sourceClass: string, createdAt: string) => ({
	id,
	title,
	notes: null,
	sourceClass,
	status: 'active',
	artisanFileAvailable: sourceClass === 'artisan_upload',
	currentRevisionId: `${id}-revision`,
	createdAt,
	updatedAt: createdAt,
	sourceRoast: null
});

const keeper = reference(
	KEEPER,
	'Guji natural, September keeper',
	'artisan_upload',
	'2026-09-28T12:00:00Z'
);
const plan = reference(
	PLAN,
	'Guji plan: +5°F through drying',
	'generated_revision',
	'2026-10-02T12:00:00Z'
);

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

let references = [keeper, plan];
const requested: string[] = [];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	requested.push(`${init?.method ?? 'GET'} ${url}`);
	if (url === '/api/reference-profiles') return json({ data: references });
	if (init?.method === 'DELETE') return new Response(null, { status: 204 });
	if (url.endsWith('/chart')) {
		return json({
			data: { chart: { temperatureUnit: 'F', chargeTimeMilliseconds: 0, series: [], events: [] } }
		});
	}
	throw new Error(`Unexpected request: ${url}`);
});

async function visit(path = '/roast/saved') {
	pageState.url = new URL(`http://localhost${path}`);
	const view = render(SavedPage, {
		data: {
			auth: {
				isSignedIn: true,
				user: { id: 'member-1', email: 'member@example.com' },
				role: 'member',
				ppiAccess: false
			}
		}
	} as never);
	await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeNull());
	return view;
}

describe('/roast/saved', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		references = [keeper, plan];
		requested.length = 0;
		sessionStorage.clear();
		vi.stubGlobal('fetch', fetchMock);
	});

	it('is the second of the two lists under Roast, one link from the first', async () => {
		await visit();

		expect(
			screen.getByRole('heading', { level: 1, name: 'Saved references and plans' })
		).toBeInTheDocument();
		const segments = screen.getByRole('navigation', {
			name: 'Roasts, and saved references and plans'
		});
		const roasts = within(segments).getByRole('link', { name: 'Roasts' });
		expect(roasts).toHaveAttribute('href', '/roast');
		expect(roasts).not.toHaveAttribute('aria-current');
		expect(
			within(segments).getByRole('link', { name: 'Saved references and plans' })
		).toHaveAttribute('aria-current', 'page');

		const rows = within(
			screen.getByRole('list', { name: 'Saved references and plans, newest first' })
		).getAllByRole('listitem');
		expect(rows).toHaveLength(2);
		expect(within(rows[0]).getByText('Plan · Saved Oct 2, 2026')).toBeInTheDocument();
		expect(within(rows[1]).getByText('Artisan file · Saved Sep 28, 2026')).toBeInTheDocument();
	});

	it('names nothing a Studio and uses none of the retired names', async () => {
		const { container } = await visit();

		expect(container.textContent).not.toMatch(/studio/i);
		expect(container.textContent).not.toMatch(/saved profiles|snapshot|executed roast/i);
		expect(document.querySelector('[href*="profile-studio"]')).toBeNull();
	});

	it('opens the curve of the reference named in the link', async () => {
		await visit(`/roast/saved?ref=${KEEPER}`);

		await waitFor(() =>
			expect(requested).toContain(
				`GET /api/reference-profiles/${KEEPER}/revisions/${KEEPER}-revision/chart`
			)
		);
		expect(screen.getByRole('link', { name: `Hide curve: ${keeper.title}` })).toHaveAttribute(
			'href',
			'/roast/saved'
		);
	});

	it('opens no curve for a link that does not name a saved reference', async () => {
		await visit('/roast/saved?ref=4531');

		expect(requested.filter((request) => request.endsWith('/chart'))).toEqual([]);
		expect(screen.queryByText(/could not be found/)).toBeNull();
		expect(screen.queryByRole('link', { name: /Hide curve/ })).toBeNull();
	});

	it('takes a removed reference out of the link, so Back does not reopen it', async () => {
		await visit(`/roast/saved?ref=${KEEPER}`);
		await fireEvent.click(screen.getByRole('button', { name: `More for ${keeper.title}` }));
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
		);

		await waitFor(() => expect(goto).toHaveBeenCalledOnce());
		expect(goto).toHaveBeenCalledWith('/roast/saved', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});
});
