import type { SupabaseClient } from '@supabase/supabase-js';

interface TemperatureRow {
	roast_id: number;
	time_seconds: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source: string;
}

interface EventRow {
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

const BATCH_SIZE = 100;

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
 * Delete existing roast data for a given roast and data source.
 * For artisan imports, deletes by data_source and specific event categories.
 * For live data, deletes by data_source='live' and user-generated events.
 */
export async function clearRoastData(
	supabase: SupabaseClient,
	roastId: number,
	dataSource: 'live' | 'artisan_import'
): Promise<void> {
	console.log(`Clearing existing ${dataSource} data for roast ${roastId}...`);

	await supabase
		.from('roast_temperatures')
		.delete()
		.eq('roast_id', roastId)
		.eq('data_source', dataSource);

	if (dataSource === 'artisan_import') {
		await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', roastId)
			.in('category', ['milestone', 'control', 'machine']);
	} else {
		// For live data, clear all user-generated events
		await supabase.from('roast_events').delete().eq('roast_id', roastId);
	}
}

/**
 * Extract milestone profile data from events and compute phase percentages.
 * Returns an object suitable for updating roast_profiles milestone columns.
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

	// Find closest temperature for each milestone
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

	// Calculate phase percentages
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
	// Only update if we have milestone data
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
