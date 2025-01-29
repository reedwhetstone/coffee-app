import { json } from '@sveltejs/kit';
import { updateGreenCoffeeWithCatalogData } from '$lib/server/updateUtils';
import { supabase } from '$lib/auth/supabase';

export async function POST() {
	if (!supabase) {
		console.error('Supabase client check failed:', supabase);
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const result = await updateGreenCoffeeWithCatalogData();
		return json(result);
	} catch (error) {
		console.error('Error in update endpoint:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}
