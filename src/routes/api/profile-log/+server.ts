import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

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
			query += ' WHERE roast_id = $1';
			values.push(roastId);
		}

		const { rows } = await dbConn.query(query, values);
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
					"drop",
					"end",
					"time"
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
				RETURNING *
			`;

			// Ensure time is in the correct format
			const timeValue = log.time?.includes(':') ? log.time : '00:00:00';

			// Convert boolean values to 1/0 for PostgreSQL smallint
			const values = [
				log.roast_id || null,
				log.fan_setting || 0,
				log.heat_setting || 0,
				log.start ? 1 : 0,
				log.maillard ? 1 : 0,
				log.fc_start ? 1 : 0,
				log.fc_rolling ? 1 : 0,
				log.fc_end ? 1 : 0,
				log.sc_start ? 1 : 0,
				log.drop ? 1 : 0,
				log.end ? 1 : 0,
				timeValue
			];

			const {
				rows: [newLog]
			} = await dbConn.query(query, values);
			results.push(newLog);
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
		await dbConn.query('DELETE FROM profile_log WHERE roast_id = $1', [roastId]);
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

		// Convert object to SET clause and values array
		const keys = Object.keys(updateData);
		const setClause = keys
			.map((key, index) => {
				const columnName = ['time', 'end', 'drop'].includes(key) ? `"${key}"` : key;
				return `${columnName} = $${index + 1}`;
			})
			.join(', ');
		const values = keys.map((key) => updateData[key]);
		values.push(id);

		const query = `
			UPDATE profile_log 
			SET ${setClause} 
			WHERE log_id = $${values.length} 
			RETURNING *
		`;

		const {
			rows: [updatedLog]
		} = await dbConn.query(query, values);

		return new Response(JSON.stringify(updatedLog), {
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
