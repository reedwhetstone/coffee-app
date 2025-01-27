import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET({ url }) {
	if (!dbConn) {
		throw new Error('Database connection not initialized');
	}

	const query = url.searchParams.get('q')?.toLowerCase() || '';

	if (!query || query.length < 2) {
		return json([]);
	}

	try {
		const greenCoffeeResults = await dbConn.query(
			`SELECT 
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
				LOWER(processing) LIKE $1`,
			[`%${query}%`]
		);

		const roastResults = await dbConn.query(
			`SELECT 
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
				LOWER(roast_notes) LIKE $1`,
			[`%${query}%`]
		);

		const allResults = [...greenCoffeeResults.rows, ...roastResults.rows].slice(0, 10);
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
