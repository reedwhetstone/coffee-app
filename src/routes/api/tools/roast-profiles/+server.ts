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
	limit?: number;
	include_calculations?: boolean;
}

// Tool response interface
interface RoastProfilesToolResponse {
	profiles: any[];
	total: number;
	summary?: {
		avg_development_percent: number;
		avg_fc_start_temp: number;
		avg_drop_temp: number;
		total_roasts: number;
	};
	filters_applied: RoastProfilesToolInput;
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
			limit = 20,
			include_calculations = true
		} = input;

		// If catalog_id is provided instead of coffee_id, convert it
		let finalCoffeeId = coffee_id;
		if (catalog_id && !coffee_id) {
			// Find green_coffee_inv.id(s) that match this catalog_id for this user
			const { data: inventoryItems } = await supabase
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

		// Build base query for roast profiles
		let query = supabase
			.from('roast_profiles')
			.select(
				`
				*,
				green_coffee_inv!coffee_id (
					id,
					notes,
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

		// Order by most recent first and apply limit
		query = query.order('roast_date', { ascending: false });

		if (limit > 0) {
			query = query.limit(limit);
		}

		const { data: profiles, error } = await query;

		if (error) {
			console.error('Roast profiles tool error:', error);
			return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
		}

		let summary;
		if (include_calculations && profiles && profiles.length > 0) {
			// Calculate summary statistics
			const validProfiles = profiles.filter(
				(p) => p.development_percent !== null && p.fc_start_temp !== null && p.drop_temp !== null
			);

			if (validProfiles.length > 0) {
				summary = {
					avg_development_percent:
						validProfiles.reduce((sum, p) => sum + (p.development_percent || 0), 0) /
						validProfiles.length,
					avg_fc_start_temp:
						validProfiles.reduce((sum, p) => sum + (p.fc_start_temp || 0), 0) /
						validProfiles.length,
					avg_drop_temp:
						validProfiles.reduce((sum, p) => sum + (p.drop_temp || 0), 0) / validProfiles.length,
					total_roasts: profiles.length
				};
			}
		}

		// Clean up the response for better LLM consumption
		const cleanProfiles =
			profiles?.map((profile) => ({
				roast_id: profile.roast_id,
				roast_name: profile.roast_name,
				batch_name: profile.batch_name,
				roast_date: profile.roast_date,
				coffee_name: profile.green_coffee_inv?.coffee_catalog?.name,
				coffee_processing: profile.green_coffee_inv?.coffee_catalog?.processing,
				coffee_region: profile.green_coffee_inv?.coffee_catalog?.region,
				coffee_variety: profile.green_coffee_inv?.coffee_catalog?.cultivar_detail,
				// Roast metrics
				oz_in: profile.oz_in,
				oz_out: profile.oz_out,
				fc_start_time: profile.fc_start_time,
				development_percent: profile.development_percent,
				total_roast_time: profile.total_roast_time,
				drop_temp: profile.drop_temp,
				fc_start_temp: profile.fc_start_temp,
				charge_temp: profile.charge_temp,
				// User notes
				roast_notes: profile.roast_notes,
				user_notes: profile.green_coffee_inv?.notes
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
				limit,
				include_calculations
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
