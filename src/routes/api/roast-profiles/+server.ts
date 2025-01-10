import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const [rows] = await dbConn.query('SELECT * FROM roast_profiles');
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
		const data = await request.json();

		// Validate required coffee_id
		if (!data.coffee_id) {
			return json({ success: false, error: 'coffee_id is required' }, { status: 400 });
		}

		// Verify coffee_id exists in green_coffee_inv
		const [coffeeExists]: any[] = await dbConn.query(
			'SELECT id, name FROM green_coffee_inv WHERE id = ?',
			[data.coffee_id]
		);

		if (!coffeeExists || !coffeeExists[0]) {
			return json(
				{ success: false, error: 'Invalid coffee_id - coffee not found' },
				{ status: 400 }
			);
		}

		// Ensure all required fields are present and convert undefined to null
		const profile = {
			batch_name: data.batch_name || `${coffeeExists[0].name} - ${new Date().toLocaleDateString()}`,
			coffee_id: data.coffee_id,
			coffee_name: data.coffee_name || coffeeExists[0].name,
			roast_date: data.roast_date || new Date().toISOString(),
			last_updated: data.last_updated || new Date().toISOString(),
			oz_in: data.oz_in || null,
			oz_out: data.oz_out || null,
			roast_notes: data.roast_notes || null,
			roast_targets: data.roast_targets || null
		};

		const query = `
            INSERT INTO roast_profiles (
                batch_name,
                coffee_id,
                coffee_name,
                roast_date,
                last_updated,
                oz_in,
                oz_out,
                roast_notes,
                roast_targets
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

		const values = [
			profile.batch_name,
			profile.coffee_id,
			profile.coffee_name,
			profile.roast_date,
			profile.last_updated,
			profile.oz_in,
			profile.oz_out,
			profile.roast_notes,
			profile.roast_targets
		];

		const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];
		const [newRoast] = (await dbConn.query('SELECT * FROM roast_profiles WHERE roast_id = ?', [
			result.insertId
		])) as [RowDataPacket[], any];

		return json(newRoast[0]);
	} catch (error) {
		console.error('Error creating roast profile:', error);
		return json({ success: false, error: 'Failed to create roast profile' }, { status: 500 });
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
			// First delete associated profile logs
			await dbConn.query('DELETE FROM profile_log WHERE roast_id = ?', [id]);

			// Then delete the roast profile
			await dbConn.query('DELETE FROM roast_profiles WHERE roast_id = ?', [id]);

			// Commit the transaction
			await dbConn.commit();

			return json({ success: true });
		} catch (error) {
			// If anything fails, roll back the transaction
			await dbConn.rollback();
			throw error;
		}
	} catch (error) {
		console.error('Error deleting roast profile and associated data:', error);
		return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();

		// Remove properties that don't exist in the database
		const { roast_id: _, has_log_data: __, ...updateData } = updates;

		await dbConn.query('UPDATE roast_profiles SET ? WHERE roast_id = ?', [updateData, id]);

		const [updatedRoast]: any[] = await dbConn.query(
			'SELECT * FROM roast_profiles WHERE roast_id = ?',
			[id]
		);

		return new Response(JSON.stringify(updatedRoast[0]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return new Response(JSON.stringify({ error: 'Failed to update roast profile' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
