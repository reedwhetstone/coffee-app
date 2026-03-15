/**
 * Roast data layer — single source of truth for all roast_profiles queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - clearRoastData consolidates 3-way duplication from /api/clear-roast,
 *    DELETE /api/roast-profiles, and roastDataUtils.clearRoastData().
 *  - calculateWeightLoss is moved here from inline route handler logic.
 *  - Milestone recalculation after PUT stays in computeMilestoneUpdate (private).
 *  - insertTemperatures / insertEvents / saveRoastData are kept here to allow
 *    roastDataUtils.ts to re-export them (backwards compat for artisan-import).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoastProfile = Database['public']['Tables']['roast_profiles']['Row'];
type RoastProfileInsert = Database['public']['Tables']['roast_profiles']['Insert'];
type RoastProfileUpdate = Database['public']['Tables']['roast_profiles']['Update'];

type CoffeeCatalogName = { name: string };
type GreenCoffeeWithCatalog = Database['public']['Tables']['green_coffee_inv']['Row'] & {
	coffee_catalog: CoffeeCatalogName | CoffeeCatalogName[] | null;
};

export interface RoastListOptions {
	/** Order by field (default: roast_date desc) */
	orderBy?: string;
	ascending?: boolean;
}

export interface RoastCreateSingleInput {
	coffee_id: number;
	coffee_name?: string;
	batch_name?: string;
	roast_date?: string;
	last_updated?: string;
	oz_in?: number | null;
	oz_out?: number | null;
	roast_notes?: string | null;
	roast_targets?: unknown;
	[key: string]: unknown;
}

export interface RoastBatchInput {
	batch_beans: {
		coffee_id: number;
		coffee_name?: string;
		oz_in?: number | null;
		oz_out?: number | null;
		[key: string]: unknown;
	}[];
	batch_name?: string;
	roast_date?: string;
	roast_notes?: string | null;
	roast_targets?: unknown;
}

export type RoastCreateInput = RoastCreateSingleInput | RoastBatchInput;

export interface RoastUpdateInput extends RoastProfileUpdate {
	temperatureEntries?: TemperatureRow[];
	eventEntries?: EventRow[];
}

export interface ClearRoastResult {
	deleted_counts: {
		artisan_import_log: number;
		roast_events: number;
		roast_temperatures: number;
	};
	batch_name: string | null;
}

export interface TemperatureRow {
	roast_id: number;
	time_seconds: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source: string;
}

export interface EventRow {
	roast_id: number;
	time_seconds: number;
	event_type: number;
	event_value: string | null;
	event_string: string;
	category: string;
	subcategory: string;
	user_generated: boolean;
	automatic: boolean;
	notes?: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

/** Calculate weight loss percentage from oz_in / oz_out. */
export function calculateWeightLoss(ozIn: number | null, ozOut: number | null): number | null {
	if (!ozIn || !ozOut || ozIn <= 0) return null;
	const weightLoss = ((ozIn - ozOut) / ozIn) * 100;
	return Math.round(weightLoss * 100) / 100;
}

/** Normalize a datetime string for DB insertion (YYYY-MM-DD HH:MM:SS). */
function toDbDatetime(value: string | null | undefined): string {
	if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');
	return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Compute milestone timing + phase percentage columns from live event entries.
 * Returns a partial RoastProfileUpdate suitable for a .update() call.
 */
function computeMilestoneUpdate(events: EventRow[]): Partial<RoastProfileUpdate> {
	const milestoneEvents = events.filter((e) => e.category === 'milestone');
	if (milestoneEvents.length === 0) return {};

	const milestones: Record<string, number> = {};
	for (const evt of milestoneEvents) {
		milestones[evt.event_string] = parseFloat(String(evt.time_seconds));
	}

	const chargeTime = milestones['charge'] ?? milestones['start'] ?? 0;
	const dropTime = milestones['drop'] ?? milestones['end'] ?? milestones['cool'] ?? 0;
	const dryEndTime = milestones['dry_end'] ?? milestones['maillard'] ?? 0;
	const fcStartTime = milestones['fc_start'] ?? 0;
	const totalTime = dropTime > chargeTime ? dropTime - chargeTime : 0;

	const update: Partial<RoastProfileUpdate> = {
		charge_time: chargeTime || null,
		dry_end_time: dryEndTime || null,
		fc_start_time: fcStartTime || null,
		total_roast_time: totalTime || null,
		dry_percent: null,
		maillard_percent: null,
		development_percent: null
	};

	if (totalTime > 0) {
		if (dryEndTime > chargeTime) {
			update.dry_percent = Math.round(((dryEndTime - chargeTime) / totalTime) * 1000) / 10;
		}
		if (fcStartTime > dryEndTime && dryEndTime > 0) {
			update.maillard_percent = Math.round(((fcStartTime - dryEndTime) / totalTime) * 1000) / 10;
		}
		if (dropTime > fcStartTime && fcStartTime > 0) {
			update.development_percent = Math.round(((dropTime - fcStartTime) / totalTime) * 1000) / 10;
		}
	}

	return update;
}

/**
 * Resolve a catalog name string from a Supabase join result that may return
 * an object or an array (depending on query shape).
 */
function resolveCatalogName(
	catalog: CoffeeCatalogName | CoffeeCatalogName[] | null | undefined
): string | undefined {
	if (!catalog) return undefined;
	if (Array.isArray(catalog)) return catalog[0]?.name;
	return (catalog as CoffeeCatalogName).name;
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * List roast profiles for a user, ordered by roast_date desc by default.
 */
export async function listRoasts(
	supabase: SupabaseClient,
	userId: string,
	options: RoastListOptions = {}
): Promise<RoastProfile[]> {
	const { orderBy = 'roast_date', ascending = false } = options;
	const { data, error } = await supabase
		.from('roast_profiles')
		.select('*')
		.eq('user', userId)
		.order(orderBy, { ascending });

	if (error) throw error;
	return (data as RoastProfile[]) ?? [];
}

/**
 * Get a single roast profile by ID, verifying user ownership.
 * Returns null when not found.
 */
export async function getRoast(
	supabase: SupabaseClient,
	roastId: number,
	userId: string
): Promise<RoastProfile | null> {
	const { data, error } = await supabase
		.from('roast_profiles')
		.select('*')
		.eq('roast_id', roastId)
		.eq('user', userId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') return null;
		throw error;
	}
	return data as RoastProfile;
}

/**
 * Verify ownership of a roast profile and return it.
 * Throws an error with a 403-style message when the profile is not found
 * or does not belong to the user.
 */
export async function verifyRoastOwnership(
	supabase: SupabaseClient,
	roastId: number,
	userId: string
): Promise<{ roast_id: number; user: string; coffee_id: number }> {
	const { data, error } = await supabase
		.from('roast_profiles')
		.select('roast_id, user, coffee_id')
		.eq('roast_id', roastId)
		.single();

	if (error || !data) throw new Error('Roast profile not found');
	if (data.user !== userId) throw new Error('Unauthorized');
	return data as { roast_id: number; user: string; coffee_id: number };
}

/**
 * Create one or more roast profiles.
 *
 * Accepts either:
 *  - A single profile object (RoastCreateSingleInput / legacy array of single profiles)
 *  - A batch object with `batch_beans` (RoastBatchInput)
 *
 * Returns `{ profiles, roastIds }` in all cases.
 */
export async function createRoasts(
	supabase: SupabaseClient,
	userId: string,
	data: RoastCreateInput
): Promise<{ profiles: RoastProfile[]; roastIds: number[] }> {
	const isBatch = 'batch_beans' in data && Array.isArray(data.batch_beans);

	if (isBatch) {
		const batchData = data as RoastBatchInput;
		const { batch_name, batch_beans, roast_date, roast_notes, roast_targets } = batchData;

		// Validate
		for (const bean of batch_beans) {
			if (!bean.coffee_id) throw new Error('coffee_id is required for all beans in batch');
		}

		const coffeeIds: number[] = batch_beans.map((b) => b.coffee_id);
		const uniqueCoffeeIds: number[] = [...new Set(coffeeIds)];

		const { data: coffeesRaw, error: coffeeError } = await supabase
			.from('green_coffee_inv')
			.select('id, coffee_catalog!catalog_id (name)')
			.in('id', uniqueCoffeeIds)
			.eq('user', userId);

		if (coffeeError) throw coffeeError;
		const coffees = (coffeesRaw ?? []) as unknown as GreenCoffeeWithCatalog[];

		if (!coffees || coffees.length === 0)
			throw new Error('No valid coffee_ids found for this user');
		if (coffees.length !== uniqueCoffeeIds.length) {
			const foundIds = coffees.map((c) => c.id);
			const missingIds = uniqueCoffeeIds.filter((id) => !foundIds.includes(id));
			throw new Error(`Coffee IDs not found or not owned by user: ${missingIds.join(', ')}`);
		}

		const coffeeMap = new Map(coffees.map((c) => [c.id, c]));

		const profilesData: RoastProfileInsert[] = batch_beans.map((bean) => {
			const coffee = coffeeMap.get(bean.coffee_id);
			if (!coffee) throw new Error(`Invalid coffee_id - coffee not found: ${bean.coffee_id}`);
			const catalogName = resolveCatalogName(coffee.coffee_catalog);

			return {
				user: userId,
				batch_name:
					batch_name || `${catalogName || 'Unknown Coffee'} - ${new Date().toLocaleDateString()}`,
				coffee_id: bean.coffee_id,
				coffee_name: bean.coffee_name || catalogName,
				roast_date: toDbDatetime(roast_date),
				last_updated: toDbDatetime(undefined),
				oz_in: bean.oz_in ?? null,
				oz_out: bean.oz_out ?? null,
				weight_loss_percent: calculateWeightLoss(bean.oz_in ?? null, bean.oz_out ?? null),
				roast_notes: roast_notes ?? null,
				roast_targets: roast_targets ?? null
			} as RoastProfileInsert;
		});

		const { data: profiles, error } = await supabase
			.from('roast_profiles')
			.insert(profilesData)
			.select();

		if (error) throw error;
		return {
			profiles: (profiles as RoastProfile[]) ?? [],
			roastIds: ((profiles as { roast_id: number }[]) ?? []).map((p) => p.roast_id)
		};
	} else {
		// Single (or legacy array) creation
		const singleData = data as RoastCreateSingleInput;
		const profiles = Array.isArray(singleData) ? singleData : [singleData];

		for (const p of profiles) {
			if (!p.coffee_id) throw new Error('coffee_id is required for all profiles');
		}

		const coffeeIds = profiles.map((p) => p.coffee_id) as number[];

		const { data: coffeesRaw, error: coffeeError } = await supabase
			.from('green_coffee_inv')
			.select('id, coffee_catalog!catalog_id (name)')
			.in('id', coffeeIds)
			.eq('user', userId);

		if (coffeeError) throw coffeeError;
		const coffees = (coffeesRaw ?? []) as unknown as GreenCoffeeWithCatalog[];

		if (!coffees || coffees.length === 0)
			throw new Error('No valid coffee_ids found for this user');
		if (coffees.length !== profiles.length) {
			const foundIds = coffees.map((c) => c.id);
			const missingIds = coffeeIds.filter((id) => !foundIds.includes(id));
			throw new Error(`Coffee IDs not found or not owned by user: ${missingIds.join(', ')}`);
		}

		const coffeeMap = new Map(coffees.map((c) => [c.id, c]));

		const profilesData: RoastProfileInsert[] = profiles.map((profileData) => {
			const coffee = coffeeMap.get(profileData.coffee_id);
			if (!coffee)
				throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
			const catalogName = resolveCatalogName(coffee.coffee_catalog);

			return {
				...profileData,
				user: userId,
				batch_name:
					profileData.batch_name ||
					`${catalogName || 'Unknown Coffee'} - ${new Date().toLocaleDateString()}`,
				coffee_id: profileData.coffee_id,
				coffee_name: profileData.coffee_name || catalogName,
				roast_date: toDbDatetime(profileData.roast_date as string | undefined),
				last_updated: toDbDatetime(profileData.last_updated as string | undefined),
				oz_in: profileData.oz_in ?? null,
				oz_out: profileData.oz_out ?? null,
				roast_notes: profileData.roast_notes ?? null,
				roast_targets: profileData.roast_targets ?? null
			} as RoastProfileInsert;
		});

		const { data: results, error } = await supabase
			.from('roast_profiles')
			.insert(profilesData)
			.select();

		if (error) throw error;
		return {
			profiles: (results as RoastProfile[]) ?? [],
			roastIds: ((results as { roast_id: number }[]) ?? []).map((p) => p.roast_id)
		};
	}
}

/**
 * Update roast metadata, optionally persisting temperature/event data.
 *
 * If `data.temperatureEntries` is provided, clears old live data and re-saves.
 * If milestone events are present, recomputes and persists milestone columns.
 *
 * Returns the updated RoastProfile row.
 */
export async function updateRoast(
	supabase: SupabaseClient,
	roastId: number,
	userId: string,
	data: RoastUpdateInput
): Promise<{ profile: RoastProfile; coffeeId: number }> {
	const { temperatureEntries, eventEntries, ...profileData } = data;
	const updateData = profileData as RoastProfileUpdate;

	// Compute weight_loss_percent if oz values are being updated
	if (updateData.oz_in !== undefined || updateData.oz_out !== undefined) {
		if (updateData.oz_in === undefined || updateData.oz_out === undefined) {
			// Fetch the current values for the field we are NOT updating
			const { data: current } = await supabase
				.from('roast_profiles')
				.select('oz_in, oz_out')
				.eq('roast_id', roastId)
				.single();

			const ozIn = updateData.oz_in !== undefined ? updateData.oz_in : current?.oz_in;
			const ozOut = updateData.oz_out !== undefined ? updateData.oz_out : current?.oz_out;
			updateData.weight_loss_percent = calculateWeightLoss(
				ozIn as number | null,
				ozOut as number | null
			);
		} else {
			updateData.weight_loss_percent = calculateWeightLoss(
				updateData.oz_in as number | null,
				updateData.oz_out as number | null
			);
		}
	}

	// Verify ownership — returns coffee_id to avoid a second query in the caller
	const existing = await verifyRoastOwnership(supabase, roastId, userId);

	const { data: updated, error } = await supabase
		.from('roast_profiles')
		.update(updateData)
		.eq('roast_id', roastId)
		.eq('user', userId)
		.select()
		.single();

	if (error) throw error;

	// Optionally persist temperature / event data
	if (Array.isArray(temperatureEntries) && temperatureEntries.length > 0) {
		const temps = temperatureEntries.map((t) => ({ ...t, roast_id: roastId }));
		const events = Array.isArray(eventEntries)
			? eventEntries.map((e) => ({ ...e, roast_id: roastId }))
			: [];
		await saveRoastData(supabase, roastId, temps, events, 'live');

		// Recompute milestone columns from live events
		if (events.length > 0) {
			const milestoneUpdate = computeMilestoneUpdate(events);
			if (Object.keys(milestoneUpdate).length > 0) {
				await supabase
					.from('roast_profiles')
					.update(milestoneUpdate)
					.eq('roast_id', roastId)
					.eq('user', userId);
			}
		}
	}

	return { profile: updated as RoastProfile, coffeeId: existing.coffee_id };
}

/**
 * Delete a single roast profile (with cascade to temps/events).
 * Returns the coffee_id so callers can update stocked status without a second query.
 */
export async function deleteRoast(
	supabase: SupabaseClient,
	roastId: number,
	userId: string
): Promise<{ coffeeId: number }> {
	// Verify ownership — returns coffee_id so we don't need a second query
	const existing = await verifyRoastOwnership(supabase, roastId, userId);

	// Delete associated data first
	await supabase.from('roast_temperatures').delete().eq('roast_id', roastId);
	await supabase.from('roast_events').delete().eq('roast_id', roastId);
	// Then delete the profile
	await supabase.from('roast_profiles').delete().eq('roast_id', roastId).eq('user', userId);
	return { coffeeId: existing.coffee_id };
}

/**
 * Delete all roast profiles in a batch by batch_name (with cascade).
 * Returns the list of affected roastIds and coffeeIds for stocked-status updates.
 */
export async function deleteBatch(
	supabase: SupabaseClient,
	batchName: string,
	userId: string
): Promise<{ roastIds: number[]; coffeeIds: number[] }> {
	const { data: profilesRaw } = await supabase
		.from('roast_profiles')
		.select('roast_id, coffee_id')
		.eq('batch_name', batchName)
		.eq('user', userId);

	const profiles = (profilesRaw as { roast_id: number; coffee_id: number }[] | null) ?? [];
	if (profiles.length === 0) return { roastIds: [], coffeeIds: [] };

	const roastIds = profiles.map((p) => p.roast_id);
	const coffeeIds = [...new Set(profiles.map((p) => p.coffee_id))];

	await supabase.from('roast_temperatures').delete().in('roast_id', roastIds);
	await supabase.from('roast_events').delete().in('roast_id', roastIds);
	await supabase.from('roast_profiles').delete().eq('batch_name', batchName).eq('user', userId);

	return { roastIds, coffeeIds };
}

/**
 * Clear ALL roast temperature/event data for a given roast, preserving the profile record.
 * Also clears the artisan_import_log and resets Artisan-specific profile fields.
 *
 * This is the consolidated implementation for:
 *  - DELETE /api/clear-roast
 *  - roastDataUtils.clearRoastData() (full reset variant)
 *
 * The `source` parameter controls which temperature/event rows are deleted:
 *  - undefined (full clear): deletes everything, resets all Artisan fields
 *  - 'artisan_import': deletes by data_source + milestone/control/machine event categories
 *  - 'live': deletes live temperatures + all roast_events
 */
export async function clearRoastData(
	supabase: SupabaseClient,
	roastId: number,
	source?: 'artisan_import' | 'live'
): Promise<ClearRoastResult> {
	// Fetch profile for batch_name (used in response / verification)
	const { data: profileRaw } = (await supabase
		.from('roast_profiles')
		.select('batch_name')
		.eq('roast_id', roastId)
		.single()) as { data: { batch_name: string | null } | null; error: unknown };

	const batchName = profileRaw?.batch_name ?? null;
	const deletedCounts = { artisan_import_log: 0, roast_events: 0, roast_temperatures: 0 };

	if (!source) {
		// Full clear: matches /api/clear-roast DELETE behaviour
		const { data: deletedImportLog } = await supabase
			.from('artisan_import_log')
			.delete()
			.eq('roast_id', roastId)
			.select('import_id');
		deletedCounts.artisan_import_log = deletedImportLog?.length ?? 0;

		const { data: deletedEvents } = await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', roastId)
			.select('event_id');
		deletedCounts.roast_events = deletedEvents?.length ?? 0;

		const { data: deletedTemps } = await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', roastId)
			.select('temp_id');
		deletedCounts.roast_temperatures = deletedTemps?.length ?? 0;

		// Reset Artisan-specific profile fields
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (supabase.from('roast_profiles') as any)
			.update({
				title: null,
				roaster_type: null,
				roaster_size: null,
				roast_uuid: null,
				temperature_unit: 'F',
				charge_time: null,
				dry_end_time: null,
				fc_start_time: null,
				fc_end_time: null,
				sc_start_time: null,
				drop_time: null,
				cool_time: null,
				charge_temp: null,
				dry_end_temp: null,
				fc_start_temp: null,
				fc_end_temp: null,
				sc_start_temp: null,
				drop_temp: null,
				cool_temp: null,
				dry_percent: null,
				maillard_percent: null,
				development_percent: null,
				total_roast_time: null,
				chart_x_min: null,
				chart_x_max: null,
				chart_y_min: null,
				chart_y_max: null,
				chart_z_min: null,
				chart_z_max: null,
				data_source: 'manual'
			})
			.eq('roast_id', roastId);
	} else {
		// Source-scoped clear: matches old roastDataUtils.clearRoastData() behaviour
		console.log(`Clearing existing ${source} data for roast ${roastId}...`);

		await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', roastId)
			.eq('data_source', source);

		if (source === 'artisan_import') {
			await supabase
				.from('roast_events')
				.delete()
				.eq('roast_id', roastId)
				.in('category', ['milestone', 'control', 'machine']);
		} else {
			await supabase.from('roast_events').delete().eq('roast_id', roastId);
		}
	}

	return { deleted_counts: deletedCounts, batch_name: batchName };
}

// ── Temperature / event insertion ─────────────────────────────────────────────

/**
 * Batch-insert temperature rows into roast_temperatures.
 */
export async function insertTemperatures(
	supabase: SupabaseClient,
	entries: TemperatureRow[]
): Promise<void> {
	for (let i = 0; i < entries.length; i += BATCH_SIZE) {
		const batch = entries.slice(i, i + BATCH_SIZE);
		const { error } = await supabase.from('roast_temperatures').insert(batch);
		if (error) {
			console.error('Error inserting temperature batch:', error);
			throw error;
		}
	}
}

/**
 * Batch-insert event rows into roast_events.
 */
export async function insertEvents(supabase: SupabaseClient, entries: EventRow[]): Promise<void> {
	for (let i = 0; i < entries.length; i += BATCH_SIZE) {
		const batch = entries.slice(i, i + BATCH_SIZE);
		const { error } = await supabase.from('roast_events').insert(batch);
		if (error) {
			console.error('Error inserting event batch:', error);
			throw error;
		}
	}
}

/**
 * Extract milestone profile data from events and compute phase percentages.
 * Returns an object suitable for updating roast_profiles milestone columns.
 * (Migrated from roastDataUtils.extractMilestoneProfileData — kept for artisan-import compat.)
 */
export function extractMilestoneProfileData(
	events: EventRow[],
	temperatures: TemperatureRow[]
): Record<string, number | null> {
	const milestones: Record<string, number | null> = {};
	const milestoneEvents = events.filter((e) => e.category === 'milestone');

	for (const event of milestoneEvents) {
		switch (event.event_string) {
			case 'charge':
				milestones.charge_time = event.time_seconds;
				break;
			case 'dry_end':
			case 'maillard':
				milestones.dry_end_time = event.time_seconds;
				break;
			case 'fc_start':
				milestones.fc_start_time = event.time_seconds;
				break;
			case 'fc_end':
				milestones.fc_end_time = event.time_seconds;
				break;
			case 'sc_start':
				milestones.sc_start_time = event.time_seconds;
				break;
			case 'drop':
				milestones.drop_time = event.time_seconds;
				break;
			case 'cool':
			case 'end':
				milestones.cool_time = event.time_seconds;
				break;
		}
	}

	function closestTemp(timeSeconds: number | null): number | null {
		if (timeSeconds == null || temperatures.length === 0) return null;
		let best: TemperatureRow | null = null;
		let bestDiff = Infinity;
		for (const t of temperatures) {
			const diff = Math.abs(t.time_seconds - timeSeconds);
			if (diff < bestDiff) {
				bestDiff = diff;
				best = t;
			}
		}
		return best?.bean_temp ?? null;
	}

	milestones.charge_temp = closestTemp(milestones.charge_time ?? null);
	milestones.dry_end_temp = closestTemp(milestones.dry_end_time ?? null);
	milestones.drop_temp = closestTemp(milestones.drop_time ?? null);
	milestones.cool_temp = closestTemp(milestones.cool_time ?? null);

	const chargeTime = milestones.charge_time ?? 0;
	const dropTime = milestones.drop_time ?? milestones.cool_time ?? 0;
	const totalTime = dropTime - chargeTime;

	if (totalTime > 0) {
		const dryEnd = milestones.dry_end_time ?? 0;
		const fcStart = milestones.fc_start_time ?? 0;

		milestones.dry_percent = dryEnd > chargeTime ? ((dryEnd - chargeTime) / totalTime) * 100 : null;
		milestones.maillard_percent =
			fcStart > dryEnd && dryEnd > chargeTime ? ((fcStart - dryEnd) / totalTime) * 100 : null;
		milestones.development_percent =
			fcStart > 0 && dropTime > fcStart ? ((dropTime - fcStart) / totalTime) * 100 : null;
		milestones.total_roast_time = totalTime;
	}

	return milestones;
}

/**
 * Full orchestrator: clear old data, insert temps + events, update profile milestones.
 * (Migrated from roastDataUtils.saveRoastData — kept for artisan-import compat.)
 */
export async function saveRoastData(
	supabase: SupabaseClient,
	roastId: number,
	temperatures: TemperatureRow[],
	events: EventRow[],
	dataSource: 'live' | 'artisan_import'
): Promise<void> {
	// 1. Clear existing data for this source
	await clearRoastData(supabase, roastId, dataSource);

	// 2. Insert temperature data
	if (temperatures.length > 0) {
		console.log(`Inserting ${temperatures.length} temperature points for roast ${roastId}...`);
		await insertTemperatures(supabase, temperatures);
	}

	// 3. Insert event data
	if (events.length > 0) {
		console.log(`Inserting ${events.length} events for roast ${roastId}...`);
		await insertEvents(supabase, events);
	}

	// 4. Update profile with milestone data extracted from events
	const milestoneData = extractMilestoneProfileData(events, temperatures);
	const hasData = Object.values(milestoneData).some((v) => v != null);
	if (hasData) {
		const { error } = await supabase
			.from('roast_profiles')
			.update({
				...milestoneData,
				data_source: dataSource,
				last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
			})
			.eq('roast_id', roastId);

		if (error) {
			console.error('Error updating profile milestones:', error);
			throw error;
		}
	}
}
