// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET({ url }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		let query = 'SELECT * FROM green_coffee_inv';
		let values = [];

		if (id) {
			query += ' WHERE id = $1';
			values.push(id);
		}

		const { rows } = await dbConn.query(query, values);
		const formattedRows = rows.map((row) => ({
			...row,
			purchase_date: row.purchase_date ? row.purchase_date.toISOString().split('T')[0] : null
		}));
		return json({ data: formattedRows });
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
				"rank",
				notes, 
				purchase_date, 
				purchased_qty_lbs, 
				bean_cost, 
				tax_ship_cost, 
				link,
				last_updated
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING *`;

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

		const {
			rows: [newBean]
		} = await dbConn.query(query, values);
		return json(newBean);
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
		const client = await dbConn.connect();

		try {
			await client.query('BEGIN');

			// First, get all roast_ids associated with this coffee
			const { rows: roastProfiles } = await client.query(
				'SELECT roast_id FROM roast_profiles WHERE coffee_id = $1',
				[id]
			);

			// Delete associated profile logs
			if (roastProfiles.length > 0) {
				const roastIds = roastProfiles.map((profile) => profile.roast_id);
				await client.query('DELETE FROM profile_log WHERE roast_id = ANY($1)', [roastIds]);
			}

			// Delete roast profiles
			await client.query('DELETE FROM roast_profiles WHERE coffee_id = $1', [id]);

			// Finally, delete the coffee
			await client.query('DELETE FROM green_coffee_inv WHERE id = $1', [id]);

			await client.query('COMMIT');
			client.release();

			return json({ success: true });
		} catch (error) {
			await client.query('ROLLBACK');
			client.release();
			throw error;
		}
	} catch (error) {
		console.error('Error deleting bean and associated data:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { id: _, ...updateData } = updates;

		// Convert object to SET clause and values array
		const setEntries = Object.entries(updateData);
		const setClause = setEntries.map((entry, index) => `"${entry[0]}" = $${index + 1}`).join(', ');
		const values = setEntries.map(([_, value]) => value);
		values.push(id);

		const query = `
			UPDATE green_coffee_inv 
			SET ${setClause} 
			WHERE id = $${values.length} 
			RETURNING *`;

		const {
			rows: [updatedBean]
		} = await dbConn.query(query, values);

		if (!updatedBean) {
			return json({ success: false, error: 'Bean not found' }, { status: 404 });
		}

		return json(updatedBean);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
}
