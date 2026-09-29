/**
 * Pure Market Index read helpers: number formatting, the market-read headline,
 * origin mover ranking, and monthly gap detection. Kept framework-free so the
 * thresholds that decide what the page calls "significant" are unit-tested.
 */

/** Price moves smaller than this (in percent) read as flat. */
export const FLAT_MOVE_PCT = 0.05;
/** Net supply change must reach this share of in-scope listings to headline. */
export const SUPPLY_HEADLINE_SHARE = 0.03;
/** Origins priced by fewer suppliers than this are thin evidence. */
export const MIN_ORIGIN_SUPPLIERS = 3;
/** Smallest per-origin change (percent) that counts as an origin mover. */
export const MIN_ORIGIN_MOVE_PCT = 2;

export type MoveClassification = 'quiet' | 'normal' | 'notable' | 'exceptional' | null;

export function isFlatPct(value: number | null | undefined): boolean {
	return value != null && Math.abs(value) < FLAT_MOVE_PCT;
}

/** "+1.2%", "−0.8%", or "Flat". Null renders as "N/A". */
export function formatSignedPct(value: number | null | undefined, precision = 1): string {
	if (value == null || !Number.isFinite(value)) return 'N/A';
	if (isFlatPct(value)) return 'Flat';
	const sign = value > 0 ? '+' : '−';
	return `${sign}${Math.abs(value).toFixed(precision)}%`;
}

/** "+$0.12/lb", "−$3.49/lb", or "Flat". */
export function formatSignedMoneyPerLb(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return 'N/A';
	if (Math.abs(value) < 0.005) return 'Flat';
	const sign = value > 0 ? '+' : '−';
	return `${sign}$${Math.abs(value).toFixed(2)}/lb`;
}

export interface MarketReadInput {
	/** Movement window label, e.g. "7-day". */
	windowLabel: string;
	/** Scope label, e.g. "retail" or "combined retail + wholesale". */
	scopeLabel: string;
	/** Movement counts are fresh and loaded. */
	movementAvailable: boolean;
	arrivals: number;
	delistings: number;
	/** Active listings in scope; the denominator for supply significance. */
	stockedListings: number;
	/** Parchment's significance read for the scoped market move, when loaded. */
	priceMove: {
		latestMovePct: number | null;
		classification: MoveClassification;
		weeksSinceLargerMove: number | null;
	} | null;
}

/**
 * One-sentence market read. Price moves only headline when Parchment classifies
 * them as notable or exceptional against baseline variance; supply only
 * headlines when the net change is a meaningful share of in-scope listings.
 * Otherwise the read says plainly that nothing significant moved.
 */
export function buildMarketReadHeadline(input: MarketReadInput): string {
	const { windowLabel, scopeLabel, priceMove } = input;
	const pct = priceMove?.latestMovePct ?? null;
	const significantPrice =
		pct != null &&
		!isFlatPct(pct) &&
		(priceMove?.classification === 'notable' || priceMove?.classification === 'exceptional');

	if (significantPrice && pct != null) {
		const direction = pct > 0 ? 'rose' : 'fell';
		const weeks = priceMove?.weeksSinceLargerMove;
		const context =
			weeks != null && weeks > 1
				? `, the largest move in ${weeks} weeks`
				: priceMove?.classification === 'exceptional'
					? ', well outside normal variance'
					: ', outside normal variance';
		return `${capitalize(scopeLabel)} prices ${direction} ${formatSignedPct(pct)} over the ${windowLabel} window${context}.`;
	}

	if (!input.movementAvailable) {
		return `${capitalize(windowLabel)} movement data is unavailable, so this read makes no supply call until the index refreshes.`;
	}

	const net = input.arrivals - input.delistings;
	const share = input.stockedListings > 0 ? Math.abs(net) / input.stockedListings : 0;
	if (net !== 0 && share >= SUPPLY_HEADLINE_SHARE) {
		return net > 0
			? `${capitalize(scopeLabel)} supply grew by a net ${net} lots in the ${windowLabel} window (${formatShare(share)} of listings).`
			: `${capitalize(scopeLabel)} supply tightened by a net ${Math.abs(net)} lots in the ${windowLabel} window (${formatShare(share)} of listings).`;
	}

	const pricePhrase = priceMove ? 'prices stayed within normal variance' : null;
	const supplyPhrase = `arrivals and delistings roughly offset (${input.arrivals} in, ${input.delistings} out)`;
	return `No significant ${scopeLabel} move in the ${windowLabel} window: ${
		pricePhrase ? `${pricePhrase}, and ${supplyPhrase}` : supplyPhrase
	}.`;
}

export interface OriginPricePoint {
	origin: string;
	snapshot_date: string;
	price_median: number | null;
	price_avg: number | null;
	supplier_count: number;
	sample_size: number;
}

export interface OriginMover {
	origin: string;
	latest: number;
	delta: number;
	deltaPct: number;
	suppliers: number;
}

/** Sample-weighted median (falling back to average) per origin for one date. */
function originMedians(
	rows: OriginPricePoint[],
	date: string
): Map<string, { price: number; suppliers: number }> {
	const acc = new Map<string, { sum: number; weight: number; suppliers: number }>();
	for (const row of rows) {
		if (row.snapshot_date !== date) continue;
		const price = row.price_median ?? row.price_avg;
		if (price == null) continue;
		const weight = row.sample_size || 1;
		const cur = acc.get(row.origin) ?? { sum: 0, weight: 0, suppliers: 0 };
		cur.sum += price * weight;
		cur.weight += weight;
		cur.suppliers = Math.max(cur.suppliers, row.supplier_count ?? 0);
		acc.set(row.origin, cur);
	}
	return new Map(
		[...acc.entries()].map(([origin, v]) => [
			origin,
			{ price: v.sum / v.weight, suppliers: v.suppliers }
		])
	);
}

/**
 * Week-over-week origin movers on median prices. Thin origins (fewer than three
 * suppliers on either date) are excluded, and movers rank by percent change so a
 * $200/lb origin cannot lead on dollar size alone.
 */
export function rankOriginMovers(
	rows: OriginPricePoint[],
	latestDate: string,
	baselineDate: string
): OriginMover[] {
	const latest = originMedians(rows, latestDate);
	const baseline = originMedians(rows, baselineDate);
	const movers: OriginMover[] = [];
	for (const [origin, now] of latest) {
		const before = baseline.get(origin);
		if (!before || before.price <= 0) continue;
		if (now.suppliers < MIN_ORIGIN_SUPPLIERS || before.suppliers < MIN_ORIGIN_SUPPLIERS) continue;
		const delta = now.price - before.price;
		const deltaPct = (delta / before.price) * 100;
		if (Math.abs(deltaPct) < MIN_ORIGIN_MOVE_PCT) continue;
		movers.push({ origin, latest: now.price, delta, deltaPct, suppliers: now.suppliers });
	}
	return movers.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

/** Calendar months ("YYYY-MM") missing between the first and last period. */
export function missingMonths(periods: string[]): string[] {
	const valid = periods.filter((p) => /^\d{4}-\d{2}$/.test(p)).sort();
	if (valid.length < 2) return [];
	const present = new Set(valid);
	const missing: string[] = [];
	let [year, month] = valid[0].split('-').map(Number);
	const last = valid[valid.length - 1];
	for (;;) {
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
		const key = `${year}-${String(month).padStart(2, '0')}`;
		if (key >= last) break;
		if (!present.has(key)) missing.push(key);
	}
	return missing;
}

export function formatMonthYear(period: string): string {
	const [year, month] = period.split('-').map(Number);
	return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
		month: 'short',
		year: 'numeric'
	});
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShare(share: number): string {
	return `${(share * 100).toFixed(1)}%`;
}
