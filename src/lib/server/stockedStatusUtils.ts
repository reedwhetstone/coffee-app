// Utility function to update stocked status based on remaining quantity
export async function updateStockedStatus(supabase: any, coffee_id: number, user_id: string) {
	try {
		// Get the green coffee inventory record
		const { data: coffee, error: coffeeError } = await supabase
			.from('green_coffee_inv')
			.select('id, purchased_qty_lbs')
			.eq('id', coffee_id)
			.eq('user', user_id)
			.single();

		if (coffeeError || !coffee) {
			console.error('Coffee not found for stocked status update:', coffee_id);
			return { success: false, error: 'Coffee not found' };
		}

		// Calculate total roasted quantity
		const { data: roastProfiles, error: roastError } = await supabase
			.from('roast_profiles')
			.select('oz_in')
			.eq('coffee_id', coffee_id)
			.eq('user', user_id);

		if (roastError) {
			console.error('Error fetching roast profiles for stocked status update:', roastError);
			return { success: false, error: 'Error fetching roast profiles' };
		}

		// Calculate remaining quantity
		const totalOzIn =
			roastProfiles?.reduce((sum: number, profile: any) => sum + (profile.oz_in || 0), 0) || 0;
		const purchasedOz = (coffee.purchased_qty_lbs || 0) * 16;
		const remainingOz = purchasedOz - totalOzIn;

		// Update stocked status if remaining quantity is below 4 oz
		const shouldBeStocked = remainingOz >= 4;

		const { error: updateError } = await supabase
			.from('green_coffee_inv')
			.update({ stocked: shouldBeStocked })
			.eq('id', coffee_id)
			.eq('user', user_id);

		if (updateError) {
			console.error('Error updating stocked status:', updateError);
			return { success: false, error: 'Error updating stocked status' };
		}

		return {
			success: true,
			coffee_id,
			remaining_oz: remainingOz,
			stocked: shouldBeStocked
		};
	} catch (error) {
		console.error('Error in updateStockedStatus:', error);
		return { success: false, error: 'Unexpected error' };
	}
}
