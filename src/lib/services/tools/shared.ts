import type { SupabaseClient } from '@supabase/supabase-js';
import { listInventory } from '@purveyors/cli/inventory';

/**
 * Coerce falsy or non-positive numeric IDs to undefined.
 * LLMs sometimes pass 0 for optional ID fields meaning "no filter".
 * CLI Zod schemas use .positive() and reject 0.
 */
export function positiveOrUndef(val: number | undefined | null): number | undefined {
	return typeof val === 'number' && val > 0 ? val : undefined;
}

export type InventoryResult = Awaited<ReturnType<typeof listInventory>>[number];

export function stripInventoryRoastProfileData<T extends InventoryResult>(
	rows: T[]
): Array<T & { roast_profiles: [] }> {
	return rows.map((row) => ({ ...row, roast_profiles: [] }));
}

export interface InventoryRoastSummary {
	total_roasts: number;
	last_roast_date: string | null;
	total_oz_in: number;
}

/**
 * Attach per-item roast summaries to inventory rows. The CLI's listInventory
 * selects no roast data (roast_profiles.coffee_id → green_coffee_inv.id), so
 * without this every canvas inventory table shows 0 roasts.
 */
export async function attachRoastSummaries<T extends InventoryResult>(
	supabase: SupabaseClient,
	userId: string,
	rows: T[]
): Promise<Array<T & { roast_summary: InventoryRoastSummary }>> {
	const summaries = new Map<number, InventoryRoastSummary>();

	const ids = rows.map((row) => row.id).filter((id): id is number => typeof id === 'number');
	if (ids.length > 0) {
		const { data, error } = await supabase
			.from('roast_profiles')
			.select('coffee_id, roast_date, oz_in')
			.eq('user', userId)
			.in('coffee_id', ids);
		if (error) throw new Error(`roast_profiles query failed: ${error.message}`);

		for (const roast of data ?? []) {
			const existing = summaries.get(roast.coffee_id) ?? {
				total_roasts: 0,
				last_roast_date: null,
				total_oz_in: 0
			};
			existing.total_roasts += 1;
			existing.total_oz_in += typeof roast.oz_in === 'number' ? roast.oz_in : 0;
			const roastDate = typeof roast.roast_date === 'string' ? roast.roast_date : null;
			if (roastDate && (!existing.last_roast_date || roastDate > existing.last_roast_date)) {
				existing.last_roast_date = roastDate;
			}
			summaries.set(roast.coffee_id, existing);
		}
	}

	return rows.map((row) => ({
		...row,
		roast_summary: summaries.get(row.id as number) ?? {
			total_roasts: 0,
			last_roast_date: null,
			total_oz_in: 0
		}
	}));
}

/**
 * Access flags that determine which tools are exposed to a given user.
 */
export interface ChatToolAccess {
	ppiAccess?: boolean;
	memberAccess?: boolean;
}

/**
 * Server-injected dependencies for tools that cannot run on the user-scoped
 * client (e.g. price_index_read needs the admin client because
 * price_index_snapshots revokes SELECT from authenticated users).
 */
export interface ChatToolDeps {
	searchCatalog?: (input: {
		origin?: string;
		process?: string;
		variety?: string;
		price_range?: [number, number];
		flavor_keywords?: string[];
		limit?: number;
		stocked_only?: boolean;
		name?: string;
		stocked_days?: number;
		drying_method?: string;
		supplier?: string;
		coffee_ids?: number[];
	}) => Promise<Record<string, unknown>[]>;
	readPriceIndex?: (input: {
		origin?: string;
		process?: string;
		days?: number;
		wholesale?: boolean;
		limit?: number;
	}) => Promise<unknown>;
	findSimilarBeans?: (
		input: {
			coffee_id: number;
			threshold?: number;
			limit?: number;
		},
		options: { publicOnly: boolean }
	) => Promise<unknown>;
	/** ADR-008 Market Index reads. Injected by the chat route with request credentials. */
	marketSignals?: (input: {
		type?: string[];
		origin?: string;
		process?: string;
		market?: 'retail' | 'wholesale' | 'all';
		min_discount_pct?: number;
		min_score?: number;
		window?: '7d' | '30d';
		limit?: number;
	}) => Promise<unknown>;
	marketStats?: (input: {
		origin?: string;
		process?: string;
		market?: 'retail' | 'wholesale' | 'all';
		window?: '7d' | '30d';
		baseline_weeks?: number;
	}) => Promise<unknown>;
	marketMetadataIndex?: (input: {
		dimension: 'process' | 'disclosure';
		origin?: string;
		market?: 'retail' | 'wholesale' | 'all';
		grain?: 'week' | 'month';
		from?: string;
		to?: string;
	}) => Promise<unknown>;
}
