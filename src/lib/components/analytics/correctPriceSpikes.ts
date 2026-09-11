/** Presentation-only repairs for the two audited retail history incidents.
 * Keep all other history intact. These estimates are not recovered observations.
 */
interface PriceRow {
	snapshot_date: string;
	origin: string;
	wholesale_only: boolean;
	synthetic?: boolean;
	price_median: number | null;
	price_avg: number | null;
	price_p25: number | null;
	price_p75: number | null;
}
const ORIGINS = new Set(['Colombia', 'Ethiopia', 'Indonesia', 'Guatemala', 'Brazil']);
const INCIDENTS = [
	{
		from: '2026-02-21',
		to: '2026-03-14',
		left: '2026-02-14',
		right: '2026-03-22',
		synthetic: true
	},
	{
		from: '2026-07-11',
		to: '2026-07-15',
		left: '2026-07-10',
		right: '2026-07-16',
		synthetic: false
	}
];
export function correctPriceSpikes<T extends PriceRow>(
	rows: T[]
): (T & { price_estimated?: boolean })[] {
	return rows.map((row) => {
		if (row.wholesale_only || !ORIGINS.has(row.origin)) return row;
		const incident = INCIDENTS.find(
			(i) =>
				row.snapshot_date >= i.from && row.snapshot_date <= i.to && row.synthetic === i.synthetic
		);
		if (!incident) return row;
		const boundary = (date: string) =>
			rows.filter((r) => r.origin === row.origin && !r.wholesale_only && r.snapshot_date === date);
		const left = boundary(incident.left),
			right = boundary(incident.right);
		if (left.length !== 1 || right.length !== 1) return row;
		const a = left[0].price_median ?? left[0].price_avg;
		const b = right[0].price_median ?? right[0].price_avg;
		if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0)
			return row;
		const fraction =
			(Date.parse(row.snapshot_date) - Date.parse(incident.left)) /
			(Date.parse(incident.right) - Date.parse(incident.left));
		return {
			...row,
			price_median: a + (b - a) * fraction,
			price_p25: null,
			price_p75: null,
			price_estimated: true
		};
	});
}
