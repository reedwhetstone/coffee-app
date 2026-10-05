import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from './+page.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('http://localhost/roast/plan') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';
const NEW_PLAN = 'eeeeeeee-0000-4000-8000-000000000001';
const KEPT = 'bbbbbbbb-0000-4000-8000-000000004531';
const KEPT_REVISION = 'bbbbbbbb-1111-4000-8000-000000004531';

const reference = (id: string, title: string, sourceClass: string, createdAt: string) => ({
	id,
	title,
	notes: null,
	sourceClass,
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt,
	updatedAt: createdAt,
	sourceRoast: null
});

const keeper = reference(KEEPER, 'Guji natural, September keeper', 'artisan_upload', '2026-09-28');
const savedPlan = reference(
	PLAN,
	'Guji plan: +5°F through drying',
	'generated_revision',
	'2026-10-02T00:00:00Z'
);

const candidates = {
	roasts: [
		{
			roastId: 4531,
			roastRevision: 'revision-4531',
			label: 'Roast 4531',
			batchName: 'Wednesday roast',
			coffeeName: 'Ethiopia Yirgacheffe Wush Wush',
			roastDate: '2026-10-01',
			reference: { profileId: KEPT, revisionId: KEPT_REVISION, saved: false }
		}
	],
	eligibleCount: 1,
	totalRoastCount: 14,
	ineligibleRoastCount: 13
};

const chart = {
	temperatureUnit: 'F',
	chargeTimeMilliseconds: 30_000,
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			deviceIndex: 0,
			channel: 2,
			points: [
				{ timeMilliseconds: 30_000, value: 392 },
				{ timeMilliseconds: 630_000, value: 402 }
			]
		}
	],
	events: []
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

let references = [keeper, savedPlan];
let candidatesFail = false;
let referencesFail = false;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	if (url === '/api/reference-profiles') {
		return referencesFail ? json({ error: 'unavailable' }, 503) : json({ data: references });
	}
	if (url === '/api/reference-profiles/from-roast/candidates') {
		return candidatesFail ? json({ error: 'unavailable' }, 503) : json({ data: candidates });
	}
	if (url === '/api/roast-chart-data?roastId=4531') {
		return json({
			points: [],
			series: [],
			events: [],
			metadata: { revision: 'revision-4531', charge_time_ms: 30_000, temperature_unit: 'F' }
		});
	}
	if (url === '/api/reference-profiles/from-roast/preview') {
		const input = JSON.parse(String(init?.body));
		return json({
			data: {
				parentRevisionId: KEPT_REVISION,
				title: input.title,
				changes: input.changes,
				chart,
				exportEligible: true,
				parentProfileId: KEPT,
				parentSaved: false,
				sourceRoast: { id: 4531, revision: 'revision-4531', label: 'Roast 4531' }
			}
		});
	}
	if (url === '/api/reference-profiles/from-roast') {
		return json({ data: { id: KEPT, currentRevisionId: KEPT_REVISION, title: 'Wednesday roast' } });
	}
	if (url === `/api/reference-profiles/${KEPT}/revisions/${KEPT_REVISION}/generated`) {
		const title = JSON.parse(String(init?.body)).title;
		// From here the new plan is among the saved references.
		references = [
			...references,
			reference(NEW_PLAN, title, 'generated_revision', '2026-10-04T00:00:00Z')
		];
		return json({ data: { id: NEW_PLAN, currentRevisionId: `${NEW_PLAN}-revision`, title } }, 201);
	}
	const chartOf = url.match(/^\/api\/reference-profiles\/([^/]+)\/revisions\/[^/]+\/chart$/);
	if (chartOf) {
		return json({
			data: {
				profile: references.find((entry) => entry.id === chartOf[1]),
				revision: { parentRevisionId: chartOf[1] === PLAN ? keeper.currentRevisionId : null },
				chart
			}
		});
	}
	throw new Error(`Unexpected request: ${url}`);
});

/** Opens the page at a plan link, as a shared link or a reload would. */
function visit(path: string) {
	pageState.url = new URL(`http://localhost${path}`);
	return render(PlanPage, {
		data: { auth: { isSignedIn: true, user: { id: 'member-1' }, role: 'member', ppiAccess: false } }
	} as never);
}

const requested = (url: string) => fetchMock.mock.calls.some(([input]) => String(input) === url);

describe('/roast/plan', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		references = [keeper, savedPlan];
		candidatesFail = false;
		referencesFail = false;
		sessionStorage.clear();
		vi.stubGlobal('fetch', fetchMock);
	});

	it('is titled for what it does and leads back to the roasts', async () => {
		visit('/roast/plan');

		expect(
			screen.getByRole('heading', { level: 1, name: 'Plan your next roast' })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Start from a roast or reference you liked, adjust it, and save the result as a curve to follow in Artisan. Your roast history is not changed.'
			)
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '← Roasts' })).toHaveAttribute('href', '/roast');
		expect(document.body.textContent).not.toMatch(/profile studio|roast studio/i);

		// The four steps, in order, with nothing chosen yet.
		await screen.findByRole('combobox', { name: 'Roast or saved reference' });
		expect(
			screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
		).toEqual(['1. Start from', '2. What to change', '3. Preview', '4. Save and send to Artisan']);
		expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
		expect(screen.getByText('Up to 20 °F (10 °C).')).toBeInTheDocument();
	});

	it('sends plans already saved to the saved library instead of listing them here', async () => {
		references = [keeper, savedPlan];
		visit('/roast/plan');

		await screen.findByRole('combobox', { name: 'Roast or saved reference' });
		const pointer = screen.getByText(/Plans you have saved, with their downloads, are in/);
		expect(
			within(pointer).getByRole('link', { name: 'Saved references and plans' })
		).toHaveAttribute('href', '/roast/saved');
		expect(screen.queryByRole('region', { name: 'Saved plans' })).toBeNull();
		expect(screen.queryByRole('link', { name: /Download for Artisan/ })).toBeNull();
	});

	it('opens with the roast in the link chosen, and counts the roasts that cannot be used', async () => {
		visit('/roast/plan?from=roast:4531');

		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: 'Roast or saved reference' })).toHaveValue(
				'Ethiopia Yirgacheffe Wush Wush'
			)
		);
		expect(
			screen.getByText(
				"13 roasts have no Artisan file on record, so a plan cannot be built from them. Import a roast's .alog to plan from it."
			)
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
	});

	it('opens with the saved reference in the link chosen', async () => {
		visit(`/roast/plan?from=ref:${KEEPER}`);

		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: 'Roast or saved reference' })).toHaveValue(
				'Guji natural, September keeper'
			)
		);
	});

	it('writes a new start into the link in place, so Back still leaves the page', async () => {
		visit('/roast/plan');
		const picker = await screen.findByRole('combobox', { name: 'Roast or saved reference' });

		await fireEvent.focus(picker);
		await fireEvent.click(
			within(screen.getByRole('listbox')).getByRole('option', { name: /Roast #4531/ })
		);

		expect(goto).toHaveBeenCalledWith('/roast/plan?from=roast:4531', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('goes to the saved plan after saving, as a new entry in history', async () => {
		visit('/roast/plan?from=roast:4531');
		const preview = await screen.findByRole('button', { name: 'Preview' });
		await waitFor(() => expect(preview).toBeEnabled());

		await fireEvent.click(preview);
		await screen.findByText('Plan preview · not saved yet');
		await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

		await waitFor(() => expect(goto).toHaveBeenCalledWith(`/roast/plan?plan=${NEW_PLAN}`));
		// The saved references were read again, so the new plan is there to open.
		expect(
			fetchMock.mock.calls.filter(([url]) => String(url) === '/api/reference-profiles')
		).toHaveLength(2);
	});

	it('does not offer to save a plan again when it was saved and could not be opened', async () => {
		goto.mockRejectedValueOnce(new Error('Navigation failed'));
		visit('/roast/plan?from=roast:4531');
		const preview = await screen.findByRole('button', { name: 'Preview' });
		await waitFor(() => expect(preview).toBeEnabled());

		await fireEvent.click(preview);
		await screen.findByText('Plan preview · not saved yet');
		await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

		const saved = await screen.findByRole('status');
		expect(saved).toHaveTextContent('Ethiopia Yirgacheffe Wush Wush plan is saved.');
		expect(within(saved).getByRole('link', { name: 'Open the saved plan' })).toHaveAttribute(
			'href',
			`/roast/plan?plan=${NEW_PLAN}`
		);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
		// The plan is also in the saved library, which the page points to.
		expect(screen.getByRole('link', { name: 'Saved references and plans' })).toHaveAttribute(
			'href',
			'/roast/saved'
		);
	});

	it('reopens a saved plan with its download and what to do with it in Artisan', async () => {
		visit(`/roast/plan?plan=${PLAN}`);

		expect(
			await screen.findByRole('heading', { level: 2, name: 'Guji plan: +5°F through drying' })
		).toBeInTheDocument();
		const download = screen.getByRole('link', { name: 'Download for Artisan (.alog)' });
		expect(download).toHaveAttribute(
			'href',
			`/api/reference-profiles/${PLAN}/revisions/${PLAN}-revision/export`
		);
		expect(download).toHaveAttribute('download');
		expect(
			screen.getByText(
				'In Artisan, open Roast, then Background, and load this file. The plan appears behind your live curve as a guide. It does not control your roaster, unless Artisan is set to play back a background’s events or to follow the background.'
			)
		).toBeInTheDocument();

		// It names what it was made from, and both can be taken further.
		expect(
			await screen.findByText(
				'Plan · Saved Oct 2, 2026 · Started from Guji natural, September keeper'
			)
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Compare with what it started from' })).toHaveAttribute(
			'href',
			`/roast/compare?a=ref:${KEEPER}&b=ref:${PLAN}`
		);
		expect(screen.getByRole('link', { name: 'Plan from this' })).toHaveAttribute(
			'href',
			`/roast/plan?from=ref:${PLAN}`
		);

		// A plan that was only reopened is not announced as newly saved, and no form is drawn.
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
		expect(requested('/api/reference-profiles/from-roast/preview')).toBe(false);
	});

	it('says so when the plan in the link is not one of the account’s plans', async () => {
		// A saved reference that is not a plan has no download.
		visit(`/roast/plan?plan=${KEEPER}`);

		expect(
			await screen.findByRole('heading', { level: 2, name: 'That plan could not be found.' })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Plan a roast' })).toHaveAttribute(
			'href',
			'/roast/plan'
		);
		expect(screen.queryByRole('link', { name: 'Download for Artisan (.alog)' })).toBeNull();
	});

	it('stays usable for saved references when the roasts cannot be loaded', async () => {
		candidatesFail = true;
		visit(`/roast/plan?from=ref:${KEEPER}`);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Roasts could not be loaded.');
		expect(screen.getByRole('combobox', { name: 'Roast or saved reference' })).toHaveValue(
			'Guji natural, September keeper'
		);

		candidatesFail = false;
		await fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
		expect(screen.getByText(/13 roasts have no Artisan file on record/)).toBeInTheDocument();
	});

	it('does not call a saved reference missing when the saved references could not be loaded', async () => {
		referencesFail = true;
		visit(`/roast/plan?from=ref:${KEEPER}`);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Saved references and plans could not be loaded.');
		expect(screen.queryByText('That saved reference could not be found.')).toBeNull();
		expect(screen.queryByText(/A plan starts from a roast or reference/)).toBeNull();

		referencesFail = false;
		await fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: 'Roast or saved reference' })).toHaveValue(
				'Guji natural, September keeper'
			)
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('does not call a saved plan missing when the saved plans could not be loaded', async () => {
		referencesFail = true;
		visit(`/roast/plan?plan=${PLAN}`);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Saved references and plans could not be loaded.');
		expect(screen.queryByText('That plan could not be found.')).toBeNull();

		referencesFail = false;
		await fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
		expect(
			await screen.findByRole('link', { name: 'Download for Artisan (.alog)' })
		).toBeInTheDocument();
	});
});
