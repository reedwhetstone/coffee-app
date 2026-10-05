import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { CompareSide } from '$lib/roast/compare-sides';
import type {
	ReferenceChart,
	RoastCandidate,
	RoastChartData,
	SavedReference
} from '$lib/roast/roast-plan';
import ProfileGeneration from './ProfileGeneration.svelte';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const CELSIUS = 'aaaaaaaa-0000-4000-8000-000000000002';
const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000004';
const KEPT = 'bbbbbbbb-0000-4000-8000-000000004531';
const KEPT_REVISION = 'bbbbbbbb-1111-4000-8000-000000004531';
const NEW_PLAN = 'eeeeeeee-0000-4000-8000-000000000001';

const reference = (
	id: string,
	title: string,
	extra: Partial<SavedReference> = {}
): SavedReference => ({
	id,
	title,
	notes: null,
	sourceClass: 'artisan_upload',
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt: '2026-09-22T00:00:00Z',
	updatedAt: '2026-09-22T00:00:00Z',
	sourceRoast: null,
	...extra
});

const candidate = (roastId: number, extra: Partial<RoastCandidate> = {}): RoastCandidate => ({
	roastId,
	roastRevision: `revision-${roastId}`,
	label: `Roast ${roastId}`,
	batchName: 'Wednesday roast',
	coffeeName: 'Ethiopia Yirgacheffe Wush Wush',
	roastDate: '2026-10-01',
	reference: { profileId: KEPT, revisionId: KEPT_REVISION, saved: false },
	...extra
});

const chart = (
	temperatureUnit: 'C' | 'F',
	chargeTimeMilliseconds: number | null = null
): ReferenceChart => ({
	temperatureUnit,
	chargeTimeMilliseconds,
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: temperatureUnit,
			deviceIndex: 0,
			channel: 2,
			points: [
				{ timeMilliseconds: 0, value: 100 },
				{ timeMilliseconds: 600_000, value: 200 }
			]
		}
	],
	events: []
});

/** A roast's recorded curve, as the roast chart route returns it. */
const roastChart = (roastId: number, chargeTimeMilliseconds: number | null): RoastChartData => ({
	points: [],
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			device_index: 0,
			channel: 2,
			total_points: 2,
			sampled_points: 2,
			points: [
				{ time_milliseconds: 0, value_numeric: 100 },
				{ time_milliseconds: 600_000, value_numeric: 200 }
			]
		}
	],
	events: [],
	metadata: {
		revision: `revision-${roastId}`,
		total_data_points: 2,
		sampled_data_points: 2,
		roast_duration_minutes: 10,
		time_min_ms: 0,
		time_max_ms: 600_000,
		temp_min: 100,
		temp_max: 200,
		ror_min: null,
		ror_max: null,
		charge_time_ms: chargeTimeMilliseconds,
		temperature_unit: 'F',
		profile_schema_version: 2,
		target_points: 400,
		sample_gap_max_ms: 600_000
	}
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function deferred() {
	let resolve!: (value: Response) => void;
	const promise = new Promise<Response>((done) => (resolve = done));
	return { promise, resolve };
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;

/** Answers each request with the first handler that knows it, and records the calls in order. */
function stubFetch(...handlers: Handler[]) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		for (const handler of handlers) {
			const answer = await handler(url, init);
			if (answer) return answer;
		}
		throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof stubFetch>, ending: string) =>
	fetchMock.mock.calls.filter(([url]) => String(url).endsWith(ending));
const bodyOf = (call: unknown[] | undefined) =>
	JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
const keyOf = (call: unknown[] | undefined) =>
	new Headers((call?.[1] as RequestInit | undefined)?.headers).get('Idempotency-Key');

/** A reference's saved chart, and a preview that echoes the change it was asked for. */
const referenceBackend =
	(profile: SavedReference, source: ReferenceChart): Handler =>
	(url, init) => {
		if (url.endsWith(`/${profile.id}/revisions/${profile.currentRevisionId}/chart`))
			return json({ data: { chart: source } });
		if (url.endsWith(`/${profile.id}/revisions/${profile.currentRevisionId}/preview`)) {
			const input = bodyOf([url, init]);
			return json({
				data: {
					parentRevisionId: profile.currentRevisionId,
					title: input.title,
					changes: input.changes,
					chart: source,
					exportEligible: true
				}
			});
		}
	};

/** A roast whose Artisan file is on record: its curve, a read-only preview, and the kept reference. */
function roastBackend(
	roastId: number,
	{ roastCharge = 30_000, fileCharge = 30_000 }: { roastCharge?: number; fileCharge?: number } = {}
): Handler {
	return (url, init) => {
		if (url === `/api/roast-chart-data?roastId=${roastId}`)
			return json(roastChart(roastId, roastCharge));
		if (url === '/api/reference-profiles/from-roast/preview') {
			const input = bodyOf([url, init]);
			return json({
				data: {
					parentRevisionId: KEPT_REVISION,
					title: input.title,
					changes: input.changes,
					chart: chart('F', fileCharge),
					exportEligible: true,
					parentProfileId: KEPT,
					parentSaved: false,
					sourceRoast: {
						id: roastId,
						revision: input.roastRevision,
						label: `Roast ${roastId}`,
						batchName: 'Wednesday roast',
						coffeeName: 'Ethiopia Yirgacheffe Wush Wush',
						roastDate: '2026-10-01'
					}
				}
			});
		}
		if (url === '/api/reference-profiles/from-roast' && init?.method === 'POST')
			return json(
				{ data: { id: KEPT, currentRevisionId: KEPT_REVISION, title: 'Wednesday roast' } },
				201
			);
	};
}

const planSaved: Handler = (url, init) => {
	if (url.endsWith('/generated') && init?.method === 'POST')
		return json(
			{
				data: {
					id: NEW_PLAN,
					currentRevisionId: `${NEW_PLAN}-revision`,
					title: bodyOf([url, init]).title
				}
			},
			201
		);
};

function show(props: {
	candidates?: RoastCandidate[];
	profiles?: SavedReference[];
	ineligibleRoastCount?: number;
	eligibleRoastCount?: number;
	referencesFailed?: boolean;
	roastsFailed?: boolean;
	from?: CompareSide | null;
	onSaved?: () => void | Promise<void>;
}) {
	const onSaved = vi.fn(props.onSaved);
	const onStartChange = vi.fn();
	const view = render(ProfileGeneration, {
		candidates: [],
		profiles: [],
		from: null,
		ownerId: 'owner',
		onStartChange,
		...props,
		onSaved
	});
	return { ...view, onSaved, onStartChange };
}

const previewButton = () => screen.getByRole('button', { name: 'Preview' });
const saveButton = () => screen.getByRole('button', { name: 'Save plan' });
const picker = () => screen.getByRole('combobox', { name: 'Roast or saved reference' });

async function chooseOption(label: string, value: string) {
	await fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** The reason a start cannot be used, once any check of it has finished. */
async function reasonShown(text: string | RegExp) {
	await screen.findByText(text);
	return screen.getByRole('status');
}

async function previewAndWait() {
	await fireEvent.click(previewButton());
	await screen.findByText('Plan preview · not saved yet');
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

describe('choosing what a plan starts from', () => {
	it('lists roasts newest first beside saved references and plans, and counts the roasts that cannot be used', async () => {
		stubFetch();
		const { onStartChange } = show({
			candidates: [candidate(4531), candidate(4507, { roastDate: '2026-09-17' })],
			profiles: [
				reference(KEEPER, 'Guji natural, September keeper'),
				reference(SNAPSHOT, 'Colombia snapshot', {
					sourceClass: 'executed_roast',
					sourceRoast: { id: 4525, revision: 'r' }
				})
			],
			ineligibleRoastCount: 55
		});

		expect(
			screen.getByText(
				"55 roasts have no Artisan file on record, so a plan cannot be built from them. Import a roast's .alog to plan from it."
			)
		).toBeInTheDocument();

		await fireEvent.focus(picker());
		const list = screen.getByRole('listbox');
		const [references, roasts] = within(list).getAllByRole('group');
		expect(within(references).getByText('Saved references and plans')).toBeInTheDocument();
		// A reference that only holds a roast's chart is not offered.
		expect(within(references).getAllByRole('option')).toHaveLength(1);
		expect(
			within(roasts)
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual([expect.stringContaining('Roast #4531'), expect.stringContaining('Roast #4507')]);

		await fireEvent.click(within(roasts).getAllByRole('option')[1]);
		expect(onStartChange).toHaveBeenCalledWith({ type: 'roast', id: 4507 });
	});

	it('says what a plan needs when there is nothing to start from', () => {
		stubFetch();
		show({ ineligibleRoastCount: 1 });

		expect(
			screen.getByText(/A plan starts from a roast or reference that still has its Artisan file\./)
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Import a roast from Artisan' })).toHaveAttribute(
			'href',
			'/roast?modal=new'
		);
		expect(screen.getByRole('link', { name: 'Saved references and plans' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'1 roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
	});

	it('does not call a saved reference missing, or the account empty, when the saved references could not be loaded', async () => {
		stubFetch();
		const view = show({ referencesFailed: true, from: { type: 'ref', id: KEEPER } });

		// The page says the list failed and offers another try; the form concludes nothing from it.
		expect(screen.queryByText('That saved reference could not be found.')).toBeNull();
		expect(screen.queryByText(/A plan starts from a roast or reference/)).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
		expect(previewButton()).toBeDisabled();

		await fireEvent.focus(picker());
		const [references, roasts] = within(screen.getByRole('listbox')).getAllByRole('group');
		expect(
			within(references).getByText('Saved references and plans could not be loaded.')
		).toBeInTheDocument();
		expect(
			within(roasts).getByText('No roasts with an Artisan file on record yet.')
		).toBeInTheDocument();

		// Once the list is read, the reference in the link is chosen.
		await fireEvent.keyDown(picker(), { key: 'Escape' });
		const keeper = reference(KEEPER, 'Guji natural, September keeper');
		stubFetch(referenceBackend(keeper, chart('F', 30_000)));
		await view.rerender({ referencesFailed: false, profiles: [keeper] });
		await waitFor(() => expect(picker()).toHaveValue('Guji natural, September keeper'));
		await waitFor(() => expect(previewButton()).toBeEnabled());
	});

	it('still says a saved reference is missing once the saved references were read', () => {
		stubFetch();
		show({ roastsFailed: true, from: { type: 'ref', id: KEEPER } });

		expect(screen.getByRole('status')).toHaveTextContent(
			'That saved reference could not be found.'
		);
	});

	it('does not say there is nothing to start from when the roasts could not be loaded', async () => {
		stubFetch();
		show({ roastsFailed: true });

		expect(screen.queryByText(/A plan starts from a roast or reference/)).toBeNull();
		await fireEvent.focus(picker());
		const [, roasts] = within(screen.getByRole('listbox')).getAllByRole('group');
		expect(within(roasts).getByText('Roasts could not be loaded.')).toBeInTheDocument();
	});

	it('says the list holds only the newest roasts when more can be planned from', () => {
		stubFetch();
		show({ candidates: [candidate(4531), candidate(4507)], eligibleRoastCount: 62 });

		expect(
			screen.getByText(
				'The 2 newest roasts are listed. To plan from an older one, open that roast and choose “Plan next roast from this”.'
			)
		).toBeInTheDocument();
	});

	it('arrives with the roast from the link chosen and its plan named after the coffee', async () => {
		stubFetch(roastBackend(4531));
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		expect(picker()).toHaveValue('Ethiopia Yirgacheffe Wush Wush');
		expect(screen.getByLabelText('Plan name')).toHaveValue('Ethiopia Yirgacheffe Wush Wush plan');
		expect(previewButton()).toBeEnabled();
		// Nothing can be saved, or downloaded, before there is a preview.
		expect(saveButton()).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Download for Artisan (.alog)' })).toBeDisabled();
	});
});

describe('planning from a roast', () => {
	it('previews without saving, then keeps the roast’s file and saves the plan on it', async () => {
		const fetchMock = stubFetch(roastBackend(4531), planSaved);
		const { onSaved } = show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await previewAndWait();

		// The preview is the read-only call, with minutes after charge sent on the recording's clock.
		const previews = calls(fetchMock, '/from-roast/preview');
		expect(previews).toHaveLength(1);
		expect(bodyOf(previews[0])).toMatchObject({
			roastId: 4531,
			roastRevision: 'revision-4531',
			changes: {
				temperatureAdjustments: [
					{
						kind: 'bean_temperature',
						startMilliseconds: 30_000,
						endMilliseconds: 330_000,
						delta: 5
					}
				]
			}
		});
		expect(calls(fetchMock, '/from-roast')).toHaveLength(0);
		expect(calls(fetchMock, '/generated')).toHaveLength(0);
		expect(
			screen.getByText('+5°F bean temperature, 0 to 5 minutes after charge')
		).toBeInTheDocument();
		expect(screen.getByText(/The dashed line is what you started from\./)).toHaveTextContent(
			'Ethiopia Yirgacheffe Wush Wush · Roasted Oct 1, 2026 · Wednesday roast · Roast #4531'
		);

		await fireEvent.click(saveButton());
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());

		// Two calls, in order: the roast's Artisan file is kept, then the plan is saved on it.
		const order = fetchMock.mock.calls
			.filter(([, init]) => init?.method === 'POST')
			.map(([url]) => String(url));
		expect(order).toEqual([
			'/api/reference-profiles/from-roast/preview',
			'/api/reference-profiles/from-roast',
			`/api/reference-profiles/${KEPT}/revisions/${KEPT_REVISION}/generated`
		]);
		expect(bodyOf(calls(fetchMock, '/from-roast')[0])).toEqual({
			roastId: 4531,
			roastRevision: 'revision-4531',
			title: 'Ethiopia Yirgacheffe Wush Wush, roasted Oct 1, 2026'
		});
		expect(keyOf(calls(fetchMock, '/from-roast')[0])).toBeTruthy();
		expect(bodyOf(calls(fetchMock, '/generated')[0])).toEqual({
			title: 'Ethiopia Yirgacheffe Wush Wush plan',
			changes: bodyOf(previews[0]).changes
		});
		expect(onSaved).toHaveBeenCalledWith({
			id: NEW_PLAN,
			revisionId: `${NEW_PLAN}-revision`,
			title: 'Ethiopia Yirgacheffe Wush Wush plan'
		});
	});

	it('keeps the saved reference when the plan fails to save, and reuses it on the next try', async () => {
		let planAttempts = 0;
		const fetchMock = stubFetch(
			roastBackend(4531),
			(url, init) => {
				if (url.endsWith('/generated') && init?.method === 'POST') {
					planAttempts += 1;
					if (planAttempts === 1) return json({ error: 'Parchment is busy' }, 503);
				}
				return undefined;
			},
			planSaved
		);
		const { onSaved } = show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await previewAndWait();
		await fireEvent.click(saveButton());

		expect(await screen.findByRole('alert')).toHaveTextContent('Parchment is busy');
		expect(
			screen.getByText(
				'This roast is now kept as a saved reference. Saving the plan again will use it.'
			)
		).toBeInTheDocument();
		expect(onSaved).not.toHaveBeenCalled();
		// The preview is still the one on screen, so the member can simply save again.
		expect(screen.getByText('Plan preview · not saved yet')).toBeInTheDocument();
		expect(saveButton()).toBeEnabled();

		await fireEvent.click(saveButton());
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());

		// The roast's file was kept once; only the plan was sent again, under the same key.
		expect(calls(fetchMock, '/from-roast')).toHaveLength(1);
		const attempts = calls(fetchMock, '/generated');
		expect(attempts).toHaveLength(2);
		expect(String(attempts[1][0])).toBe(
			`/api/reference-profiles/${KEPT}/revisions/${KEPT_REVISION}/generated`
		);
		expect(keyOf(attempts[1])).toBe(keyOf(attempts[0]));
		expect(bodyOf(attempts[1])).toEqual(bodyOf(attempts[0]));
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('does not save a plan on a reference other than the one it was previewed against', async () => {
		const fetchMock = stubFetch(
			(url, init) => {
				if (url === '/api/reference-profiles/from-roast' && init?.method === 'POST')
					return json(
						{ data: { id: KEPT, currentRevisionId: 'another-revision', title: 't' } },
						200
					);
				return undefined;
			},
			roastBackend(4531),
			planSaved
		);
		const { onSaved } = show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await previewAndWait();
		await fireEvent.click(saveButton());

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'What this plan starts from changed after the preview. Preview it again before saving.'
		);
		expect(calls(fetchMock, '/generated')).toHaveLength(0);
		expect(onSaved).not.toHaveBeenCalled();
	});

	it('places the change where the roast’s Artisan file puts charge', async () => {
		// The roast's own curve says charge is at 0:30; its Artisan file says 0:45.
		const fetchMock = stubFetch(roastBackend(4531, { roastCharge: 30_000, fileCharge: 45_000 }));
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await previewAndWait();

		const previews = calls(fetchMock, '/from-roast/preview');
		expect(previews).toHaveLength(2);
		expect(bodyOf(previews[1]).changes.temperatureAdjustments[0]).toMatchObject({
			startMilliseconds: 45_000,
			endMilliseconds: 345_000
		});
		expect(
			screen.getByText('+5°F bean temperature, 0 to 5 minutes after charge')
		).toBeInTheDocument();
	});

	it('asks for a reload when the roast changed after the page read it', async () => {
		stubFetch(
			(url) =>
				url === '/api/reference-profiles/from-roast/preview'
					? json(
							{
								error: 'The executed roast changed; reload it and use the current revision token',
								code: 'conflict'
							},
							409
						)
					: undefined,
			roastBackend(4531)
		);
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await fireEvent.click(previewButton());

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'This roast changed after this page opened. Reload the page to plan from it.'
		);
	});

	it('asks for a new preview once the change is edited, but not when only the name is', async () => {
		stubFetch(roastBackend(4531), planSaved);
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });
		await previewAndWait();

		await fireEvent.input(screen.getByLabelText('Plan name'), {
			target: { value: 'Wush Wush, hotter through drying' }
		});
		expect(saveButton()).toBeEnabled();

		await chooseOption('Raise or lower', 'lower');
		expect(saveButton()).toBeDisabled();
		expect(
			screen.getByText('You changed the plan after this preview. Preview again before saving.')
		).toBeInTheDocument();
	});
});

describe('a roast that cannot be planned from', () => {
	const sourceUnavailable =
		(reason: string): Handler =>
		(url) =>
			url === '/api/reference-profiles/from-roast/preview'
				? json(
						{
							error: 'This roast has no usable Artisan file on record',
							code: 'roast_artisan_source_unavailable',
							reason
						},
						400
					)
				: undefined;

	it('checks a roast outside the listed ones and gives Parchment’s reason as the next step', async () => {
		const fetchMock = stubFetch(sourceUnavailable('artisan_file_not_retained'), roastBackend(4400));
		show({
			candidates: [candidate(4531)],
			from: { type: 'roast', id: 4400 },
			ineligibleRoastCount: 55
		});

		const reason = await reasonShown('Roast #4400');
		expect(reason).toHaveTextContent(
			'This roast was imported before Artisan files were kept, so a plan cannot be built from it. Import its .alog again to plan from it.'
		);
		expect(within(reason).getByRole('link', { name: 'Open this roast' })).toHaveAttribute(
			'href',
			'/roast?roast=4400'
		);
		// It is a next step, not a failure, and it takes the place of the rest of the form.
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Save plan' })).toBeNull();
		// The check read the roast and asked for a preview; nothing was saved.
		expect(calls(fetchMock, '/from-roast')).toHaveLength(0);
		expect(bodyOf(calls(fetchMock, '/from-roast/preview')[0])).toMatchObject({
			roastId: 4400,
			roastRevision: 'revision-4400'
		});
		// Another start can still be chosen.
		expect(picker()).toBeInTheDocument();
	});

	it.each([
		[
			'no_artisan_import',
			'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
		],
		[
			'artisan_file_too_large',
			'This roast’s Artisan file is too large to plan from. Start from another roast or a saved reference.'
		],
		[
			'something_new',
			'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
		]
	])('words the reason %s', async (reason, copy) => {
		stubFetch(sourceUnavailable(reason), roastBackend(4400));
		show({ from: { type: 'roast', id: 4400 } });

		expect(await reasonShown(copy)).toHaveTextContent('Roast #4400');
	});

	it('plans from a roast outside the listed ones when its file is on record', async () => {
		const fetchMock = stubFetch(roastBackend(4400), planSaved);
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4400 } });

		await waitFor(() => expect(picker()).toHaveValue('Ethiopia Yirgacheffe Wush Wush'));
		expect(screen.getByText(/Roast #4400/)).toBeInTheDocument();
		// The check's own preview is not shown as the member's.
		expect(screen.queryByText('Plan preview · not saved yet')).toBeNull();
		expect(calls(fetchMock, '/from-roast/preview')).toHaveLength(1);

		await previewAndWait();
		expect(bodyOf(calls(fetchMock, '/from-roast/preview')[1])).toMatchObject({
			roastId: 4400,
			roastRevision: 'revision-4400'
		});
	});

	it('gives the reason in place of the preview when a listed roast turns out to have no file', async () => {
		stubFetch(sourceUnavailable('no_artisan_import'), roastBackend(4531));
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await fireEvent.click(previewButton());

		const reason = await screen.findByRole('status');
		expect(reason).toHaveTextContent(
			'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
		);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Plan preview · not saved yet')).toBeNull();
	});

	it('gives the reason when the file is gone by the time the plan is saved', async () => {
		const fetchMock = stubFetch((url, init) => {
			if (url === '/api/reference-profiles/from-roast' && init?.method === 'POST')
				return json(
					{ error: 'x', code: 'roast_artisan_source_unavailable', reason: 'no_artisan_import' },
					400
				);
			return undefined;
		}, roastBackend(4531));
		const { onSaved } = show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4531 } });

		await previewAndWait();
		await fireEvent.click(saveButton());

		expect(await screen.findByRole('status')).toHaveTextContent(
			'This roast has no Artisan file on record'
		);
		expect(calls(fetchMock, '/generated')).toHaveLength(0);
		expect(onSaved).not.toHaveBeenCalled();
	});

	it('says so when the roast in the link does not exist', async () => {
		stubFetch(
			(url) =>
				url === '/api/reference-profiles/from-roast/preview'
					? json({ error: 'Owned roast not found', code: 'not_found' }, 404)
					: undefined,
			roastBackend(4400)
		);
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4400 } });

		expect(await reasonShown('That roast could not be found.')).not.toHaveTextContent(
			'Roast #4400'
		);
	});

	it('offers another try when the roast could not be read at all', async () => {
		let attempts = 0;
		stubFetch((url) => {
			if (url !== '/api/roast-chart-data?roastId=4400') return undefined;
			attempts += 1;
			return attempts === 1 ? json({ error: 'Failed to process chart data' }, 500) : undefined;
		}, roastBackend(4400));
		show({ candidates: [candidate(4531)], from: { type: 'roast', id: 4400 } });

		expect(await screen.findByRole('alert')).toHaveTextContent('This roast could not be loaded.');
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(picker()).toHaveValue('Ethiopia Yirgacheffe Wush Wush'));
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('explains a saved reference that holds only a chart, and points at its roast', () => {
		stubFetch();
		show({
			profiles: [
				reference(KEEPER, 'Keeper'),
				reference(SNAPSHOT, 'Colombia snapshot', {
					sourceClass: 'executed_roast',
					sourceRoast: { id: 4525, revision: 'r' }
				})
			],
			from: { type: 'ref', id: SNAPSHOT }
		});

		const reason = screen.getByRole('status');
		expect(reason).toHaveTextContent(
			'This saved reference holds a roast’s chart and not its Artisan file, so a plan cannot be built from it.'
		);
		expect(
			within(reason).getByRole('link', { name: 'Plan from the roast it was saved from' })
		).toHaveAttribute('href', '/roast/plan?from=roast:4525');
	});
});

describe('planning from a saved reference', () => {
	it('previews and saves on the reference itself, with no roast call', async () => {
		const keeper = reference(KEEPER, 'Guji natural, September keeper');
		const fetchMock = stubFetch(referenceBackend(keeper, chart('F', 30_000)), planSaved);
		const { onSaved } = show({ profiles: [keeper], from: { type: 'ref', id: KEEPER } });

		await fireEvent.input(screen.getByLabelText('Start, minutes after charge'), {
			target: { value: '1' }
		});
		await fireEvent.input(screen.getByLabelText('End, minutes after charge'), {
			target: { value: '2' }
		});
		await chooseOption('Raise or lower', 'lower');
		await chooseOption('Temperature', 'environmental_temperature');
		await previewAndWait();

		const previewCall = calls(fetchMock, '/preview')[0];
		expect(String(previewCall[0])).toBe(
			`/api/reference-profiles/${KEEPER}/revisions/${KEEPER}-revision/preview`
		);
		expect(bodyOf(previewCall).changes.temperatureAdjustments[0]).toEqual({
			kind: 'environmental_temperature',
			startMilliseconds: 90_000,
			endMilliseconds: 150_000,
			delta: -5
		});
		expect(
			screen.getByText('−5°F environmental temperature, 1 to 2 minutes after charge')
		).toBeInTheDocument();

		await fireEvent.click(saveButton());
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
		expect(fetchMock.mock.calls.some(([url]) => String(url).includes('from-roast'))).toBe(false);
		expect(String(calls(fetchMock, '/generated')[0][0])).toBe(
			`/api/reference-profiles/${KEEPER}/revisions/${KEEPER}-revision/generated`
		);
	});

	it('saves a plan once when opening it afterwards fails', async () => {
		const keeper = reference(KEEPER, 'Guji natural, September keeper');
		const fetchMock = stubFetch(referenceBackend(keeper, chart('F', 30_000)), planSaved);
		const { onSaved } = show({
			profiles: [keeper],
			from: { type: 'ref', id: KEEPER },
			onSaved: () => Promise.reject(new Error('Navigation failed'))
		});

		await previewAndWait();
		await fireEvent.click(saveButton());
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());

		// The plan is saved: that is what the form says, with the way to it.
		const saved = await screen.findByRole('status');
		expect(saved).toHaveTextContent('Guji natural, September keeper plan is saved.');
		expect(within(saved).getByRole('link', { name: 'Open the saved plan' })).toHaveAttribute(
			'href',
			`/roast/plan?plan=${NEW_PLAN}`
		);
		expect(screen.queryByRole('alert')).toBeNull();

		// It cannot be saved a second time from the same preview.
		expect(saveButton()).toBeDisabled();
		await fireEvent.click(saveButton());
		expect(calls(fetchMock, '/generated')).toHaveLength(1);

		// A new preview is a new plan, and can be saved.
		await previewAndWait();
		expect(screen.queryByRole('status')).toBeNull();
		expect(saveButton()).toBeEnabled();
	});

	it('holds the form while a preview is in flight', async () => {
		const keeper = reference(KEEPER, 'Keeper');
		const pending = deferred();
		stubFetch(
			(url) => (url.endsWith('/preview') ? pending.promise : undefined),
			referenceBackend(keeper, chart('F'))
		);
		show({ profiles: [keeper], from: { type: 'ref', id: KEEPER } });

		await fireEvent.click(previewButton());

		await waitFor(() => expect(screen.getByLabelText('Degrees')).toBeDisabled());
		expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
		pending.resolve(json({ error: 'Too many requests' }, 429));
		expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
		expect(screen.getByLabelText('Degrees')).toBeEnabled();
	});

	it('limits a Celsius reference to 10 degrees and ignores a late curve for the start before it', async () => {
		const fahrenheit = reference(KEEPER, 'Fahrenheit reference');
		const celsius = reference(CELSIUS, 'Celsius reference');
		const lateFahrenheitChart = deferred();
		const fetchMock = stubFetch(
			(url) => (url.includes(`/${KEEPER}/`) ? lateFahrenheitChart.promise : undefined),
			referenceBackend(celsius, chart('C'))
		);
		const view = show({
			profiles: [fahrenheit, celsius],
			from: { type: 'ref', id: KEEPER }
		});

		await view.rerender({ from: { type: 'ref', id: CELSIUS } });
		await waitFor(() => expect(screen.getByLabelText('Degrees')).toHaveAttribute('max', '10'));
		lateFahrenheitChart.resolve(json({ data: { chart: chart('F') } }));
		await fireEvent.input(screen.getByLabelText('Degrees'), { target: { value: '15' } });
		await fireEvent.click(previewButton());

		expect(await screen.findByRole('alert')).toHaveTextContent('at most 10°C');
		expect(calls(fetchMock, '/preview')).toHaveLength(0);
	});
});
