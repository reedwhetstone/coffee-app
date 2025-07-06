import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { coffee_id } = await request.json();
		
		if (!coffee_id) {
			return json({ error: 'coffee_id is required' }, { status: 400 });
		}

		const result = await updateStockedStatus(supabase, coffee_id, user.id);
		
		if (!result.success) {
			return json({ error: result.error }, { status: 500 });
		}

		return json(result);

	} catch (error) {
		console.error('Error updating stocked status:', error);
		return json({ error: 'Failed to update stocked status' }, { status: 500 });
	}
};

// Bulk update function for all user's coffee inventory
export const PUT: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all user's green coffee inventory with roast profiles
		const { data: coffeeData, error: coffeeError } = await supabase
			.from('green_coffee_inv')
			.select(`
				id,
				purchased_qty_lbs,
				stocked,
				roast_profiles(
					oz_in
				)
			`)
			.eq('user', user.id);

		if (coffeeError) {
			return json({ error: 'Error fetching coffee inventory' }, { status: 500 });
		}

		const updates = [];
		
		for (const coffee of coffeeData || []) {
			const totalOzIn = coffee.roast_profiles?.reduce((sum, profile) => sum + (profile.oz_in || 0), 0) || 0;
			const purchasedOz = (coffee.purchased_qty_lbs || 0) * 16;
			const remainingOz = purchasedOz - totalOzIn;
			const shouldBeStocked = remainingOz >= 8;

			// Only update if status needs to change
			if (coffee.stocked !== shouldBeStocked) {
				updates.push({
					id: coffee.id,
					stocked: shouldBeStocked,
					remaining_oz: remainingOz
				});
			}
		}

		// Batch update all changes
		if (updates.length > 0) {
			const { error: updateError } = await supabase
				.from('green_coffee_inv')
				.upsert(
					updates.map(update => ({
						id: update.id,
						stocked: update.stocked
					})),
					{ onConflict: 'id' }
				);

			if (updateError) {
				return json({ error: 'Error updating stocked statuses' }, { status: 500 });
			}
		}

		return json({ 
			success: true, 
			updated_count: updates.length,
			updates: updates
		});

	} catch (error) {
		console.error('Error bulk updating stocked status:', error);
		return json({ error: 'Failed to bulk update stocked status' }, { status: 500 });
	}
};