import type { ParchmentClient, PriceIndexQuery, components } from '@purveyors/sdk';

/**
 * Aggregate price-index reader for Cherry Runtime's price_index_read tool.
 *
 * Parchment owns the aggregate query and entitlement check. The chat route
 * supplies its request-bound session client so the caller's credential reaches
 * /v1/price-index without exposing raw supplier rows.
 */

type PriceIndexItem = components['schemas']['PriceIndexItem'];

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;

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

function sanitizeFilterValue(value: string): string {
	return value.replace(/[%_,()]/g, ' ').trim();
}

function formatParchmentError(error: unknown): string {
	if (
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		typeof error.error === 'object' &&
		error.error !== null &&
		'message' in error.error &&
		typeof error.error.message === 'string'
	) {
		return error.error.message;
	}
	return 'unknown Parchment error';
}

export async function readPriceIndexForAgent(
	input: AgentPriceIndexInput,
	client: ParchmentClient
): Promise<AgentPriceIndexResult> {
	const days = Math.min(Math.max(input.days ?? DEFAULT_DAYS, 1), MAX_DAYS);
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
	const origin = input.origin ? sanitizeFilterValue(input.origin) : null;
	const process = input.process ? sanitizeFilterValue(input.process) : null;
	const wholesale = input.wholesale ?? null;

	const cutoff = new Date();
	cutoff.setUTCDate(cutoff.getUTCDate() - days);

	const query: PriceIndexQuery = {
		page: 1,
		limit,
		order: 'desc',
		from: cutoff.toISOString().slice(0, 10),
		...(origin ? { origin } : {}),
		...(process ? { process } : {}),
		...(wholesale === null ? {} : { wholesale: wholesale ? 'true' : 'false' })
	};
	const { data, error } = await client.priceIndex.list(query);

	if (error) throw new Error(`Parchment price index query failed: ${formatParchmentError(error)}`);

	const snapshots: AgentPriceIndexItem[] = (data?.data ?? []).map((row: PriceIndexItem) => ({
		date: row.date,
		origin: row.origin,
		process: row.process,
		grade: row.grade,
		wholesale: row.wholesale,
		price: {
			min: row.price.min,
			p25: row.price.p25,
			median: row.price.median,
			avg: row.price.avg,
			p75: row.price.p75,
			max: row.price.max
		},
		suppliers: row.sample.suppliers,
		listings: row.sample.listings,
		synthetic: row.provenance.synthetic
	}));

	return {
		snapshots,
		total_returned: snapshots.length,
		window_days: days,
		filters_applied: { origin, process, wholesale },
		source: { table: 'price_index_snapshots', aggregate_only: true }
	};
}
