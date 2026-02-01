import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Interface for tool input validation
interface RoastProfilesToolInput {
	roast_id?: string;
	roast_name?: string;
	batch_name?: string;
	coffee_id?: number; // green_coffee_inv.id
	catalog_id?: number; // coffee_catalog.id - will be converted to coffee_id
	roast_date_start?: string; // Date range filtering start (YYYY-MM-DD)
	roast_date_end?: string; // Date range filtering end (YYYY-MM-DD)
	limit?: number;
	include_calculations?: boolean;
	stocked_only?: boolean; // Filter to only show roasts for currently stocked coffee
}

// Tool response interface
interface RoastProfilesToolResponse {
	profiles: Record<string, unknown>[];
	total: number;
	summary?: {
		total_roasts: number;
		avg_total_roast_time: number | null;
		avg_charge_time: number | null;
		avg_fc_start_time: number | null;
		avg_drop_time: number | null;
		avg_charge_temp: number | null;
		avg_fc_start_temp: number | null;
		avg_drop_temp: number | null;
		temp_consistency_fc_start: number | null;
		temp_consistency_drop: number | null;
		avg_development_percent: number | null;
		avg_dry_percent: number | null;
		avg_maillard_percent: number | null;
		development_consistency: number | null;
		avg_weight_loss_percent: number | null;
		avg_total_ror: number | null;
		avg_dry_phase_ror: number | null;
		avg_mid_phase_ror: number | null;
		avg_finish_phase_ror: number | null;
		ror_consistency: number | null;
		avg_auc: number | null;
		avg_tp_time: number | null;
		avg_tp_temp: number | null;
		avg_dry_phase_delta_temp: number | null;
		roaster_types_used: string[];
		data_sources_used: string[];
		date_range_start: string;
		date_range_end: string;
	};
	filters_applied: RoastProfilesToolInput;
}

// Interface for DB row to fix 'never' inference
interface RoastProfileRow {
	roast_id: string;
	batch_name: string;
	coffee_id: number;
	coffee_name: string;
	roast_date: string;
	oz_in: number | null;
	oz_out: number | null;
	roast_notes: string | null;
	roast_targets: unknown;
	last_updated: string;
	user: string;
	roaster_type: string | null;
	roaster_size: string | null;
	roast_uuid: string | null;
	temperature_unit: string | null;
	charge_time: number | null;
	dry_end_time: number | null;
	fc_start_time: number | null;
	fc_end_time: number | null;
	sc_start_time: number | null;
	drop_time: number | null;
	cool_time: number | null;
	charge_temp: number | null;
	dry_end_temp: number | null;
	fc_start_temp: number | null;
	fc_end_temp: number | null;
	sc_start_temp: number | null;
	drop_temp: number | null;
	cool_temp: number | null;
	dry_percent: number | null;
	maillard_percent: number | null;
	development_percent: number | null;
	total_roast_time: number | null;
	data_source: string | null;
	chart_z_max: number | null;
	chart_z_min: number | null;
	chart_y_max: number | null;
	chart_y_min: number | null;
	chart_x_max: number | null;
	chart_x_min: number | null;
	tp_time: number | null;
	tp_temp: number | null;
	dry_phase_ror: number | null;
	mid_phase_ror: number | null;
	finish_phase_ror: number | null;
	total_ror: number | null;
	auc: number | null;
	weight_loss_percent: number | null;
	dry_phase_delta_temp: number | null;
	green_coffee_inv: {
		id: number;
		notes: string | null;
		stocked: boolean;
		coffee_catalog: {
			name: string;
			processing: string | null;
			region: string | null;
			cultivar_detail: string | null;
		} | null;
	} | null;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: RoastProfilesToolInput = await event.request.json();

		// Default parameters
		const {
			roast_id,
			roast_name,
			batch_name,
			coffee_id,
			catalog_id,
			roast_date_start,
			roast_date_end,
			limit = 10,
			include_calculations = true,
			stocked_only = true
		} = input;

		// If catalog_id is provided instead of coffee_id, convert it
		let finalCoffeeId = coffee_id;
		if (catalog_id && !coffee_id) {
			// Find green_coffee_inv.id(s) that match this catalog_id for this user
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { data: inventoryItems } = await (supabase as any)
				.from('green_coffee_inv')
				.select('id')
				.eq('catalog_id', catalog_id)
				.eq('user', user.id);

			if (inventoryItems && inventoryItems.length > 0) {
				// For now, use the first matching inventory item
				// In the future, we might want to return roasts for all matching inventory items
				finalCoffeeId = inventoryItems[0].id;
			}
		}

		// Build base query for roast profiles - select all fields explicitly
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let query = (supabase as any)
			.from('roast_profiles')
			.select(
				`
				roast_id,
				batch_name,
				coffee_id,
				coffee_name,
				roast_date,
				oz_in,
				oz_out,
				roast_notes,
				roast_targets,
				last_updated,
				user,
				roaster_type,
				roaster_size,
				roast_uuid,
				temperature_unit,
				charge_time,
				dry_end_time,
				fc_start_time,
				fc_end_time,
				sc_start_time,
				drop_time,
				cool_time,
				charge_temp,
				dry_end_temp,
				fc_start_temp,
				fc_end_temp,
				sc_start_temp,
				drop_temp,
				cool_temp,
				dry_percent,
				maillard_percent,
				development_percent,
				total_roast_time,
				data_source,
				chart_z_max,
				chart_z_min,
				chart_y_max,
				chart_y_min,
				chart_x_max,
				chart_x_min,
				tp_time,
				tp_temp,
				dry_phase_ror,
				mid_phase_ror,
				finish_phase_ror,
				total_ror,
				auc,
				weight_loss_percent,
				dry_phase_delta_temp,
				green_coffee_inv!coffee_id (
					id,
					notes,
					stocked,
					coffee_catalog!catalog_id (
						name,
						processing,
						region,
						cultivar_detail
					)
				)
			`
			)
			.eq('user', user.id);

		// Apply stocked filter - default to only show roasts for currently stocked coffee
		// This focuses on actionable roasting data for available inventory
		if (stocked_only !== false) {
			query = query.eq('green_coffee_inv.stocked', true);
		}

		// Apply filters
		if (roast_id) {
			query = query.eq('roast_id', roast_id);
		}

		if (roast_name) {
			query = query.ilike('roast_name', `%${roast_name}%`);
		}

		if (batch_name) {
			query = query.ilike('batch_name', `%${batch_name}%`);
		}

		if (finalCoffeeId) {
			query = query.eq('coffee_id', finalCoffeeId);
		}

		// Apply date range filters
		if (roast_date_start) {
			query = query.gte('roast_date', roast_date_start);
		}

		if (roast_date_end) {
			query = query.lte('roast_date', roast_date_end);
		}

		// Order by most recent first and apply limit - enforce maximum of 15 items
		query = query.order('roast_date', { ascending: false });

		const finalLimit = Math.min(limit || 10, 15);
		if (finalLimit > 0) {
			query = query.limit(finalLimit);
		}

		const { data: profiles, error } = (await query) as {
			data: RoastProfileRow[] | null;
			error: unknown;
		};

		if (error) {
			console.error('Roast profiles tool error:', error);
			return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
		}

		let summary;
		if (include_calculations && profiles && profiles.length > 0) {
			// Calculate comprehensive summary statistics
			const validProfiles = profiles.filter((p) => p.total_roast_time !== null);
			const tempValidProfiles = profiles.filter(
				(p) => p.fc_start_temp !== null && p.drop_temp !== null
			);
			const phaseValidProfiles = profiles.filter((p) => p.development_percent !== null);
			// const weightValidProfiles = profiles.filter((p) => p.oz_in !== null && p.oz_out !== null);

			if (validProfiles.length > 0) {
				// Helper function to calculate average safely
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const safeAvg = (profiles: any[], field: string) => {
					const validValues = profiles.filter(
						(p) => p[field] !== null && p[field] !== undefined && p[field] !== 0
					);
					return validValues.length > 0
						? validValues.reduce((sum, p) => sum + p[field], 0) / validValues.length
						: null;
				};

				// Helper function to calculate standard deviation
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const safeStdDev = (profiles: any[], field: string) => {
					const validValues = profiles.filter(
						(p) => p[field] !== null && p[field] !== undefined && p[field] !== 0
					);
					if (validValues.length < 2) return null;
					const avg = safeAvg(validValues, field);
					if (avg === null) return null;
					const variance =
						validValues.reduce((sum, p) => sum + Math.pow(p[field] - avg, 2), 0) /
						validValues.length;
					return Math.sqrt(variance);
				};

				summary = {
					// Basic counts
					total_roasts: profiles.length,

					// Timing analysis
					avg_total_roast_time: safeAvg(validProfiles, 'total_roast_time'),
					avg_charge_time: safeAvg(profiles, 'charge_time'),
					avg_fc_start_time: safeAvg(profiles, 'fc_start_time'),
					avg_drop_time: safeAvg(profiles, 'drop_time'),

					// Temperature analysis
					avg_charge_temp: safeAvg(tempValidProfiles, 'charge_temp'),
					avg_fc_start_temp: safeAvg(tempValidProfiles, 'fc_start_temp'),
					avg_drop_temp: safeAvg(tempValidProfiles, 'drop_temp'),
					temp_consistency_fc_start: safeStdDev(tempValidProfiles, 'fc_start_temp'),
					temp_consistency_drop: safeStdDev(tempValidProfiles, 'drop_temp'),

					// Phase percentages analysis
					avg_development_percent: safeAvg(phaseValidProfiles, 'development_percent'),
					avg_dry_percent: safeAvg(profiles, 'dry_percent'),
					avg_maillard_percent: safeAvg(profiles, 'maillard_percent'),
					development_consistency: safeStdDev(phaseValidProfiles, 'development_percent'),

					// Weight loss analysis (using pre-calculated database values)
					avg_weight_loss_percent: safeAvg(profiles, 'weight_loss_percent'),

					// Computed roast analytics
					avg_total_ror: safeAvg(profiles, 'total_ror'),
					avg_dry_phase_ror: safeAvg(profiles, 'dry_phase_ror'),
					avg_mid_phase_ror: safeAvg(profiles, 'mid_phase_ror'),
					avg_finish_phase_ror: safeAvg(profiles, 'finish_phase_ror'),
					ror_consistency: safeStdDev(profiles, 'total_ror'),
					avg_auc: safeAvg(profiles, 'auc'),
					avg_tp_time: safeAvg(profiles, 'tp_time'),
					avg_tp_temp: safeAvg(profiles, 'tp_temp'),
					avg_dry_phase_delta_temp: safeAvg(profiles, 'dry_phase_delta_temp'),

					// Equipment usage
					roaster_types_used: [
						...new Set(profiles.filter((p) => p.roaster_type).map((p) => p.roaster_type as string))
					],
					data_sources_used: [
						...new Set(profiles.filter((p) => p.data_source).map((p) => p.data_source as string))
					],

					// Date range
					date_range_start: profiles.reduce(
						(earliest, p) => (p.roast_date < earliest ? p.roast_date : earliest),
						profiles[0]?.roast_date
					),
					date_range_end: profiles.reduce(
						(latest, p) => (p.roast_date > latest ? p.roast_date : latest),
						profiles[0]?.roast_date
					)
				};
			}
		}

		// Clean up the response for better LLM consumption - include ALL roast profile fields
		const cleanProfiles =
			profiles?.map((profile) => ({
				// Basic roast information
				roast_id: profile.roast_id,
				batch_name: profile.batch_name,
				coffee_name: profile.coffee_name,
				roast_date: profile.roast_date,
				last_updated: profile.last_updated,
				user: profile.user,

				// Coffee catalog information (from join)
				coffee_catalog_name:
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(profile.green_coffee_inv as any)?.coffee_catalog?.name ||
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(Array.isArray((profile.green_coffee_inv as any)?.coffee_catalog)
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							(profile.green_coffee_inv as any)?.coffee_catalog[0]?.name
						: null),
				coffee_processing:
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(profile.green_coffee_inv as any)?.coffee_catalog?.processing ||
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(Array.isArray((profile.green_coffee_inv as any)?.coffee_catalog)
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							(profile.green_coffee_inv as any)?.coffee_catalog[0]?.processing
						: null),
				coffee_region:
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(profile.green_coffee_inv as any)?.coffee_catalog?.region ||
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(Array.isArray((profile.green_coffee_inv as any)?.coffee_catalog)
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							(profile.green_coffee_inv as any)?.coffee_catalog[0]?.region
						: null),
				coffee_variety:
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(profile.green_coffee_inv as any)?.coffee_catalog?.cultivar_detail ||
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(Array.isArray((profile.green_coffee_inv as any)?.coffee_catalog)
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							(profile.green_coffee_inv as any)?.coffee_catalog[0]?.cultivar_detail
						: null),

				// Roaster equipment information
				roaster_type: profile.roaster_type,
				roaster_size: profile.roaster_size,
				roast_uuid: profile.roast_uuid,
				temperature_unit: profile.temperature_unit,
				data_source: profile.data_source,

				// Weight measurements
				oz_in: profile.oz_in,
				oz_out: profile.oz_out,

				// Timing milestones
				charge_time: profile.charge_time,
				dry_end_time: profile.dry_end_time,
				fc_start_time: profile.fc_start_time,
				fc_end_time: profile.fc_end_time,
				sc_start_time: profile.sc_start_time,
				drop_time: profile.drop_time,
				cool_time: profile.cool_time,
				total_roast_time: profile.total_roast_time,

				// Temperature milestones
				charge_temp: profile.charge_temp,
				dry_end_temp: profile.dry_end_temp,
				fc_start_temp: profile.fc_start_temp,
				fc_end_temp: profile.fc_end_temp,
				sc_start_temp: profile.sc_start_temp,
				drop_temp: profile.drop_temp,
				cool_temp: profile.cool_temp,

				// Roasting phase percentages
				dry_percent: profile.dry_percent,
				maillard_percent: profile.maillard_percent,
				development_percent: profile.development_percent,

				// Chart configuration
				chart_z_max: profile.chart_z_max,
				chart_z_min: profile.chart_z_min,
				chart_y_max: profile.chart_y_max,
				chart_y_min: profile.chart_y_min,
				chart_x_max: profile.chart_x_max,
				chart_x_min: profile.chart_x_min,

				// Computed roast analytics
				tp_time: profile.tp_time,
				tp_temp: profile.tp_temp,
				dry_phase_ror: profile.dry_phase_ror,
				mid_phase_ror: profile.mid_phase_ror,
				finish_phase_ror: profile.finish_phase_ror,
				total_ror: profile.total_ror,
				auc: profile.auc,
				weight_loss_percent: profile.weight_loss_percent,
				dry_phase_delta_temp: profile.dry_phase_delta_temp,

				// Notes and targets
				roast_notes: profile.roast_notes,
				roast_targets: profile.roast_targets,
				user_notes: Array.isArray(profile.green_coffee_inv)
					? // eslint-disable-next-line @typescript-eslint/no-explicit-any
						(profile.green_coffee_inv as any)[0]?.notes
					: // eslint-disable-next-line @typescript-eslint/no-explicit-any
						(profile.green_coffee_inv as any)?.notes
			})) || [];

		const response: RoastProfilesToolResponse = {
			profiles: cleanProfiles,
			total: cleanProfiles.length,
			summary,
			filters_applied: {
				roast_id,
				roast_name,
				batch_name,
				coffee_id: finalCoffeeId,
				catalog_id,
				roast_date_start,
				roast_date_end,
				limit: finalLimit,
				include_calculations,
				stocked_only
			}
		};

		return json(response);
	} catch (error) {
		console.error('Roast profiles tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
