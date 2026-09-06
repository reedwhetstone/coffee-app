import { UTC_DAY_MS } from './originTrend';

/** Derived presentation only; never writes or replaces published observations. */
export const RECONSTRUCTION_VERSION = 'supported-median-legacy-bridge-v2';
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
	kind:
		| 'recorded_anchor'
		| 'low_support_estimate'
		| 'missing_date_estimate'
		| 'historical_estimate';
	/** Historical endpoint is a modeled level, never a recorded anchor. */
	legacyBaseline?: { value: number; dates: string[] };
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
 * Recorded prices are never clipped or rescaled. Explicit legacy estimates may
 * supply an earlier modeled level, not an observed price or observed movement.
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
	const first = result[0];
	if (!first) return result;
	// Legacy cohorts were priced retrospectively: their week-to-week changes do
	// not measure market movement. Use only a robust opening level and a simple
	// bridge to the first recorded anchor, not the misleading legacy trajectory.
	const legacyByDay = new Map<string, TrendObservation[]>();
	for (const row of input) {
		if (
			row.synthetic !== true ||
			!Number.isFinite(day(row.snapshot_date)) ||
			day(row.snapshot_date) >= +first.date ||
			row.price_median == null ||
			!Number.isFinite(row.price_median) ||
			row.price_median <= 0 ||
			!Number.isFinite(row.sample_size) ||
			row.sample_size < 2 ||
			!Number.isFinite(row.supplier_count) ||
			row.supplier_count! < 1
		)
			continue;
		legacyByDay.set(row.snapshot_date, [...(legacyByDay.get(row.snapshot_date) ?? []), row]);
	}
	const legacy = [...legacyByDay.values()]
		.filter((group) => group.every((row) => row.price_median === group[0].price_median))
		.map((group) => group[0])
		.sort((a, b) => day(a.snapshot_date) - day(b.snapshot_date));
	if (!legacy.length) return result;
	const opening = legacy.filter(
		(row) => day(row.snapshot_date) <= day(legacy[0].snapshot_date) + 35 * UTC_DAY_MS
	);
	// A handful of weekly estimates, not a single retrospective quote.
	if (opening.length < 5) return result;
	const baseline = median(opening.map((row) => row.price_median!));
	const start = day(legacy[0].snapshot_date);
	const span = (+first.date - start) / UTC_DAY_MS;
	const history: ReconstructedPoint[] = [];
	for (let d = 0; d < span; d++) {
		history.push({
			date: new Date(start + d * UTC_DAY_MS),
			value: baseline + ((first.value - baseline) * d) / span,
			kind: 'historical_estimate',
			anchorDates: [legacy[0].snapshot_date, first.date.toISOString().slice(0, 10)],
			intervalDays: span,
			legacyBaseline: { value: baseline, dates: opening.map((row) => row.snapshot_date) },
			method: RECONSTRUCTION_VERSION
		});
	}
	return [...history, ...result];
}
