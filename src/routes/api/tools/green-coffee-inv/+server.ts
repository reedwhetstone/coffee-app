import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Interface for tool input validation
interface GreenCoffeeInvToolInput {
	stocked_only?: boolean;
	include_catalog_details?: boolean;
	include_roast_summary?: boolean;
	limit?: number;
}

// Tool response interface
// Interface for inventory item
interface InventoryItem {
	id: number;
	name?: string;
	purchased_qty_lbs?: number | null;
	bean_cost?: number | null;
	tax_ship_cost?: number | null;
	stocked: boolean;
	coffee_catalog?: {
		name?: string;
		[key: string]: unknown;
	} | null;
	roast_summary?: {
		total_roasts: number;
		total_oz_in: number;
		total_oz_out: number;
	};
	coffee_name?: string;
	[key: string]: unknown;
}

interface GreenCoffeeInvToolResponse {
	inventory: InventoryItem[];
	total: number;
	summary: {
		total_beans: number;
		total_weight_lbs: number;
		total_value: number;
		stocked_beans: number;
	};
	filters_applied: GreenCoffeeInvToolInput;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: GreenCoffeeInvToolInput = await event.request.json();

		// Default parameters
		const {
			stocked_only = true,
			include_catalog_details = true,
			include_roast_summary = true,
			limit = 15
		} = input;

		// Build base query similar to existing /data endpoint
		let query = supabase
			.from('green_coffee_inv')
			.select(
				`
			*,
			coffee_catalog!catalog_id (
				name,
				score_value,
				arrival_date,
				region,
				processing,
				drying_method,
				lot_size,
				bag_size,
				packaging,
				cultivar_detail,
				grade,
				appearance,
				roast_recs,
				type,
				description_short,
				description_long,
				farm_notes,
				link,
				cost_lb,
				source,
				stocked,
				cupping_notes,
				stocked_date,
				unstocked_date,
				ai_description,
				ai_tasting_notes,
				public_coffee
			)
		`
			)
			.eq('user', user.id)
			.order('purchase_date', { ascending: false });

		// Apply stocked filter - default to stocked inventory unless explicitly disabled
		// This focuses on currently available beans for roasting
		if (stocked_only !== false) {
			query = query.eq('stocked', true);
		}

		// Apply limit - enforce maximum of 15 items
		const finalLimit = Math.min(limit || 15, 15);
		if (finalLimit > 0) {
			query = query.limit(finalLimit);
		}

		const { data: inventoryData, error } = await query;
		const inventory = inventoryData as unknown as InventoryItem[] | null;

		if (error) {
			console.error('Green coffee inventory tool error:', error);
			return json({ error: 'Failed to fetch inventory' }, { status: 500 });
		}

		// Calculate summary statistics
		const summary = {
			total_beans: inventory?.length || 0,
			total_weight_lbs:
				inventory?.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0) || 0,
			total_value:
				inventory?.reduce((sum, bean) => {
					const beanCost = bean.bean_cost || 0;
					const taxShipCost = bean.tax_ship_cost || 0;
					return sum + beanCost + taxShipCost;
				}, 0) || 0,
			stocked_beans: inventory?.filter((bean) => bean.stocked).length || 0
		};

		// If roast summary is requested, get roast profile counts
		let processedInventory = inventory || [];
		if (include_roast_summary && inventory) {
			const coffeeIds = inventory.map((bean) => bean.id);

			if (coffeeIds.length > 0) {
				const { data: roastProfiles } = (await supabase
					.from('roast_profiles')
					.select('coffee_id, oz_in, oz_out, roast_id, batch_name, roast_date')
					.in('coffee_id', coffeeIds)
					.eq('user', user.id)) as {
					data: Array<{
						coffee_id: number;
						oz_in: number | null;
						oz_out: number | null;
						roast_id: number;
						batch_name: string;
						roast_date: string;
					}> | null;
				};

				// Add roast summary to each inventory item
				processedInventory = inventory.map((bean) => ({
					...bean,
					roast_summary: {
						total_roasts:
							roastProfiles?.filter((profile) => profile.coffee_id === bean.id).length || 0,
						total_oz_in:
							roastProfiles
								?.filter((profile) => profile.coffee_id === bean.id)
								.reduce((sum, profile) => sum + (profile.oz_in || 0), 0) || 0,
						total_oz_out:
							roastProfiles
								?.filter((profile) => profile.coffee_id === bean.id)
								.reduce((sum, profile) => sum + (profile.oz_out || 0), 0) || 0
					}
				}));
			}
		}

		// Clean up catalog data if not requested
		if (!include_catalog_details) {
			processedInventory = processedInventory.map((bean) => {
				const { coffee_catalog, ...beanWithoutCatalog } = bean;
				return {
					...beanWithoutCatalog,
					coffee_name: coffee_catalog?.name || 'Unknown'
				};
			});
		}

		const response: GreenCoffeeInvToolResponse = {
			inventory: processedInventory,
			total: processedInventory.length,
			summary,
			filters_applied: {
				stocked_only,
				include_catalog_details,
				include_roast_summary,
				limit: finalLimit
			}
		};

		return json(response);
	} catch (error) {
		console.error('Green coffee inventory tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
