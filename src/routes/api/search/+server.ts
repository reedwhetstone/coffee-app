import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized');
	}

	const query = url.searchParams.get('q')?.toLowerCase() || '';

	if (!query || query.length < 2) {
		return json([]);
	}

	try {
		// Query for green coffee results
		const { data: greenCoffeeResults, error: greenError } = await supabase.rpc('run_query', {
			query_text: `
				SELECT 
					id,
					name as title,
					CONCAT('Green Coffee - ', region) as description,
					'/' as url,
					'green' as type,
					id as item_id
				FROM green_coffee_inv 
				WHERE 
					LOWER(name) LIKE $1 OR 
					LOWER(region) LIKE $1 OR 
					LOWER(processing) LIKE $1
			`,
			query_params: [`%${query}%`]
		});

		if (greenError) throw greenError;

		// Query for roast profile results
		const { data: roastResults, error: roastError } = await supabase.rpc('run_query', {
			query_text: `
				SELECT 
					roast_id as id,
					CONCAT(coffee_name, ' - ', batch_name) as title,
					'Roast Profile' as description,
					'/ROAST' as url,
					'roast' as type,
					roast_id as item_id
				FROM roast_profiles 
				WHERE 
					LOWER(coffee_name) LIKE $1 OR 
					LOWER(batch_name) LIKE $1 OR 
					LOWER(roast_notes) LIKE $1
			`,
			query_params: [`%${query}%`]
		});

		if (roastError) throw roastError;

		const allResults = [...(greenCoffeeResults || []), ...(roastResults || [])].slice(0, 10);
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
