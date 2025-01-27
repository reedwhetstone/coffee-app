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

		const { rows } = await dbConn.query(query);
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

		// Convert object to SET clause for PostgreSQL
		const setClause = Object.keys(updateData)
			.map((key, index) => `${key} = $${index + 1}`)
			.join(', ');
		const values = [...Object.values(updateData), id];

		await dbConn.query(`UPDATE sales SET ${setClause} WHERE id = $${values.length}`, values);

		// Fetch updated sale
		const {
			rows: [updatedSale]
		} = await dbConn.query(
			`SELECT s.*, g.name as coffee_name, g.purchase_date
			 FROM sales s
			 LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
			 WHERE s.id = $1`,
			[id]
		);

		return json(updatedSale);
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
}

export async function POST({ request }) {
	if (!dbConn) {
		return json({ error: 'Database connection is not established' }, { status: 500 });
	}

	try {
		const saleData = await request.json();
		const { coffee_name: _, ...insertData } = saleData;

		if (!insertData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		const columns = Object.keys(insertData).join(', ');
		const placeholders = Object.keys(insertData)
			.map((_, index) => `$${index + 1}`)
			.join(', ');
		const values = Object.values(insertData);

		const {
			rows: [result]
		} = await dbConn.query(
			`INSERT INTO sales (${columns}) VALUES (${placeholders}) RETURNING id`,
			values
		);

		// Fetch new sale
		const {
			rows: [newSale]
		} = await dbConn.query(
			`SELECT s.*, g.name as coffee_name, g.purchase_date
			 FROM sales s
			 LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
			 WHERE s.id = $1`,
			[result.id]
		);

		return json(newSale);
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!dbConn) {
		return json({ error: 'Database connection is not established' }, { status: 500 });
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		await dbConn.query('DELETE FROM sales WHERE id = $1', [id]);
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
}
