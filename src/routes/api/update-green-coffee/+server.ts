import { json } from '@sveltejs/kit';
import { updateGreenCoffeeWithCatalogData } from '$lib/server/updateUtils';

export async function POST() {
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
