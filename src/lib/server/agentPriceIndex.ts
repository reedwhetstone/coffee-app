import { createAdminClient } from '$lib/supabase-admin';

/**
 * Aggregate price-index reader for the chat agent's price_index_read tool.
 *
 * price_index_snapshots revokes SELECT from anon/authenticated, so this must
 * use the admin client. It exposes only the tier-aggregate columns that
 * /v1/price-index already serves — never raw supplier rows. Entitlement is
 * enforced upstream: the tool is only registered for Parchment Intelligence
 * and Mallard Studio chat sessions.
 */

interface SnapshotRowsResult {
	data: Array<Record<string, unknown>> | null;
	error: { message: string } | null;
}

interface SnapshotQueryBuilder extends PromiseLike<SnapshotRowsResult> {
	gte(column: string, value: string): SnapshotQueryBuilder;
	eq(column: string, value: boolean): SnapshotQueryBuilder;
	ilike(column: string, pattern: string): SnapshotQueryBuilder;
	order(column: string, options: { ascending: boolean }): SnapshotQueryBuilder;
	limit(count: number): SnapshotQueryBuilder;
}

interface SnapshotClient {
	from(table: 'price_index_snapshots'): {
		select(columns: string): SnapshotQueryBuilder;
	};
}

const SNAPSHOT_COLUMNS =
	'snapshot_date, origin, process, grade, wholesale_only, price_min, price_max, price_avg, price_median, price_p25, price_p75, supplier_count, sample_size, synthetic';

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — snapshots are recomputed daily

export interface AgentPriceIndexInput {
	origin?: string;
	process?: string;
	days?: number;
	wholesale?: boolean;
	limit?: number;
}

export interface AgentPriceIndexItem {
	date: string;
	origin: string;
	process: string | null;
	grade: string | null;
	wholesale: boolean;
	price: {
		min: number | null;
		p25: number | null;
		median: number | null;
		avg: number | null;
		p75: number | null;
		max: number | null;
	};
	suppliers: number;
	listings: number;
	synthetic: boolean;
}

export interface AgentPriceIndexResult {
	snapshots: AgentPriceIndexItem[];
	total_returned: number;
	window_days: number;
	filters_applied: { origin: string | null; process: string | null; wholesale: boolean | null };
	source: { table: 'price_index_snapshots'; aggregate_only: true };
}

export type AgentPriceIndexReader = (input: AgentPriceIndexInput) => Promise<AgentPriceIndexResult>;

const cache = new Map<string, { expires: number; value: AgentPriceIndexResult }>();

/** Test hook: clear the agent price index cache. */
export function _clearAgentPriceIndexCache(): void {
	cache.clear();
}

function sanitizeFilterValue(value: string): string {
	return value.replace(/[%_,()]/g, ' ').trim();
}

function toNullableNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export async function readPriceIndexForAgent(
	input: AgentPriceIndexInput,
	client: SnapshotClient = createAdminClient() as unknown as SnapshotClient
): Promise<AgentPriceIndexResult> {
	const days = Math.min(Math.max(input.days ?? DEFAULT_DAYS, 1), MAX_DAYS);
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
	const origin = input.origin ? sanitizeFilterValue(input.origin) : null;
	const process = input.process ? sanitizeFilterValue(input.process) : null;
	const wholesale = input.wholesale ?? null;

	const cacheKey = JSON.stringify({ days, limit, origin, process, wholesale });
	const cached = cache.get(cacheKey);
	if (cached && Date.now() <= cached.expires) return cached.value;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);

	let query = client
		.from('price_index_snapshots')
		.select(SNAPSHOT_COLUMNS)
		.gte('snapshot_date', cutoff.toISOString().slice(0, 10));

	if (origin) query = query.ilike('origin', `%${origin}%`);
	if (process) query = query.ilike('process', `%${process}%`);
	if (wholesale !== null) query = query.eq('wholesale_only', wholesale);

	const { data, error } = await query.order('snapshot_date', { ascending: false }).limit(limit);

	if (error) throw new Error(`price_index_snapshots query failed: ${error.message}`);

	const snapshots: AgentPriceIndexItem[] = (data ?? []).map((row) => ({
		date: String(row.snapshot_date ?? ''),
		origin: String(row.origin ?? ''),
		process: typeof row.process === 'string' ? row.process : null,
		grade: typeof row.grade === 'string' ? row.grade : null,
		wholesale: row.wholesale_only === true,
		price: {
			min: toNullableNumber(row.price_min),
			p25: toNullableNumber(row.price_p25),
			median: toNullableNumber(row.price_median),
			avg: toNullableNumber(row.price_avg),
			p75: toNullableNumber(row.price_p75),
			max: toNullableNumber(row.price_max)
		},
		suppliers: toNullableNumber(row.supplier_count) ?? 0,
		listings: toNullableNumber(row.sample_size) ?? 0,
		synthetic: row.synthetic === true
	}));

	const result: AgentPriceIndexResult = {
		snapshots,
		total_returned: snapshots.length,
		window_days: days,
		filters_applied: { origin, process, wholesale },
		source: { table: 'price_index_snapshots', aggregate_only: true }
	};

	cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: result });
	return result;
}
