import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const query = `
            SELECT 
                s.*,
                g.name as coffee_name,
                g.purchase_date
            FROM sales s
            LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
            
            ORDER BY s.sell_date DESC
        `;

		const [rows] = await dbConn.query(query);
		return json(rows);
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch sales data' });
	}
}
