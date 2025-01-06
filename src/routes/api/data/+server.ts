// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const [rows] = await dbConn.query('SELECT * FROM green_coffee_inv');
		return json({ data: rows });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch data' });
	}
}
