import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

type SessionClient = SupabaseClient<Database>;
// tracked_lots is a new table not yet in generated types — cast through unknown for queries
type AnyClient = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type TrackedLotRow = { id: string; catalog_id: number; tracked_at: string };

export type TrackedLotSummary = {
	catalogId: number;
	trackedAt: string;
	priceAtTracking: number | null;
	name: string;
	source: string | null;
	country: string | null;
	region: string | null;
	processing: string | null;
	stocked: boolean | null;
	wholesale: boolean | null;
	unstockedDate: string | null;
	currentPrice: number | null;
	priceDelta: number | null;
};

function toDisplayPrice(row: {
	price_per_lb?: number | null;
	cost_lb?: number | null;
}): number | null {
	const price = row.price_per_lb ?? row.cost_lb;
	return typeof price === 'number' && Number.isFinite(price) ? price : null;
}

export async function getTrackedLotIds(supabase: SessionClient, userId: string): Promise<number[]> {
	const { data } = await (supabase as unknown as AnyClient)
		.from('tracked_lots')
		.select('catalog_id')
		.eq('user_id', userId)
		.order('tracked_at', { ascending: false });
	return ((data ?? []) as Array<{ catalog_id: number }>).map((r) => r.catalog_id);
}

/**
 * Tracked lots joined with live catalog state plus the price captured at tracking time,
 * so consumers can report availability and price movement since the lot was watchlisted.
 */
export async function getTrackedLotSummaries(
	supabase: SessionClient,
	userId: string,
	limit = 50
): Promise<TrackedLotSummary[]> {
	const client = supabase as unknown as AnyClient;
	const { data: trackedRows, error: trackedError } = await client
		.from('tracked_lots')
		.select('catalog_id, tracked_at, price_at_tracking')
		.eq('user_id', userId)
		.order('tracked_at', { ascending: false })
		.limit(limit);

	if (trackedError) throw trackedError;

	const tracked = (trackedRows ?? []) as Array<{
		catalog_id: number;
		tracked_at: string;
		price_at_tracking: number | null;
	}>;
	if (!tracked.length) return [];

	const { data: catalogRows, error: catalogError } = await client
		.from('coffee_catalog')
		.select(
			'id, name, source, country, region, processing, stocked, wholesale, unstocked_date, price_per_lb, cost_lb'
		)
		.in(
			'id',
			tracked.map((row) => row.catalog_id)
		);

	if (catalogError) throw catalogError;

	const catalogById = new Map(
		((catalogRows ?? []) as Array<Record<string, unknown>>).map((row) => [row.id as number, row])
	);

	return tracked.flatMap((row) => {
		const lot = catalogById.get(row.catalog_id);
		if (!lot) return [];
		const currentPrice = toDisplayPrice(
			lot as { price_per_lb?: number | null; cost_lb?: number | null }
		);
		const priceAtTracking =
			typeof row.price_at_tracking === 'number' && Number.isFinite(row.price_at_tracking)
				? row.price_at_tracking
				: null;
		return [
			{
				catalogId: row.catalog_id,
				trackedAt: row.tracked_at,
				priceAtTracking,
				name: (lot.name as string | null) ?? `Lot ${row.catalog_id}`,
				source: (lot.source as string | null) ?? null,
				country: (lot.country as string | null) ?? null,
				region: (lot.region as string | null) ?? null,
				processing: (lot.processing as string | null) ?? null,
				stocked: (lot.stocked as boolean | null) ?? null,
				wholesale: (lot.wholesale as boolean | null) ?? null,
				unstockedDate: (lot.unstocked_date as string | null) ?? null,
				currentPrice,
				priceDelta:
					currentPrice !== null && priceAtTracking !== null
						? Math.round((currentPrice - priceAtTracking) * 100) / 100
						: null
			}
		];
	});
}

export async function toggleTrackedLot(
	supabase: SessionClient,
	userId: string,
	catalogId: number
): Promise<{ tracked: boolean; trackedAt?: string }> {
	const client = supabase as unknown as AnyClient;

	const { data: existing, error: lookupError } = await client
		.from('tracked_lots')
		.select('id')
		.eq('user_id', userId)
		.eq('catalog_id', catalogId)
		.maybeSingle();

	if (lookupError) throw lookupError;

	if (existing) {
		const { error: deleteError } = await client
			.from('tracked_lots')
			.delete()
			.eq('user_id', userId)
			.eq('catalog_id', catalogId);
		if (deleteError) throw deleteError;
		return { tracked: false };
	}

	const { data: catalogRow, error: catalogError } = await client
		.from('coffee_catalog')
		.select('price_per_lb, cost_lb')
		.eq('id', catalogId)
		.maybeSingle();

	if (catalogError) throw catalogError;

	const { data: inserted, error: insertError } = await client
		.from('tracked_lots')
		.insert({
			user_id: userId,
			catalog_id: catalogId,
			price_at_tracking: catalogRow ? toDisplayPrice(catalogRow) : null
		})
		.select('tracked_at')
		.single();

	if (insertError) throw insertError;

	return {
		tracked: true,
		trackedAt: (inserted as TrackedLotRow | null)?.tracked_at ?? undefined
	};
}
