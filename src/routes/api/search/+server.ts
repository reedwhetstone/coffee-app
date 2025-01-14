import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

export async function GET({ url }) {
	const query = url.searchParams.get('q')?.toLowerCase() || '';

	if (!query || query.length < 2) {
		return json([]);
	}

	try {
		const [greenCoffeeResults] = await dbConn.query(
			`SELECT 
				id,
				name as title,
				CONCAT('Green Coffee - ', region) as description,
				'/' as url,
				'green' as type,
				id as item_id
			FROM green_coffee_inv 
			WHERE 
				LOWER(name) LIKE ? OR 
				LOWER(region) LIKE ? OR 
				LOWER(processing) LIKE ?`,
			[`%${query}%`, `%${query}%`, `%${query}%`]
		);

		const [roastResults] = await dbConn.query(
			`SELECT 
				roast_id as id,
				CONCAT(coffee_name, ' - ', batch_name) as title,
				'Roast Profile' as description,
				'/ROAST' as url,
				'roast' as type,
				roast_id as item_id
			FROM roast_profiles 
			WHERE 
				LOWER(coffee_name) LIKE ? OR 
				LOWER(batch_name) LIKE ? OR 
				LOWER(roast_notes) LIKE ?`,
			[`%${query}%`, `%${query}%`, `%${query}%`]
		);

		const allResults = [...greenCoffeeResults, ...roastResults].slice(0, 10);
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
