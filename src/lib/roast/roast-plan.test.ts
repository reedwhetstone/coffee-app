import { describe, expect, it } from 'vitest';
import {
	buildPlanStartGroups,
	canPlanFromReference,
	describeAdjustment,
	olderRoastsLine,
	planDownloadHref,
	planHref,
	planNextRoastLink,
	planStartKey,
	planStarts,
	readPlanLink,
	referenceChartFromRoast,
	resolvePlanStart,
	roastSourceReasonCopy,
	unusableRoastsLine,
	type RoastCandidate,
	type RoastChartData,
	type SavedReference
} from './roast-plan';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000002';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';
const KEPT_FROM_ROAST = 'bbbbbbbb-0000-4000-8000-000000004531';

const link = (query: string) => readPlanLink(new URLSearchParams(query));

function reference(overrides: Partial<SavedReference>): SavedReference {
	return {
		id: KEEPER,
		title: 'Guji natural, September keeper',
		notes: null,
		sourceClass: 'artisan_upload',
		status: 'active',
		// Only an uploaded Artisan file is kept as it was sent.
		artisanFileAvailable: (overrides.sourceClass ?? 'artisan_upload') === 'artisan_upload',
		currentRevisionId: `${overrides.id ?? KEEPER}-revision`,
		createdAt: '2026-09-28T00:00:00Z',
		updatedAt: '2026-09-28T00:00:00Z',
		sourceRoast: null,
		...overrides
	};
}

function candidate(overrides: Partial<RoastCandidate>): RoastCandidate {
	const roastId = overrides.roastId ?? 4531;
	return {
		roastId,
		roastRevision: `revision-${roastId}`,
		label: `Roast ${roastId}`,
		batchName: 'Wednesday roast',
		coffeeName: 'Ethiopia Yirgacheffe Wush Wush',
		roastDate: '2026-10-01',
		reference: {
			profileId: `cccccccc-0000-4000-8000-00000000${roastId}`,
			revisionId: `dddddddd-0000-4000-8000-00000000${roastId}`,
			saved: false
		},
		...overrides
	};
}

describe('plan links', () => {
	it('reads a roast or a saved reference to start from', () => {
		expect(link('from=roast:4531')).toEqual({ from: { type: 'roast', id: 4531 }, plan: null });
		expect(link(`from=ref:${KEEPER}`)).toEqual({ from: { type: 'ref', id: KEEPER }, plan: null });
		expect(link(`from=ref:${KEEPER.toUpperCase()}`).from).toEqual({ type: 'ref', id: KEEPER });
	});

	it('reads a saved plan to reopen', () => {
		expect(link(`plan=${PLAN}`)).toEqual({ from: null, plan: PLAN });
		expect(link(`plan=${PLAN.toUpperCase()}`).plan).toBe(PLAN);
	});

	it('opens the saved plan when a link carries both', () => {
		expect(link(`from=roast:4531&plan=${PLAN}`)).toEqual({ from: null, plan: PLAN });
	});

	it.each([
		'',
		'from=',
		'from=4531',
		'from=roast:',
		'from=roast:0',
		'from=roast:-4',
		'from=roast:45.5',
		'from=roast:4531abc',
		'from=batch:4531',
		'from=ref:not-a-uuid',
		'plan=4531',
		'plan=roast:4531',
		`plan=ref:${PLAN}`,
		'plan='
	])('reads nothing from "%s"', (query) => {
		expect(link(query)).toEqual({ from: null, plan: null });
	});

	it('falls back to what to start from when the plan cannot be read', () => {
		expect(link('plan=nope&from=roast:4531')).toEqual({
			from: { type: 'roast', id: 4531 },
			plan: null
		});
	});

	it('writes the links the page reads', () => {
		expect(planHref()).toBe('/roast/plan');
		expect(planHref({ from: { type: 'roast', id: 4531 } })).toBe('/roast/plan?from=roast:4531');
		expect(planHref({ from: { type: 'ref', id: KEEPER } })).toBe(`/roast/plan?from=ref:${KEEPER}`);
		expect(planHref({ plan: PLAN })).toBe(`/roast/plan?plan=${PLAN}`);
		for (const href of [
			planHref({ from: { type: 'roast', id: 4531 } }),
			planHref({ from: { type: 'ref', id: KEEPER } }),
			planHref({ plan: PLAN })
		]) {
			const read = readPlanLink(new URL(href, 'http://localhost').searchParams);
			expect(planHref(read)).toBe(href);
		}
	});
});

describe('what a plan can start from', () => {
	const newest = candidate({ roastId: 4531 });
	const older = candidate({ roastId: 4507, roastDate: '2026-09-17' });
	const keeper = reference({});
	const plan = reference({
		id: PLAN,
		title: 'Guji plan: +5°F through drying',
		sourceClass: 'generated_revision',
		createdAt: '2026-10-02T00:00:00Z'
	});
	const snapshot = reference({
		id: SNAPSHOT,
		title: 'Colombia Sierra Nevada, Sept 24',
		sourceClass: 'executed_roast',
		sourceRoast: { id: 4525, revision: 'r' }
	});

	it('lists roasts as Parchment orders them, beside uploaded references and saved plans', () => {
		const starts = planStarts([newest, older], [keeper, snapshot, plan]);
		const [references, roasts] = buildPlanStartGroups(starts);

		expect(references.heading).toBe('Saved references and plans');
		// Newest saved first. A reference that holds only a roast's chart cannot be planned from.
		expect(references.options.map((option) => option.title)).toEqual([
			'Guji plan: +5°F through drying',
			'Guji natural, September keeper'
		]);
		expect(references.total).toBe(2);
		expect(roasts.heading).toBe('Roasts');
		expect(roasts.options.map((option) => option.value)).toEqual([
			'executed_roast:4531',
			'executed_roast:4507'
		]);
		expect(roasts.options[0]).toMatchObject({
			title: 'Ethiopia Yirgacheffe Wush Wush',
			detail: 'Roasted Oct 1, 2026 · Wednesday roast · Roast #4531'
		});
	});

	it('offers a roast once when its Artisan file is already kept as a reference', () => {
		// The list of roasts may have been read before the file was kept, so it can still
		// say the reference is not saved.
		const kept = candidate({
			roastId: 4531,
			reference: { profileId: KEPT_FROM_ROAST, revisionId: 'kept-revision', saved: false }
		});
		const keptReference = reference({
			id: KEPT_FROM_ROAST,
			title: 'Wednesday roast',
			sourceRoast: { id: 4531, revision: 'revision-4531' }
		});
		const starts = planStarts([kept], [keptReference, keeper]);
		const [references, roasts] = buildPlanStartGroups(starts);

		expect(references.options.map((option) => option.title)).toEqual([
			'Guji natural, September keeper'
		]);
		expect(roasts.options).toHaveLength(1);
		// A link to that reference plans from the roast it holds.
		const resolved = resolvePlanStart(
			{ type: 'ref', id: KEPT_FROM_ROAST },
			starts,
			[kept],
			[keptReference, keeper]
		);
		expect(resolved).toMatchObject({ status: 'ready', start: { kind: 'roast', roastId: 4531 } });
	});

	it('says what an empty group means on this page', () => {
		const [references, roasts] = buildPlanStartGroups([]);
		expect(references.empty).toBe('No saved references or plans yet.');
		expect(roasts.empty).toBe('No roasts with an Artisan file on record yet.');
	});

	it('does not call a list that could not be read empty', () => {
		const [references, roasts] = buildPlanStartGroups([], { references: true, roasts: true });
		expect(references.empty).toBe('Saved references and plans could not be loaded.');
		expect(roasts.empty).toBe('Roasts could not be loaded.');

		// Only the list that failed says so.
		const [read, unread] = buildPlanStartGroups([], { roasts: true });
		expect(read.empty).toBe('No saved references or plans yet.');
		expect(unread.empty).toBe('Roasts could not be loaded.');
	});

	it('does not call a saved reference missing when the saved references could not be read', () => {
		const from = { type: 'ref', id: KEEPER } as const;
		expect(resolvePlanStart(from, [], [], [], { references: true })).toEqual({
			status: 'unknown'
		});
		// The roasts failing says nothing about a saved reference.
		expect(resolvePlanStart(from, [], [], [], { roasts: true })).toEqual({ status: 'missing' });
		// A reference kept from a listed roast is still found through that roast.
		const kept = candidate({
			reference: { profileId: KEPT_FROM_ROAST, revisionId: 'kept-revision', saved: true }
		});
		expect(
			resolvePlanStart({ type: 'ref', id: KEPT_FROM_ROAST }, planStarts([kept], []), [kept], [], {
				references: true
			})
		).toMatchObject({ status: 'ready', start: { kind: 'roast', roastId: 4531 } });
	});

	it('resolves what a link names', () => {
		const candidates = [newest];
		const profiles = [keeper, snapshot, plan];
		const starts = planStarts(candidates, profiles);
		const resolve = (from: Parameters<typeof resolvePlanStart>[0]) =>
			resolvePlanStart(from, starts, candidates, profiles);

		expect(resolve(null)).toEqual({ status: 'none' });
		expect(resolve({ type: 'roast', id: 4531 })).toMatchObject({
			status: 'ready',
			start: { kind: 'roast', roastId: 4531, roastRevision: 'revision-4531' }
		});
		expect(resolve({ type: 'ref', id: PLAN })).toMatchObject({
			status: 'ready',
			start: { kind: 'reference', profileId: PLAN, revisionId: `${PLAN}-revision` }
		});
		// A roast outside the listed ones is not assumed unusable; Parchment is asked.
		expect(resolve({ type: 'roast', id: 4400 })).toEqual({ status: 'unlisted', roastId: 4400 });
		expect(resolve({ type: 'ref', id: SNAPSHOT })).toEqual({
			status: 'snapshot',
			sourceRoastId: 4525
		});
		expect(resolve({ type: 'ref', id: 'aaaaaaaa-0000-4000-8000-00000000ffff' })).toEqual({
			status: 'missing'
		});
	});

	it('tells a roast from the same roast after it changed', () => {
		const [before] = planStarts([newest], []);
		const [after] = planStarts([{ ...newest, roastRevision: 'later' }], []);
		expect(planStartKey(before)).toBe('roast:4531@revision-4531');
		expect(planStartKey(after)).not.toBe(planStartKey(before));
	});
});

describe('"Plan next roast" on one roast in a list', () => {
	it('links to the plan page for a roast whose Artisan file is on record', () => {
		expect(planNextRoastLink({ roast_id: 4531, artisan_file_available: true })).toEqual([
			{ label: 'Plan next roast', href: '/roast/plan?from=roast:4531' }
		]);
	});

	it.each([false, null, undefined])(
		'offers nothing for a roast a plan cannot be built on (file on record: %s)',
		(artisan_file_available) => {
			expect(planNextRoastLink({ roast_id: 4531, artisan_file_available })).toEqual([]);
		}
	);
});

describe('planning from a saved reference', () => {
	it('needs a file Artisan can read: an upload, a roast kept with its file, or a plan', () => {
		expect(canPlanFromReference(reference({}))).toBe(true);
		expect(canPlanFromReference(reference({ id: PLAN, sourceClass: 'generated_revision' }))).toBe(
			true
		);
		expect(
			canPlanFromReference(
				reference({ id: SNAPSHOT, sourceClass: 'executed_roast', artisanFileAvailable: true })
			)
		).toBe(true);
		expect(canPlanFromReference(reference({ id: SNAPSHOT, sourceClass: 'executed_roast' }))).toBe(
			false
		);
	});
});

describe('a saved plan', () => {
	it('downloads from its own revision', () => {
		const older = reference({
			id: PLAN,
			title: 'Guji plan',
			sourceClass: 'generated_revision',
			createdAt: '2026-09-30T00:00:00Z'
		});

		expect(planDownloadHref(older)).toBe(
			`/api/reference-profiles/${PLAN}/revisions/${PLAN}-revision/export`
		);
	});
});

describe('roasts that are not listed', () => {
	it('says the list holds the newest roasts only when more can be planned from', () => {
		expect(olderRoastsLine(50, 50)).toBeNull();
		expect(olderRoastsLine(3, 3)).toBeNull();
		expect(olderRoastsLine(0, 0)).toBeNull();
		// A list that could not be read has nothing in it to call the newest.
		expect(olderRoastsLine(0, 62)).toBeNull();
		expect(olderRoastsLine(50, 62)).toBe(
			'The 50 newest roasts are listed. To plan from an older one, open that roast and choose “Plan next roast from this”.'
		);
	});
});

describe('roasts that cannot be used', () => {
	it('counts them and says what to do', () => {
		expect(unusableRoastsLine(0)).toBeNull();
		expect(unusableRoastsLine(-1)).toBeNull();
		expect(unusableRoastsLine(1)).toBe(
			'1 roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
		);
		expect(unusableRoastsLine(55)).toBe(
			"55 roasts have no Artisan file on record, so a plan cannot be built from them. Import a roast's .alog to plan from it."
		);
	});

	it('turns each of Parchment’s reasons into the next step', () => {
		const noFile =
			'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.';
		expect(roastSourceReasonCopy('no_artisan_import')).toBe(noFile);
		expect(roastSourceReasonCopy(null)).toBe(noFile);
		expect(roastSourceReasonCopy('artisan_file_not_retained')).toBe(
			'This roast was imported before Artisan files were kept, so a plan cannot be built from it. Import its .alog again to plan from it.'
		);
		expect(roastSourceReasonCopy('artisan_file_too_large')).toBe(
			'This roast’s Artisan file is too large to plan from. Start from another roast or a saved reference.'
		);
	});
});

describe('a roast’s curve as what a plan starts from', () => {
	const data: RoastChartData = {
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
					{ time_milliseconds: 30_000, value_numeric: 392 },
					{ time_milliseconds: 90_000, value_numeric: 210 }
				]
			},
			{
				id: 'ror',
				name: 'RoR',
				kind: 'rate_of_rise',
				unit: 'F/min',
				device_index: null,
				channel: null,
				total_points: 1,
				sampled_points: 1,
				points: [{ time_milliseconds: 90_000, value_numeric: 12 }]
			}
		],
		events: [
			{
				time_milliseconds: 30_000,
				name: ' Charge ',
				value: null,
				category: 'milestone',
				subcategory: 'roast'
			},
			{
				time_milliseconds: 60_000,
				name: 'note',
				value: 'x',
				category: 'annotation',
				subcategory: ''
			}
		],
		metadata: {
			revision: '2026-10-01T12:00:00Z',
			total_data_points: 2,
			sampled_data_points: 2,
			roast_duration_minutes: 10,
			time_min_ms: 0,
			time_max_ms: 600_000,
			temp_min: 200,
			temp_max: 400,
			ror_min: 0,
			ror_max: 30,
			charge_time_ms: 30_000,
			temperature_unit: 'F',
			profile_schema_version: 2,
			target_points: 400,
			sample_gap_max_ms: 60_000
		}
	};

	it('keeps the recording clock and where charge sits on it', () => {
		const chart = referenceChartFromRoast(data);

		expect(chart.temperatureUnit).toBe('F');
		expect(chart.chargeTimeMilliseconds).toBe(30_000);
		// Rate of rise is worked out from the curve; a saved reference does not carry it.
		expect(chart.series.map((series) => series.id)).toEqual(['bt']);
		expect(chart.series[0].points).toEqual([
			{ timeMilliseconds: 30_000, value: 392 },
			{ timeMilliseconds: 90_000, value: 210 }
		]);
		expect(chart.events).toEqual([
			{ timeMilliseconds: 30_000, name: 'charge', value: null, category: 'milestone' }
		]);
	});

	it('reads Celsius and a roast with no charge marked', () => {
		const chart = referenceChartFromRoast({
			...data,
			metadata: { ...data.metadata, temperature_unit: 'C', charge_time_ms: null }
		});
		expect(chart.temperatureUnit).toBe('C');
		expect(chart.chargeTimeMilliseconds).toBeNull();
	});
});

describe('a change in words', () => {
	it('counts its minutes from charge', () => {
		expect(
			describeAdjustment(
				{ kind: 'bean_temperature', startMilliseconds: 30_000, endMilliseconds: 330_000, delta: 5 },
				'F',
				30_000
			)
		).toBe('+5°F bean temperature, 0 to 5 minutes after charge');
		expect(
			describeAdjustment(
				{
					kind: 'environmental_temperature',
					startMilliseconds: 90_000,
					endMilliseconds: 150_000,
					delta: -2.5
				},
				'C',
				0
			)
		).toBe('−2.5°C environmental temperature, 1.5 to 2.5 minutes after charge');
	});
});
