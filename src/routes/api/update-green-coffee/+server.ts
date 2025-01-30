import { createServerSupabaseClient } from '$lib/supabase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateGreenCoffeeWithCatalogData } from '$lib/server/updateUtils';

export const POST: RequestHandler = async ({ cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	try {
		const result = await updateGreenCoffeeWithCatalogData();
		return json(result);
	} catch (error) {
		console.error('Error in update endpoint:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
