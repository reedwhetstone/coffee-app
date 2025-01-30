import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateGreenCoffeeWithCatalogData } from '$lib/server/updateUtils';

export const POST: RequestHandler = async ({ locals: { supabase } }) => {
	try {
		const result = await updateGreenCoffeeWithCatalogData(supabase);
		return json(result);
	} catch (error) {
		console.error('Error in update endpoint:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
