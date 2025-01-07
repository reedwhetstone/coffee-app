import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader } from 'mysql2';

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
		const roast = await request.json();

		const query = `
            INSERT INTO roast_profiles (
                batch_name,
                coffee_name,
                roast_date,
                oz_in,
                oz_out,
                roast_notes,
                roast_targets,
                last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

		const values = [
			roast.batch_name,
			roast.coffee_name,
			roast.roast_date,
			roast.oz_in,
			roast.oz_out,
			roast.roast_notes,
			roast.roast_targets,
			roast.last_updated
		];

		const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];

		const [newRoast] = await dbConn.query('SELECT * FROM roast_profiles WHERE roast_id = ?', [
			result.insertId
		]);
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
		const [result] = await dbConn.execute('DELETE FROM roast_profiles WHERE roast_id = ?', [id]);
		return json({ success: true, data: result });
	} catch (error) {
		console.error('Error deleting roast profile:', error);
		return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { roast_id: _, ...updateData } = updates;

		await dbConn.query('UPDATE roast_profiles SET ? WHERE roast_id = ?', [updateData, id]);

		const [updatedRoast] = await dbConn.query('SELECT * FROM roast_profiles WHERE roast_id = ?', [
			id
		]);

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
