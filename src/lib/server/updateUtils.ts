import { supabase } from '$lib/auth/supabase';
import type { Database } from '../types/database.types';

export async function updateGreenCoffeeWithCatalogData() {
	if (!supabase) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const { data, error } = (await supabase.rpc('update_green_coffee_from_catalog')) as {
			data: Database['public']['Tables']['green_coffee_inv']['Row'][] | null;
			error: Error | null;
		};

		if (error) throw error;

		console.log('Update complete:', data);
		return { success: true, result: data };
	} catch (error) {
		console.error('Error updating green coffee inventory:', error);
		throw error;
	}
}
