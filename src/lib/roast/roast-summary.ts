import { formatDay } from './profile-picker-model';

/** The roast fields the roast page header reads; a subset of Parchment's roast list resource. */
export interface SummaryRoast {
	roast_id: number;
	batch_name?: string | null;
	roast_date?: string | null;
	oz_in?: number | null;
	oz_out?: number | null;
	weight_loss_percent?: number | null;
	temperature_unit?: string | null;
	charge_time?: number | null;
	charge_temp?: number | null;
	tp_time?: number | null;
	dry_end_time?: number | null;
	fc_start_time?: number | null;
	drop_time?: number | null;
	drop_temp?: number | null;
	total_roast_time?: number | null;
	development_percent?: number | null;
	data_source?: string | null;
}

export interface RoastMilestone {
	key: 'charge' | 'turning_point' | 'dry_end' | 'first_crack' | 'drop' | 'development';
	label: string;
	/** The reading, or null when the roaster did not mark this milestone. */
	value: string | null;
	/** Label and reading as one phrase: "First crack 8:18" or "First crack not marked". */
	text: string;
}

const NOT_MARKED = 'not marked';

/** Milestone times are whole seconds since charge. */
function formatClock(seconds: number): string {
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

function formatTemperature(value: number, unit: string | null | undefined): string {
	return `${Math.round(value)}°${unit || 'F'}`;
}

function formatWeight(value: number): string {
	return String(Number(value.toFixed(1)));
}

function milestone(
	key: RoastMilestone['key'],
	label: string,
	value: string | null
): RoastMilestone {
	return { key, label, value, text: `${label} ${value ?? NOT_MARKED}` };
}

/**
 * Whether anything was recorded on this roast's curve. A roast that was set up and never
 * logged or imported has no milestone line to show.
 */
export function hasRecordedCurve(roast: SummaryRoast): boolean {
	return (
		roast.charge_time != null ||
		roast.tp_time != null ||
		roast.dry_end_time != null ||
		roast.fc_start_time != null ||
		roast.drop_time != null ||
		(roast.total_roast_time ?? 0) > 0 ||
		roast.data_source === 'artisan_import'
	);
}

/**
 * The milestones of a recorded roast, in roast order. Charge, dry end, first crack, and drop
 * are marked by the roaster, so a missing one is named as not marked. Turning point and
 * development are worked out from the curve and are listed only when they exist.
 */
export function roastMilestones(roast: SummaryRoast): RoastMilestone[] {
	const unit = roast.temperature_unit;
	const milestones: RoastMilestone[] = [];

	if (roast.charge_time == null) {
		milestones.push(milestone('charge', 'Charge', null));
	} else if (roast.charge_temp != null) {
		milestones.push(milestone('charge', 'Charge', formatTemperature(roast.charge_temp, unit)));
	}

	if (roast.tp_time != null) {
		milestones.push(milestone('turning_point', 'Turning point', formatClock(roast.tp_time)));
	}

	milestones.push(
		milestone(
			'dry_end',
			'Dry end',
			roast.dry_end_time != null ? formatClock(roast.dry_end_time) : null
		)
	);

	milestones.push(
		milestone(
			'first_crack',
			'First crack',
			roast.fc_start_time != null ? formatClock(roast.fc_start_time) : null
		)
	);

	if (roast.drop_time == null) {
		milestones.push(milestone('drop', 'Drop', null));
	} else {
		const dropTime = formatClock(roast.drop_time);
		milestones.push(
			milestone(
				'drop',
				'Drop',
				roast.drop_temp != null
					? `${dropTime} at ${formatTemperature(roast.drop_temp, unit)}`
					: dropTime
			)
		);
	}

	const development = roast.development_percent;
	if (development != null && development > 0) {
		milestones.push(milestone('development', 'Development', `${development.toFixed(1)}%`));
	}

	return milestones;
}

/** "Roast #4531 · Oct 1, 2026 · Wednesday roast · 16 → 13.7 oz (14.4% loss)" */
export function roastDetailLine(roast: SummaryRoast): string {
	const parts = [`Roast #${roast.roast_id}`];

	const date = formatDay(roast.roast_date);
	if (date) parts.push(date);

	const batch = roast.batch_name?.trim();
	if (batch) parts.push(batch);

	const weightIn = roast.oz_in != null && roast.oz_in > 0 ? roast.oz_in : null;
	const weightOut = roast.oz_out != null && roast.oz_out > 0 ? roast.oz_out : null;
	if (weightIn != null && weightOut != null) {
		const loss = roast.weight_loss_percent ?? ((weightIn - weightOut) / weightIn) * 100;
		parts.push(
			`${formatWeight(weightIn)} → ${formatWeight(weightOut)} oz (${loss.toFixed(1)}% loss)`
		);
	} else if (weightIn != null) {
		parts.push(`${formatWeight(weightIn)} oz`);
	}

	return parts.join(' · ');
}

/** "14 roasts in 10 batches · 15.0% average loss" */
export function roastCountLine(summary: {
	roasts: number;
	batches: number;
	/** Null when no roast in the set has a weight loss on record. */
	averageLoss: number | null;
}): string {
	const roasts = `${summary.roasts} ${summary.roasts === 1 ? 'roast' : 'roasts'}`;
	const batches = `${summary.batches} ${summary.batches === 1 ? 'batch' : 'batches'}`;
	const counts = `${roasts} in ${batches}`;
	return summary.averageLoss == null
		? counts
		: `${counts} · ${summary.averageLoss.toFixed(1)}% average loss`;
}
