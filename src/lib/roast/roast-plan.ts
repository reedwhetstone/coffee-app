import type { components } from '@purveyors/sdk';
import { parseCompareSide, formatCompareSide, type CompareSide } from './compare-sides';
import {
	referenceOption,
	roastOption,
	type ProfileOption,
	type ProfileOptionGroup
} from './profile-picker-model';

export type RoastCandidates =
	components['schemas']['ReferenceProfileRoastCandidatesResponse']['data'];
export type RoastCandidate = RoastCandidates['roasts'][number];
export type SavedReference = components['schemas']['ReferenceProfileListResponse']['data'][number];
export type ReferenceChart = components['schemas']['ReferenceProfileChart'];
export type RoastChartData = components['schemas']['RoastChartDataResponse']['data'];
export type TemperatureAdjustment =
	components['schemas']['ReferenceProfileGenerationRequest']['changes']['temperatureAdjustments'][number];
/** Why Parchment could not build a plan on a roast. */
export type RoastSourceReason = NonNullable<
	components['schemas']['RoastSourceErrorResponse']['error']['reason']
>;

/** What a `/roast/plan` link asks for: a new plan from a roast or saved reference, or a saved plan. */
export interface PlanLink {
	from: CompareSide | null;
	plan: string | null;
}

/** Read `?from=<side>` and `?plan=<uuid>`. A saved plan wins when a link carries both. */
export function readPlanLink(searchParams: URLSearchParams): PlanLink {
	const plan = parseCompareSide(`ref:${searchParams.get('plan')?.trim() ?? ''}`);
	if (plan?.type === 'ref') return { from: null, plan: plan.id };
	return { from: parseCompareSide(searchParams.get('from')), plan: null };
}

/** The link to the plan page: `/roast/plan?from=roast:4531`, or `?plan=<uuid>` for a saved plan. */
export function planHref(target: Partial<PlanLink> = {}): string {
	if (target.plan) return `/roast/plan?plan=${target.plan}`;
	if (target.from) return `/roast/plan?from=${formatCompareSide(target.from)}`;
	return '/roast/plan';
}

/** A roast or saved reference a plan can start from. */
export type PlanStart =
	| {
			kind: 'reference';
			side: CompareSide;
			option: ProfileOption;
			profileId: string;
			revisionId: string;
	  }
	| {
			kind: 'roast';
			side: CompareSide;
			option: ProfileOption;
			roastId: number;
			/** The roast's revision token when it was read; Parchment refuses a plan on a changed roast. */
			roastRevision: string;
	  };

/** A saved reference still has its Artisan file when it was uploaded or is itself a plan. */
export function canPlanFromReference(profile: SavedReference): boolean {
	return profile.sourceClass === 'artisan_upload' || profile.sourceClass === 'generated_revision';
}

type RoastSummary = Pick<
	RoastCandidate,
	'roastId' | 'roastRevision' | 'batchName' | 'coffeeName' | 'roastDate'
>;

function roastStart(roast: RoastSummary): PlanStart {
	return {
		kind: 'roast',
		side: { type: 'roast', id: roast.roastId },
		option: roastOption({
			roast_id: roast.roastId,
			batch_name: roast.batchName,
			coffee_name: roast.coffeeName,
			roast_date: roast.roastDate
		}),
		roastId: roast.roastId,
		roastRevision: roast.roastRevision
	};
}

function referenceStart(profile: SavedReference): PlanStart {
	return {
		kind: 'reference',
		side: { type: 'ref', id: profile.id },
		option: referenceOption(profile),
		profileId: profile.id,
		revisionId: profile.currentRevisionId
	};
}

/**
 * Everything a plan can start from. Roasts are listed as Parchment returns them, newest
 * first. The reference a listed roast's Artisan file is kept under is left out, so the same
 * curve is not offered twice.
 */
export function planStarts(candidates: RoastCandidate[], profiles: SavedReference[]): PlanStart[] {
	const keptFromRoast = new Set(candidates.map((candidate) => candidate.reference.profileId));
	const references = profiles
		.filter((profile) => canPlanFromReference(profile) && !keptFromRoast.has(profile.id))
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
		.map(referenceStart);
	return [...references, ...candidates.map(roastStart)];
}

/** Which of the two lists a plan starts from could not be read. An unread list is not an empty one. */
export interface PlanListFailures {
	references?: boolean;
	roasts?: boolean;
}

/** The plan page's "Start from" choices, in the comparison picker's order. */
export function buildPlanStartGroups(
	starts: PlanStart[],
	failed: PlanListFailures = {}
): ProfileOptionGroup[] {
	const references = starts.filter((start) => start.kind === 'reference').map((s) => s.option);
	const roasts = starts.filter((start) => start.kind === 'roast').map((s) => s.option);
	return [
		{
			key: 'references',
			heading: 'Saved references and plans',
			options: references,
			total: references.length,
			empty: failed.references
				? 'Saved references and plans could not be loaded.'
				: 'No saved references or plans yet.'
		},
		{
			key: 'roasts',
			heading: 'Roasts',
			options: roasts,
			total: roasts.length,
			empty: failed.roasts
				? 'Roasts could not be loaded.'
				: 'No roasts with an Artisan file on record yet.'
		}
	];
}

/** Where a `?from=` link stands against what the account can plan from. */
export type PlanStartResolution =
	| { status: 'none' }
	| { status: 'ready'; start: PlanStart }
	/** A roast outside the listed candidates; Parchment has to be asked about it. */
	| { status: 'unlisted'; roastId: number }
	/** A saved reference that holds a roast's chart and no Artisan file. */
	| { status: 'snapshot'; sourceRoastId: number | null }
	| { status: 'missing' }
	/** A saved reference that cannot be looked for, because the saved references were not read. */
	| { status: 'unknown' };

export function resolvePlanStart(
	from: CompareSide | null,
	starts: PlanStart[],
	candidates: RoastCandidate[],
	profiles: SavedReference[],
	failed: PlanListFailures = {}
): PlanStartResolution {
	if (!from) return { status: 'none' };
	const listed = starts.find((start) => start.side.type === from.type && start.side.id === from.id);
	if (listed) return { status: 'ready', start: listed };
	if (from.type === 'roast') return { status: 'unlisted', roastId: from.id };

	// A reference kept from a listed roast's file is planned from as that roast.
	const candidate = candidates.find((entry) => entry.reference.profileId === from.id);
	if (candidate) return { status: 'ready', start: roastStart(candidate) };
	const profile = profiles.find((entry) => entry.id === from.id);
	if (!profile) return { status: failed.references ? 'unknown' : 'missing' };
	if (canPlanFromReference(profile)) return { status: 'ready', start: referenceStart(profile) };
	return { status: 'snapshot', sourceRoastId: profile.sourceRoast?.id ?? null };
}

/** The account's saved plans, newest first. */
export function savedPlans(profiles: SavedReference[]): SavedReference[] {
	return profiles
		.filter((profile) => profile.sourceClass === 'generated_revision')
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

/** Where a saved plan's file for Artisan is downloaded from. */
export function planDownloadHref(plan: Pick<SavedReference, 'id' | 'currentRevisionId'>): string {
	return `/api/reference-profiles/${encodeURIComponent(plan.id)}/revisions/${encodeURIComponent(plan.currentRevisionId)}/export`;
}

/** A roast Parchment accepted that the candidate list did not carry. */
export function unlistedRoastStart(roast: RoastSummary): PlanStart {
	return roastStart(roast);
}

/** Tells one start from another, and the same roast or reference at a later revision. */
export function planStartKey(start: PlanStart): string {
	return `${formatCompareSide(start.side)}@${
		start.kind === 'roast' ? start.roastRevision : start.revisionId
	}`;
}

/** How many of the account's roasts cannot be planned from, and what to do about one. */
export function unusableRoastsLine(count: number): string | null {
	if (!Number.isFinite(count) || count <= 0) return null;
	return count === 1
		? '1 roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.'
		: `${count} roasts have no Artisan file on record, so a plan cannot be built from them. Import a roast's .alog to plan from it.`;
}

/**
 * Parchment lists the newest roasts that can be planned from, up to a limit. When more can be,
 * say so, and say how an older one is reached.
 */
export function olderRoastsLine(listed: number, eligible: number): string | null {
	if (!Number.isFinite(eligible) || listed <= 0 || eligible <= listed) return null;
	return `The ${listed} newest roasts are listed. To plan from an older one, open that roast and choose “Plan next roast from this”.`;
}

/** Parchment's reason a roast cannot be planned from, as the next thing to do. */
export function roastSourceReasonCopy(reason: RoastSourceReason | null | undefined): string {
	switch (reason) {
		case 'artisan_file_not_retained':
			return 'This roast was imported before Artisan files were kept, so a plan cannot be built from it. Import its .alog again to plan from it.';
		case 'artisan_file_too_large':
			return 'This roast’s Artisan file is too large to plan from. Start from another roast or a saved reference.';
		default:
			return 'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.';
	}
}

export function isRoastSourceReason(value: unknown): value is RoastSourceReason {
	return (
		value === 'no_artisan_import' ||
		value === 'artisan_file_not_retained' ||
		value === 'artisan_file_too_large'
	);
}

/**
 * A roast's recorded curve in the shape a saved reference's chart has, on the same clock.
 * It is what a plan from that roast is drawn over until the roast's file is kept as a reference.
 */
export function referenceChartFromRoast(data: RoastChartData): ReferenceChart {
	return {
		temperatureUnit: data.metadata.temperature_unit === 'C' ? 'C' : 'F',
		chargeTimeMilliseconds: data.metadata.charge_time_ms,
		series: data.series.flatMap((series) =>
			series.kind === 'bean_temperature' ||
			series.kind === 'environmental_temperature' ||
			series.kind === 'auxiliary'
				? [
						{
							id: series.id,
							name: series.name,
							kind: series.kind,
							unit: series.unit,
							deviceIndex: series.device_index,
							channel: series.channel,
							points: series.points.map((point) => ({
								timeMilliseconds: point.time_milliseconds,
								value: point.value_numeric
							}))
						}
					]
				: []
		),
		events: data.events.flatMap((event) =>
			event.category === 'milestone' || event.category === 'control'
				? [
						{
							timeMilliseconds: event.time_milliseconds,
							name: event.name.trim().toLowerCase(),
							value: event.value,
							category: event.category
						}
					]
				: []
		)
	};
}

function minutes(milliseconds: number): string {
	return String(Number((milliseconds / 60_000).toFixed(2)));
}

/** A change in words: "+5°F bean temperature, 0 to 5 minutes after charge". */
export function describeAdjustment(
	adjustment: TemperatureAdjustment,
	temperatureUnit: 'F' | 'C',
	chargeOffsetMilliseconds: number
): string {
	const channel =
		adjustment.kind === 'bean_temperature' ? 'bean temperature' : 'environmental temperature';
	const sign = adjustment.delta > 0 ? '+' : '−';
	return `${sign}${Math.abs(adjustment.delta)}°${temperatureUnit} ${channel}, ${minutes(
		adjustment.startMilliseconds - chargeOffsetMilliseconds
	)} to ${minutes(adjustment.endMilliseconds - chargeOffsetMilliseconds)} minutes after charge`;
}
