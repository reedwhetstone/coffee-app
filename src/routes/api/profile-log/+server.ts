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
		const logs = await request.json();
		const results = [];

		// Ensure logs is an array
		const logsArray = Array.isArray(logs) ? logs : [logs];

		for (const log of logsArray) {
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
					\`drop\`,
					\`end\`,
					\`time\`
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`;

			// Ensure time is in the correct format
			const timeValue = log.time?.includes(':') ? log.time : '00:00:00';

			// Convert undefined/null boolean values to false
			const values = [
				log.roast_id || null,
				log.fan_setting || 0,
				log.heat_setting || 0,
				log.start || false,
				log.maillard || false,
				log.fc_start || false,
				log.fc_rolling || false,
				log.fc_end || false,
				log.sc_start || false,
				log.drop || false,
				log.end || false,
				timeValue
			];

			const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];
			const [newLog] = (await dbConn.query('SELECT * FROM profile_log WHERE log_id = ?', [
				result.insertId
			])) as [any[], any];
			results.push(newLog[0]);
		}

		return json(results);
	} catch (error) {
		console.error('Error creating profile log:', error);
		return json({ success: false, error: 'Failed to create profile log' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	const roastId = url.searchParams.get('roast_id');
	if (!roastId) {
		return json({ success: false, error: 'No roast_id provided' }, { status: 400 });
	}

	try {
		await dbConn.query('DELETE FROM profile_log WHERE roast_id = ?', [roastId]);
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting profile logs:', error);
		return json({ success: false, error: 'Failed to delete profile logs' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { log_id: _, ...updateData } = updates;

		await dbConn.query('UPDATE profile_log SET ? WHERE log_id = ?', [updateData, id]);

		const [updatedLog] = (await dbConn.query('SELECT * FROM profile_log WHERE log_id = ?', [
			id
		])) as [any[], any];

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
