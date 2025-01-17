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

export async function PUT({ url, request }) {
	if (!dbConn) {
		return json({ error: 'Database connection is not established' }, { status: 500 });
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const updates = await request.json();
		const { coffee_name: _, ...updateData } = updates;

		if (!updateData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		await dbConn.query('UPDATE sales SET ? WHERE id = ?', [updateData, id]);

		// Fetch and return the updated sale with joined coffee_name
		const [updatedSale] = await dbConn.query(
			`SELECT s.*, g.name as coffee_name, g.purchase_date
			 FROM sales s
			 LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
			 WHERE s.id = ?`,
			[id]
		);

		return json(updatedSale[0]);
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
}
