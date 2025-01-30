import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	try {
		const roastId = url.searchParams.get('roast_id');
		let query = supabase.from('profile_log').select('*');

		if (roastId) {
			const parsedId = Number(roastId);
			query = query.eq('roast_id', parsedId).order('time', { ascending: true });
		}

		const { data, error } = await query;

		if (error) {
			console.error('Database error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		const formattedRows = data.map((row) => ({
			...row,
			time: row.time,
			fan: row.fan_setting,
			heat: row.heat_setting
		}));

		return json({ data: formattedRows });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch data' });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	try {
		const logs = await request.json();
		const logsArray = Array.isArray(logs) ? logs : [logs];

		const results = await Promise.all(
			logsArray.map(async (log) => {
				const timeValue = log.time?.includes(':') ? log.time : '00:00:00';

				const { data, error } = await supabase
					.from('profile_log')
					.insert({
						roast_id: log.roast_id || null,
						fan_setting: log.fan_setting || 0,
						heat_setting: log.heat_setting || 0,
						time: timeValue,
						start: log.start ? 1 : 0,
						maillard: log.maillard ? 1 : 0,
						fc_start: log.fc_start ? 1 : 0,
						fc_rolling: log.fc_rolling ? 1 : 0,
						fc_end: log.fc_end ? 1 : 0,
						sc_start: log.sc_start ? 1 : 0,
						drop: log.drop ? 1 : 0,
						end: log.end ? 1 : 0
					})
					.select()
					.single();

				if (error) throw error;
				return data;
			})
		);

		return json(results);
	} catch (error) {
		console.error('Error creating profile log:', error);
		return json({ error: 'Failed to create profile log' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase } }) => {
	const roastId = url.searchParams.get('roast_id');

	if (!roastId) {
		return json({ error: 'No roast_id provided' }, { status: 400 });
	}

	try {
		const parsedId = parseInt(roastId, 10);
		const { error } = await supabase.from('profile_log').delete().eq('roast_id', parsedId);

		if (error) {
			console.error('Database error:', error);
			return json({ error: error.message }, { status: 500 });
		}
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting profile logs:', error);
		return json({ error: 'Failed to delete profile logs' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ url, request, locals: { supabase } }) => {
	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { log_id: _, ...updateData } = updates;

		const { data, error } = await supabase
			.from('profile_log')
			.update(updateData)
			.eq('log_id', id)
			.select()
			.single();

		if (error) throw error;

		return json(data);
	} catch (error) {
		console.error('Error updating profile log:', error);
		return json({ error: 'Failed to update profile log' }, { status: 500 });
	}
};
