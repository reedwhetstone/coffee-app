import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { getInventoryWithRoastSummary } from '$lib/data/inventory.js';

// Interface for tool input validation
interface GreenCoffeeInvToolInput {
	stocked_only?: boolean;
	include_catalog_details?: boolean;
	include_roast_summary?: boolean;
	limit?: number;
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

		const finalLimit = Math.min(limit || 15, 15);

		const inventory = await getInventoryWithRoastSummary(supabase, user.id, {
			stockedOnly: stocked_only,
			includeCatalogDetails: include_catalog_details,
			includeRoastSummary: include_roast_summary,
			limit: finalLimit
		});

		// Calculate summary statistics
		const summary = {
			total_beans: inventory.length,
			total_weight_lbs: inventory.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0),
			total_value: inventory.reduce((sum, bean) => {
				const beanCost = bean.bean_cost || 0;
				const taxShipCost = bean.tax_ship_cost || 0;
				return sum + beanCost + taxShipCost;
			}, 0),
			stocked_beans: inventory.filter((bean) => bean.stocked).length
		};

		return json({
			inventory,
			total: inventory.length,
			summary,
			filters_applied: {
				stocked_only,
				include_catalog_details,
				include_roast_summary,
				limit: finalLimit
			}
		});
	} catch (error) {
		console.error('Green coffee inventory tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
