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

		const [rows] = await (dbConn as any).query(
			'SELECT * FROM coffee_catalog ORDER BY arrival_date DESC'
		);
		// console.log('Fetched rows:', rows);
		return { data: rows };
	} catch (err) {
		console.error('Database error:', err);
		throw error(500, 'Failed to fetch coffee data');
	}
}
