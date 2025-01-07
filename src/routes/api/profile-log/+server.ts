import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader } from 'mysql2';

export async function GET({ url }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		// Allow filtering by roast_id
		const roastId = url.searchParams.get('roast_id');
		let query = 'SELECT * FROM profile_log';
		let values = [];

		if (roastId) {
			query += ' WHERE roast_id = ?';
			values.push(roastId);
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
		const log = await request.json();

		const query = `
            INSERT INTO profile_log (
                roast_id,
                fan_setting,
                heat_setting,
                start,
                maillard,
                fc_start,
                fc_rolling,
                fc_end,
                sc_start,
                end,
                time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

		const values = [
			log.roast_id,
			log.fan_setting,
			log.heat_setting,
			log.start,
			log.maillard,
			log.fc_start,
			log.fc_rolling,
			log.fc_end,
			log.sc_start,
			log.end,
			log.time
		];

		const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];

		const [newLog] = await dbConn.query('SELECT * FROM profile_log WHERE log_id = ?', [
			result.insertId
		]);
		return json(newLog[0]);
	} catch (error) {
		console.error('Error creating profile log:', error);
		return json({ success: false, error: 'Failed to create profile log' }, { status: 500 });
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
		const [result] = await dbConn.execute('DELETE FROM profile_log WHERE log_id = ?', [id]);
		return json({ success: true, data: result });
	} catch (error) {
		console.error('Error deleting profile log:', error);
		return json({ success: false, error: 'Failed to delete profile log' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { log_id: _, ...updateData } = updates;

		await dbConn.query('UPDATE profile_log SET ? WHERE log_id = ?', [updateData, id]);

		const [updatedLog] = await dbConn.query('SELECT * FROM profile_log WHERE log_id = ?', [id]);

		return new Response(JSON.stringify(updatedLog[0]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating profile log:', error);
		return new Response(JSON.stringify({ error: 'Failed to update profile log' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
