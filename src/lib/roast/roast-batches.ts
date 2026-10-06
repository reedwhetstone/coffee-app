import { roastDayLabel } from './coffee-trend';
import { formatDay } from './profile-picker-model';

const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_ID = /^[1-9]\d*$/;

/** The roast fields a batch is worked out from; a subset of Parchment's roast list resource. */
export interface BatchedRoast {
	roast_id: number;
	batch_id?: string | null;
	batch_name?: string | null;
	roast_date?: string | null;
	coffee_id?: number | null;
	coffee_name?: string | null;
}

/** One roast batch as the roast list and the sale form show it. */
export interface RoastBatchGroup<T extends BatchedRoast = BatchedRoast> {
	/** What the list keys the batch by: its ID. */
	key: string;
	/** The batch ID. Null only for a roast that arrived without one. */
	id: string | null;
	name: string;
	/** The batch's day, `YYYY-MM-DD`: the earliest day one of its roasts was roasted. */
	date: string | null;
	/** The latest roast day, when the batch's roasts span more than one day. */
	lastDate: string | null;
	/** Newest first. */
	roasts: T[];
}

/** A batch ID as a link or a form carries it, or null when the text is not one. */
export function parseBatchId(value: string | null | undefined): string | null {
	const text = value?.trim();
	return text && BATCH_ID.test(text) ? text.toLowerCase() : null;
}

/** The day a roast was roasted, `YYYY-MM-DD`, or null when it has no date. */
export function roastDay(roast: Pick<BatchedRoast, 'roast_date'>): string | null {
	return roast.roast_date?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/**
 * Group roasts into their batches by batch ID, newest batch first. Two batches that share a
 * name stay apart, and a batch whose roasts were roasted on different days stays together.
 */
export function groupRoastsByBatch<T extends BatchedRoast>(
	roasts: readonly T[]
): RoastBatchGroup<T>[] {
	const groups = new Map<string, RoastBatchGroup<T>>();

	for (const roast of roasts) {
		const id = parseBatchId(roast.batch_id);
		const name = roast.batch_name?.trim() || 'Unnamed batch';
		// A roast that arrived without a batch ID is kept with the roasts of its name and day.
		const key = id ?? `${name}|||${roastDay(roast) ?? 'unknown'}`;
		const group = groups.get(key);
		if (group) {
			group.roasts.push(roast);
		} else {
			groups.set(key, { key, id, name, date: null, lastDate: null, roasts: [roast] });
		}
	}

	for (const group of groups.values()) {
		group.roasts.sort(
			(a, b) => (roastDay(b) ?? '').localeCompare(roastDay(a) ?? '') || b.roast_id - a.roast_id
		);
		const days = group.roasts.flatMap((roast) => roastDay(roast) ?? []).sort();
		group.date = days[0] ?? null;
		const last = days[days.length - 1] ?? null;
		group.lastDate = last !== group.date ? last : null;
	}

	return [...groups.values()].sort(
		(a, b) =>
			(b.date ?? '').localeCompare(a.date ?? '') ||
			(b.roasts[0]?.roast_id ?? 0) - (a.roasts[0]?.roast_id ?? 0)
	);
}

/** A batch as a header, a chip, or a menu names it, date first: "Oct 1 · Wednesday roast". */
export function batchLabel(
	batch: Pick<RoastBatchGroup, 'name' | 'date'>,
	currentYear = new Date().getFullYear()
): string {
	const day = roastDayLabel(batch.date, currentYear);
	return day ? `${day} · ${batch.name}` : batch.name;
}

/** The days a batch covers when its roasts span more than one: "Oct 1 to Oct 2". */
export function batchSpanLabel(
	batch: Pick<RoastBatchGroup, 'date' | 'lastDate'>,
	currentYear = new Date().getFullYear()
): string | null {
	if (!batch.lastDate) return null;
	const first = roastDayLabel(batch.date, currentYear);
	const last = roastDayLabel(batch.lastDate, currentYear);
	return first && last ? `${first} to ${last}` : null;
}

/** The distinct coffees roasted in a batch, in the order its roasts list them. */
export function batchCoffees(
	batch: Pick<RoastBatchGroup, 'roasts'>
): { id: number; name: string }[] {
	const coffees = new Map<number, string>();
	for (const roast of batch.roasts) {
		if (roast.coffee_id == null || coffees.has(roast.coffee_id)) continue;
		coffees.set(roast.coffee_id, roast.coffee_name?.trim() || `Coffee #${roast.coffee_id}`);
	}
	return [...coffees].map(([id, name]) => ({ id, name }));
}

/**
 * The label of every batch in a picker, keyed by batch key. A batch is named by its date and
 * name. Batches that share both also name their coffees, and their roast numbers if they
 * still read the same.
 */
export function batchOptionLabels(
	batches: readonly RoastBatchGroup[],
	currentYear = new Date().getFullYear()
): Map<string, string> {
	const labels = new Map(batches.map((batch) => [batch.key, batchLabel(batch, currentYear)]));
	const details: ((batch: RoastBatchGroup) => string)[] = [
		(batch) =>
			batchCoffees(batch)
				.map((coffee) => coffee.name)
				.join(', '),
		(batch) => batch.roasts.map((roast) => `#${roast.roast_id}`).join(', ')
	];

	for (const detail of details) {
		const counts = new Map<string, number>();
		for (const label of labels.values()) counts.set(label, (counts.get(label) ?? 0) + 1);
		for (const batch of batches) {
			const label = labels.get(batch.key)!;
			if ((counts.get(label) ?? 0) < 2) continue;
			const extra = detail(batch);
			if (extra) labels.set(batch.key, `${label} · ${extra}`);
		}
	}
	return labels;
}

/** The batch a `/roast?batch=<batch id>` link narrows the roast list to. */
export function readBatchFilter(searchParams: URLSearchParams): string | null {
	return parseBatchId(searchParams.get('batch'));
}

/** The filters a roast list link can carry. Each one is left out of the link when it is not set. */
export interface RoastListLinkFilters {
	coffee?: number | null;
	batch?: string | null;
	range?: string | null;
	from?: string | null;
	to?: string | null;
	q?: string | null;
	market?: string | null;
}

/** The link to the roast list with its filters in force: `/roast?coffee=101&range=30d&q=guji`. */
export function roastListHref(filters: RoastListLinkFilters = {}): string {
	const query = [
		filters.coffee != null ? `coffee=${filters.coffee}` : null,
		filters.batch ? `batch=${filters.batch}` : null,
		filters.range ? `range=${filters.range}` : null,
		filters.from ? `from=${filters.from}` : null,
		filters.to ? `to=${filters.to}` : null,
		filters.q ? `q=${encodeURIComponent(filters.q)}` : null,
		filters.market ? `market=${filters.market}` : null
	]
		.filter(Boolean)
		.join('&');
	return query ? `/roast?${query}` : '/roast';
}

/** What a "Log sale" link fills in on the sale form. */
export interface SalePrefill {
	coffeeId: number | null;
	batchId: string | null;
	roastId: number | null;
}

/** The link to the sale form, filled in: `/profit?modal=new&coffee=101&batch=<id>&roast=4531`. */
export function saleHref(prefill: Partial<SalePrefill> = {}): string {
	const query = [
		'modal=new',
		prefill.coffeeId != null ? `coffee=${prefill.coffeeId}` : null,
		prefill.batchId ? `batch=${prefill.batchId}` : null,
		prefill.roastId != null ? `roast=${prefill.roastId}` : null
	]
		.filter(Boolean)
		.join('&');
	return `/profit?${query}`;
}

function readPositiveId(value: string | null): number | null {
	const text = value?.trim();
	if (!text || !POSITIVE_ID.test(text)) return null;
	const id = Number(text);
	return Number.isSafeInteger(id) ? id : null;
}

/** Read what a "Log sale" link filled in. A value that cannot be read is left empty. */
export function readSalePrefill(searchParams: URLSearchParams): SalePrefill {
	return {
		coffeeId: readPositiveId(searchParams.get('coffee')),
		batchId: parseBatchId(searchParams.get('batch')),
		roastId: readPositiveId(searchParams.get('roast'))
	};
}

/**
 * "Log sale" on a batch header. The coffee is filled in when the roasts shown are all of one
 * coffee; a batch of several coffees leaves that choice to the form.
 */
export function batchSaleHref(batch: Pick<RoastBatchGroup, 'id' | 'roasts'>): string | null {
	if (!batch.id) return null;
	const coffees = batchCoffees(batch);
	return saleHref({ batchId: batch.id, coffeeId: coffees.length === 1 ? coffees[0].id : null });
}

/** "Log sale" on one roast: its coffee, its batch, and the roast itself. */
export function roastSaleHref(roast: BatchedRoast): string | null {
	const batchId = parseBatchId(roast.batch_id);
	if (!batchId || roast.coffee_id == null) return null;
	return saleHref({ coffeeId: roast.coffee_id, batchId, roastId: roast.roast_id });
}

/** "Log sale" for one roast in a list's row menu, or nothing when the roast cannot be sold from. */
export function logSaleLink(roast: BatchedRoast): { label: string; href: string }[] {
	const href = roastSaleHref(roast);
	return href ? [{ label: 'Log sale', href }] : [];
}

/** What the member is asked before a batch is deleted. */
export function deleteBatchConfirmation(
	batch: Pick<RoastBatchGroup, 'name' | 'date' | 'roasts'>
): string {
	const day = formatDay(batch.date);
	const count = batch.roasts.length;
	const removed =
		count === 1
			? 'its 1 roast and everything recorded for it'
			: `its ${count} roasts and everything recorded for them`;
	return (
		`Delete the batch “${batch.name}”${day ? ` from ${day}` : ''}? ` +
		`This removes ${removed}, and cannot be undone. Sales recorded against the batch are kept.`
	);
}
