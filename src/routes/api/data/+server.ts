// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader } from 'mysql2';

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

export async function POST({ request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const bean = await request.json();

		const query = `
			INSERT INTO green_coffee_inv (
				name, 
				\`rank\`,
				notes, 
				purchase_date, 
				purchased_qty_lbs, 
				bean_cost, 
				tax_ship_cost, 
				link,
				last_updated
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;

		const values = [
			bean.name,
			bean.rank,
			bean.notes,
			bean.purchase_date,
			bean.purchased_qty_lbs,
			bean.bean_cost,
			bean.tax_ship_cost,
			bean.link,
			bean.last_updated
		];

		const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];

		const [newBean] = await dbConn.query('SELECT * FROM green_coffee_inv WHERE id = ?', [
			result.insertId
		]);
		return json(newBean[0]);
	} catch (error) {
		console.error('Error creating bean:', error);
		return json({ success: false, error: 'Failed to create bean' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	const id = url.searchParams.get('id');

	if (!id) {
		return json({ success: false, error: 'No ID provided' }, { status: 400 });
	}

	try {
		const [result] = await dbConn.execute('DELETE FROM green_coffee_inv WHERE id = ?', [id]);
		return json({ success: true, data: result });
	} catch (error) {
		console.error('Error deleting bean:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { id: _, ...updateData } = updates;

		await dbConn.query('UPDATE green_coffee_inv SET ? WHERE id = ?', [updateData, id]);

		// Fetch and return the updated bean
		const [updatedBean] = await dbConn.query('SELECT * FROM green_coffee_inv WHERE id = ?', [id]);

		return new Response(JSON.stringify(updatedBean[0]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating bean:', error);
		return new Response(JSON.stringify({ error: 'Failed to update bean' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
