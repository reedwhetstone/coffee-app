import { UTC_DAY_MS } from './originTrend';

/** Derived presentation only; never writes or replaces published observations. */
export const RECONSTRUCTION_VERSION = 'supported-median-v1';
export const SUPPORT_RATIO = 0.6;
export interface TrendObservation {
	snapshot_date: string;
	origin: string;
	wholesale_only: boolean;
	price_median: number | null;
	sample_size: number;
	supplier_count?: number;
	synthetic?: boolean;
}
export interface ReconstructedPoint {
	date: Date;
	value: number;
	kind: 'recorded_anchor' | 'low_support_estimate' | 'missing_date_estimate';
	anchorDates: [string, string];
	intervalDays: number;
	original?: TrendObservation;
	method: typeof RECONSTRUCTION_VERSION;
}
function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function day(key: string): number {
	const value = Date.parse(key);
	return /^\d{4}-\d{2}-\d{2}$/.test(key) &&
		Number.isFinite(value) &&
		new Date(value).toISOString().slice(0, 10) === key
		? value
		: NaN;
}
/** Caller passes ONE origin/cohort and its full available history, then crops output.
 * Counts detect coverage collapse, not supplier identity or market representativeness.
 * No price-based clipping, synthetic anchors, average/median mixing, or extrapolation.
 */
export function reconstructTrend(
	input: TrendObservation[],
	ratio = SUPPORT_RATIO
): ReconstructedPoint[] {
	const identity = new Set(input.map((r) => JSON.stringify([r.origin, r.wholesale_only])));
	if (identity.size > 1) throw new Error('Reconstruct one origin and purchase cohort at a time');
	const candidates = input.filter(
		(r) =>
			r.synthetic === false &&
			Number.isFinite(day(r.snapshot_date)) &&
			r.price_median != null &&
			Number.isFinite(r.price_median) &&
			r.price_median > 0
	);
	// Conflicting duplicates are not unambiguous anchors.
	const byDay = new Map<string, TrendObservation[]>();
	for (const row of candidates)
		byDay.set(row.snapshot_date, [...(byDay.get(row.snapshot_date) ?? []), row]);
	const rows = [...byDay.values()]
		.filter((group) =>
			group.every(
				(r) =>
					r.price_median === group[0].price_median &&
					r.sample_size === group[0].sample_size &&
					r.supplier_count === group[0].supplier_count
			)
		)
		.map((group) => group[0])
		.sort((a, b) => day(a.snapshot_date) - day(b.snapshot_date));
	const anchors = rows.filter((row) => {
		if (
			!Number.isFinite(row.sample_size) ||
			row.sample_size < 2 ||
			!Number.isFinite(row.supplier_count) ||
			row.supplier_count! < 1
		)
			return false;
		const peers = rows.filter(
			(r) =>
				Math.abs(day(r.snapshot_date) - day(row.snapshot_date)) <= 28 * UTC_DAY_MS &&
				Number.isFinite(r.sample_size) &&
				r.sample_size >= 2 &&
				Number.isFinite(r.supplier_count) &&
				r.supplier_count! >= 1
		);
		if (peers.length < 5) return false;
		return (
			row.sample_size >= ratio * median(peers.map((r) => r.sample_size)) &&
			row.supplier_count! >= ratio * median(peers.map((r) => r.supplier_count!))
		);
	});
	const originals = new Map(rows.map((r) => [r.snapshot_date, r]));
	const result: ReconstructedPoint[] = [];
	for (let i = 0; i < anchors.length; i++) {
		const left = anchors[i],
			right = anchors[i + 1];
		result.push({
			date: new Date(left.snapshot_date),
			value: left.price_median!,
			kind: 'recorded_anchor',
			anchorDates: [left.snapshot_date, left.snapshot_date],
			intervalDays: 0,
			original: left,
			method: RECONSTRUCTION_VERSION
		});
		if (!right) continue;
		const span = (day(right.snapshot_date) - day(left.snapshot_date)) / UTC_DAY_MS;
		for (let d = 1; d < span; d++) {
			const date = new Date(day(left.snapshot_date) + d * UTC_DAY_MS),
				original = originals.get(date.toISOString().slice(0, 10));
			result.push({
				date,
				value: left.price_median! + ((right.price_median! - left.price_median!) * d) / span,
				kind: original ? 'low_support_estimate' : 'missing_date_estimate',
				anchorDates: [left.snapshot_date, right.snapshot_date],
				intervalDays: span,
				original,
				method: RECONSTRUCTION_VERSION
			});
		}
	}
	return result;
}
