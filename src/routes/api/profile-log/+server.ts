import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const roastId = url.searchParams.get('roast_id');
		let query = `
			SELECT 
				roast_id,
				fan_setting,
				heat_setting,
				time,
				start,
				maillard,
				fc_start,
				fc_rolling,
				fc_end,
				sc_start,
				"drop",
				"end"
			FROM profile_log
		`;
		let params: number[] = [];

		if (roastId) {
			const parsedId = Number(roastId);
			query += ` WHERE roast_id = ${parsedId} ORDER BY time ASC`;
		}

		console.log('Query:', query);
		console.log('Params:', params);

		const { data: rows, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: params
		});

		if (error) {
			console.error('Database error:', error);
			throw error;
		}

		// Transform the data for chart consumption
		const formattedRows = rows.map((row: Record<string, any>) => ({
			...row,
			time: row.time, // Ensure time is in the correct format
			fan: row.fan_setting,
			heat: row.heat_setting
		}));

		return json({ data: formattedRows });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch data' });
	}
}

export async function POST({ request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
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

			const { data: newLog, error } = await supabase.rpc('run_query', {
				query_text: query,
				query_params: values
			});

			if (error) throw error;
			results.push(newLog[0]);
		}

		return json(results);
	} catch (error) {
		console.error('Error creating profile log:', error);
		return json({ success: false, error: 'Failed to create profile log' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	const roastId = url.searchParams.get('roast_id');
	console.log('Received roastId:', roastId, 'Type:', typeof roastId);

	if (!roastId) {
		return json({ success: false, error: 'No roast_id provided' }, { status: 400 });
	}

	try {
		const parsedId = parseInt(roastId, 10);
		console.log('Parsed roastId:', parsedId, 'Type:', typeof parsedId);

		const query = 'DELETE FROM profile_log WHERE roast_id = $1';
		const params = [parsedId];

		console.log('Query:', query);
		console.log('Params:', params, 'Type of first param:', typeof params[0]);

		const { error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: params
		});

		if (error) {
			console.error('Database error:', error);
			throw error;
		}
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting profile logs:', error);
		return json({ success: false, error: 'Failed to delete profile logs' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
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
		const values = [...keys.map((key) => updateData[key]), id];

		const query = `
			UPDATE profile_log 
			SET ${setClause} 
			WHERE log_id = $${values.length} 
			RETURNING *
		`;

		const { data: updatedLog, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: values
		});

		if (error) throw error;

		return json(updatedLog[0]);
	} catch (error) {
		console.error('Error updating profile log:', error);
		return json({ error: 'Failed to update profile log' }, { status: 500 });
	}
}
