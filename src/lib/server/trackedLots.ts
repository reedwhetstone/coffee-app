import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

type SessionClient = SupabaseClient<Database>;
// tracked_lots is a new table not yet in generated types — cast through unknown for queries
type AnyClient = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type TrackedLotRow = { id: string; catalog_id: number; tracked_at: string };

export async function getTrackedLotIds(supabase: SessionClient, userId: string): Promise<number[]> {
	const { data } = await (supabase as unknown as AnyClient)
		.from('tracked_lots')
		.select('catalog_id')
		.eq('user_id', userId)
		.order('tracked_at', { ascending: false });
	return ((data ?? []) as Array<{ catalog_id: number }>).map((r) => r.catalog_id);
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

	const { data: inserted, error: insertError } = await client
		.from('tracked_lots')
		.insert({ user_id: userId, catalog_id: catalogId })
		.select('tracked_at')
		.single();

	if (insertError) throw insertError;

	return {
		tracked: true,
		trackedAt: (inserted as TrackedLotRow | null)?.tracked_at ?? undefined
	};
}
