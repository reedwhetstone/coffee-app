import { formatDuration } from './profile-comparison-model';
import { formatDay, formatShortDay } from './profile-picker-model';
import type { SummaryRoast } from './roast-summary';

/** Shown in place of a value the roaster did not record. A missing value is never a zero. */
export const NOT_RECORDED = '—';

/** One roast of a coffee as the portfolio trend table shows it. */
export interface TrendRow {
	roastId: number;
	/** "Oct 1", or "Oct 1, 2025" for a roast from an earlier year. */
	date: string;
	batch: string;
	/** "16 → 13.7 oz", or "12 oz" when the weight out was not recorded. */
	weights: string;
	loss: string;
	time: string;
	drop: string;
	development: string;
}

/** A reading that was recorded. Zero and negative values are how an empty field arrives. */
function recorded(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function formatWeight(value: number): string {
	return String(Number(value.toFixed(1)));
}

function formatClock(seconds: number): string {
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

/** Roast time in seconds: the recorded total, or the drop time when only that was marked. */
function roastSeconds(roast: SummaryRoast): number | null {
	return recorded(roast.total_roast_time) ?? recorded(roast.drop_time);
}

/** Weight loss as recorded, or worked out from the two weights when both are on record. */
function lossPercent(roast: SummaryRoast): number | null {
	const stored = recorded(roast.weight_loss_percent);
	if (stored != null) return stored;
	const weightIn = recorded(roast.oz_in);
	const weightOut = recorded(roast.oz_out);
	if (weightIn == null || weightOut == null) return null;
	return recorded(((weightIn - weightOut) / weightIn) * 100);
}

/** A roast day as lists show it: "Oct 1", or "Oct 1, 2025" for an earlier year. */
export function roastDayLabel(
	roastDate: string | null | undefined,
	currentYear = new Date().getFullYear()
): string | null {
	const year = roastDate?.match(/^(\d{4})-/)?.[1];
	return year && Number(year) !== currentYear ? formatDay(roastDate) : formatShortDay(roastDate);
}

function dayLabel(roast: SummaryRoast, currentYear: number): string | null {
	return roastDayLabel(roast.roast_date, currentYear);
}

/** Newest first: by roast date, then by roast number. Roasts with no date come last. */
export function newestFirst<T extends SummaryRoast>(roasts: readonly T[]): T[] {
	return [...roasts].sort((a, b) => {
		const dateA = a.roast_date?.slice(0, 10) ?? '';
		const dateB = b.roast_date?.slice(0, 10) ?? '';
		if (dateA !== dateB) return dateA < dateB ? 1 : -1;
		return b.roast_id - a.roast_id;
	});
}

export function trendRow(roast: SummaryRoast, currentYear = new Date().getFullYear()): TrendRow {
	const weightIn = recorded(roast.oz_in);
	const weightOut = recorded(roast.oz_out);
	const loss = lossPercent(roast);
	const seconds = roastSeconds(roast);
	const drop = recorded(roast.drop_temp);
	const development = recorded(roast.development_percent);

	let weights = NOT_RECORDED;
	if (weightIn != null && weightOut != null) {
		weights = `${formatWeight(weightIn)} → ${formatWeight(weightOut)} oz`;
	} else if (weightIn != null) {
		weights = `${formatWeight(weightIn)} oz`;
	}

	return {
		roastId: roast.roast_id,
		date: dayLabel(roast, currentYear) ?? NOT_RECORDED,
		batch: roast.batch_name?.trim() || NOT_RECORDED,
		weights,
		loss: loss != null ? `${loss.toFixed(1)}%` : NOT_RECORDED,
		time: seconds != null ? formatClock(seconds) : NOT_RECORDED,
		drop: drop != null ? `${Math.round(drop)}°${roast.temperature_unit || 'F'}` : NOT_RECORDED,
		development: development != null ? `${development.toFixed(1)}%` : NOT_RECORDED
	};
}

/**
 * "5 roasts · 64 oz roasted · 6.0 lb left · 13.8% average loss". A part with nothing on
 * record behind it is left out.
 */
export function trendSummaryLine(
	roasts: readonly SummaryRoast[],
	purchasedLbs: number | null | undefined
): string {
	const parts = [`${roasts.length} ${roasts.length === 1 ? 'roast' : 'roasts'}`];

	const roastedOz = roasts.reduce((sum, roast) => sum + (recorded(roast.oz_in) ?? 0), 0);
	if (roastedOz > 0) parts.push(`${formatWeight(roastedOz)} oz roasted`);

	const purchased = recorded(purchasedLbs);
	if (purchased != null) {
		const left = purchased - roastedOz / 16;
		if (left >= 0) parts.push(`${left.toFixed(1)} lb left`);
	}

	const losses = roasts
		.map((roast) => lossPercent(roast))
		.filter((loss): loss is number => loss != null);
	if (losses.length > 0) {
		const average = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
		parts.push(`${average.toFixed(1)}% average loss`);
	}

	return parts.join(' · ');
}

/**
 * How the newest roast differs from the one before it, in words:
 * "22 sec longer · 4°F hotter drop than Sep 27". Only readings both roasts recorded are
 * compared; with none in common there is nothing to say and the result is null.
 */
export function newestRoastDifference(
	newest: SummaryRoast,
	previous: SummaryRoast,
	currentYear = new Date().getFullYear()
): string | null {
	const parts: string[] = [];
	let differs = false;

	const newestSeconds = roastSeconds(newest);
	const previousSeconds = roastSeconds(previous);
	if (newestSeconds != null && previousSeconds != null) {
		const change = Math.round(newestSeconds) - Math.round(previousSeconds);
		if (change === 0) {
			parts.push('same time');
		} else {
			differs = true;
			parts.push(`${formatDuration(change * 1000)} ${change > 0 ? 'longer' : 'shorter'}`);
		}
	}

	const newestDrop = recorded(newest.drop_temp);
	const previousDrop = recorded(previous.drop_temp);
	const unit = newest.temperature_unit || 'F';
	if (newestDrop != null && previousDrop != null && unit === (previous.temperature_unit || 'F')) {
		const change = Math.round(newestDrop) - Math.round(previousDrop);
		if (change === 0) {
			parts.push('same drop temperature');
		} else {
			differs = true;
			parts.push(`${Math.abs(change)}°${unit} ${change > 0 ? 'hotter' : 'cooler'} drop`);
		}
	}

	if (parts.length === 0) return null;

	// Two roasts on one day cannot be told apart by date, so the earlier one is named by number.
	const sameDay =
		newest.roast_date != null &&
		newest.roast_date.slice(0, 10) === previous.roast_date?.slice(0, 10);
	const reference = sameDay
		? `roast #${previous.roast_id}`
		: (dayLabel(previous, currentYear) ?? `roast #${previous.roast_id}`);

	const text = `${parts.join(differs ? ' · ' : ' and ')} ${differs ? 'than' : 'as'} ${reference}`;
	return text.charAt(0).toUpperCase() + text.slice(1);
}
