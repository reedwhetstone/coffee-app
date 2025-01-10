// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader, RowDataPacket, QueryResult } from 'mysql2';

export async function GET({ url }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		let query = 'SELECT * FROM green_coffee_inv';
		let values = [];

		if (id) {
			query += ' WHERE id = ?';
			values.push(id);
		}

		const [rows] = await dbConn.query(query, values);
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

		const [newBean] = (await dbConn.query('SELECT * FROM green_coffee_inv WHERE id = ?', [
			result.insertId
		])) as [RowDataPacket[], any];
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
		// Start a transaction
		await dbConn.beginTransaction();

		try {
			// First, get all roast_ids associated with this coffee
			const [roastProfiles] = (await dbConn.query(
				'SELECT roast_id FROM roast_profiles WHERE coffee_id = ?',
				[id]
			)) as [RowDataPacket[], any];

			// Delete associated profile logs
			if ((roastProfiles as RowDataPacket[]).length > 0) {
				const roastIds = (roastProfiles as RowDataPacket[]).map((profile: any) => profile.roast_id);
				await dbConn.query('DELETE FROM profile_log WHERE roast_id IN (?)', [roastIds]);
			}

			// Delete roast profiles
			await dbConn.query('DELETE FROM roast_profiles WHERE coffee_id = ?', [id]);

			// Finally, delete the coffee
			await dbConn.query('DELETE FROM green_coffee_inv WHERE id = ?', [id]);

			// Commit the transaction
			await dbConn.commit();

			return json({ success: true });
		} catch (error) {
			// If anything fails, roll back the transaction
			await dbConn.rollback();
			throw error;
		}
	} catch (error) {
		console.error('Error deleting bean and associated data:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!dbConn) {
		return new Response(JSON.stringify({ error: 'Database connection is not established' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { id: _, ...updateData } = updates;

		await dbConn.query('UPDATE green_coffee_inv SET ? WHERE id = ?', [updateData, id]);

		// Fetch and return the updated bean
		const [updatedBean] = (await dbConn.query('SELECT * FROM green_coffee_inv WHERE id = ?', [
			id
		])) as [RowDataPacket[], any];

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
