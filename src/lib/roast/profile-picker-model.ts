import type { components } from '@purveyors/sdk';

type ReferenceProfileSummary = components['schemas']['ReferenceProfileSummary'];

/** The roast fields the picker reads; a subset of Parchment's roast list resource. */
export interface PickerRoast {
	roast_id: number;
	batch_name?: string | null;
	coffee_id?: number | null;
	coffee_name?: string | null;
	roast_date?: string | null;
	oz_out?: number | null;
	weight_loss_percent?: number | null;
	charge_time?: number | null;
	drop_time?: number | null;
	fc_start_time?: number | null;
	total_roast_time?: number | null;
	data_source?: string | null;
}

export type ProfileOptionKind = 'executed_roast' | 'reference_profile';

export interface ProfileOption {
	/** `<kind>:<id>`, unique across roasts and references. */
	value: string;
	kind: ProfileOptionKind;
	id: string;
	/** Coffee or reference name. */
	title: string;
	/** What tells this profile apart from others with the same name: date, batch, roast number. */
	detail: string;
	/** Title and detail on one line, for headings and messages. */
	label: string;
	/** Name and date in a sentence, without record numbers, for a Cherry prompt. */
	spoken: string;
}

export interface ProfileOptionGroup {
	key: 'same-coffee' | 'references' | 'roasts';
	heading: string;
	options: ProfileOption[];
	/** Options in this group before any search filter. */
	total: number;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});

const REFERENCE_SOURCE: Record<ReferenceProfileSummary['sourceClass'], string> = {
	artisan_upload: 'Artisan file',
	executed_roast: 'Saved from a roast',
	generated_revision: 'Plan'
};

/** Sortable time for a stored date; a date-only value is read as that calendar day. */
function timeOf(value: string | null | undefined): number {
	if (!value) return Number.NEGATIVE_INFINITY;
	const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
	return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** A roast date is a calendar day, so it is shown as stored and never shifted by time zone. */
export function formatDay(value: string | null | undefined): string | null {
	const day = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!day) return null;
	return DATE_FORMAT.format(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

/** A calendar day without its year: "Oct 1". */
export function formatShortDay(value: string | null | undefined): string | null {
	const day = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!day) return null;
	return SHORT_DATE_FORMAT.format(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
}

/** The part of a batch name that adds something to the coffee name it usually starts with. */
function batchDetail(batchName: string | null | undefined, title: string): string | null {
	const batch = batchName?.trim();
	if (!batch || batch.toLowerCase() === title.toLowerCase()) return null;
	if (!batch.toLowerCase().startsWith(title.toLowerCase())) return batch;
	return batch.slice(title.length).replace(/^[\s\-–—·:,]+/, '') || null;
}

/**
 * A roast is offered once something was recorded for it. A roast that was only set up,
 * with no curve, milestones, or output weight, has nothing to compare.
 */
export function hasRecordedRoast(roast: PickerRoast): boolean {
	return (
		roast.charge_time != null ||
		roast.drop_time != null ||
		roast.fc_start_time != null ||
		(roast.total_roast_time ?? 0) > 0 ||
		(roast.oz_out ?? 0) > 0 ||
		(roast.weight_loss_percent ?? 0) > 0 ||
		roast.data_source === 'artisan_import'
	);
}

export function roastOption(roast: PickerRoast): ProfileOption {
	const title = roast.coffee_name?.trim() || roast.batch_name?.trim() || `Roast #${roast.roast_id}`;
	const date = formatDay(roast.roast_date);
	const detail = [
		date ? `Roasted ${date}` : 'No roast date',
		batchDetail(roast.batch_name, title),
		`Roast #${roast.roast_id}`
	]
		.filter(Boolean)
		.join(' · ');
	return {
		value: `executed_roast:${roast.roast_id}`,
		kind: 'executed_roast',
		id: String(roast.roast_id),
		title,
		detail,
		label: `${title} · ${detail}`,
		spoken: date ? `${title}, roasted ${date}` : title
	};
}

export function referenceOption(profile: ReferenceProfileSummary): ProfileOption {
	const title = profile.title.trim() || 'Untitled reference';
	const saved = formatDay(profile.createdAt);
	const detail = [REFERENCE_SOURCE[profile.sourceClass], saved ? `Saved ${saved}` : null]
		.filter(Boolean)
		.join(' · ');
	return {
		value: `reference_profile:${profile.id}`,
		kind: 'reference_profile',
		id: profile.id,
		title,
		detail,
		label: `${title} · ${detail}`,
		spoken: `${title}, a saved ${profile.sourceClass === 'generated_revision' ? 'plan' : 'reference'}`
	};
}

/** Recorded roasts, most recent first; the roast number breaks ties within a day. */
export function recordedRoasts<Roast extends PickerRoast>(roasts: Roast[]): Roast[] {
	return roasts
		.filter(hasRecordedRoast)
		.sort(
			(left, right) =>
				timeOf(right.roast_date) - timeOf(left.roast_date) || right.roast_id - left.roast_id
		);
}

/**
 * Everything that can be compared, grouped as saved references then roasts, each most
 * recent first. Nothing is cut off: every recorded roast and every saved reference is listed.
 */
export function buildProfileOptionGroups(
	roasts: PickerRoast[],
	profiles: ReferenceProfileSummary[]
): ProfileOptionGroup[] {
	const references = [...profiles]
		.sort(
			(left, right) =>
				timeOf(right.createdAt) - timeOf(left.createdAt) || left.title.localeCompare(right.title)
		)
		.map(referenceOption);
	const roastOptions = recordedRoasts(roasts).map(roastOption);
	return [
		{
			key: 'references',
			heading: 'Saved references',
			options: references,
			total: references.length
		},
		{ key: 'roasts', heading: 'Roasts', options: roastOptions, total: roastOptions.length }
	];
}

/** Whether two roasts are of the same coffee: the same portfolio coffee, or failing that the same name. */
function isSameCoffee(roast: PickerRoast, other: PickerRoast): boolean {
	if (roast.coffee_id != null && other.coffee_id != null)
		return roast.coffee_id === other.coffee_id;
	const name = roast.coffee_name?.trim().toLowerCase();
	return Boolean(name) && name === other.coffee_name?.trim().toLowerCase();
}

/**
 * The choices for one side of a comparison when the other side is already chosen. The
 * chosen side is left out, since nothing is compared with itself. When it is a roast, that
 * coffee's other roasts are listed first, most recent first, ahead of saved references and
 * the remaining roasts.
 */
export function buildCompareOptionGroups(
	roasts: PickerRoast[],
	profiles: ReferenceProfileSummary[],
	otherValue = ''
): ProfileOptionGroup[] {
	const groups = buildProfileOptionGroups(roasts, profiles);
	if (!otherValue) return groups;

	const [references, allRoasts] = groups;
	const available = (options: ProfileOption[]) =>
		options.filter((option) => option.value !== otherValue);
	const referenceOptions = available(references.options);
	const referenceGroup = {
		...references,
		options: referenceOptions,
		total: referenceOptions.length
	};

	const recorded = recordedRoasts(roasts);
	const other = recorded.find((roast) => roastOption(roast).value === otherValue);
	const sameCoffee = other
		? recorded.filter((roast) => roast !== other && isSameCoffee(roast, other)).map(roastOption)
		: [];
	const sameCoffeeValues = new Set(sameCoffee.map((option) => option.value));
	const remaining = available(allRoasts.options).filter(
		(option) => !sameCoffeeValues.has(option.value)
	);

	if (sameCoffee.length === 0) {
		return [referenceGroup, { ...allRoasts, options: remaining, total: remaining.length }];
	}
	return [
		{ key: 'same-coffee', heading: 'Same coffee', options: sameCoffee, total: sameCoffee.length },
		referenceGroup,
		{ key: 'roasts', heading: 'Other roasts', options: remaining, total: remaining.length }
	];
}

/** Keep the options whose name, date, batch, or roast number contains every search word. */
export function filterProfileOptionGroups(
	groups: ProfileOptionGroup[],
	query: string
): ProfileOptionGroup[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return groups;
	return groups.map((group) => ({
		...group,
		options: group.options.filter((option) => {
			const text = option.label.toLowerCase();
			return words.every((word) => text.includes(word));
		})
	}));
}

export function findProfileOption(
	groups: ProfileOptionGroup[],
	value: string
): ProfileOption | null {
	for (const group of groups) {
		const option = group.options.find((candidate) => candidate.value === value);
		if (option) return option;
	}
	return null;
}
