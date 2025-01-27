import { dbConn } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export async function load() {
	try {
		// Wait for connection to be established
		await new Promise((resolve) => {
			const checkConnection = () => {
				if (dbConn) {
					resolve(true);
				} else {
					setTimeout(checkConnection, 100);
				}
			};
			checkConnection();
		});

		const result = await dbConn.query('SELECT * FROM coffee_catalog ORDER BY arrival_date DESC');
		return { data: result.rows };
	} catch (err) {
		console.error('Database error:', err);
		throw error(500, 'Failed to fetch coffee data');
	}
}
