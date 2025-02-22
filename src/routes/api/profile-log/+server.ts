import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const roastId = url.searchParams.get('roast_id');

		// First verify ownership of the roast profile
		if (roastId) {
			const { data: profile } = await supabase
				.from('roast_profiles')
				.select('user')
				.eq('roast_id', roastId)
				.single();

			if (!profile || profile.user !== session.user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
		}

		let query = supabase.from('profile_log').select('*');

		if (roastId) {
			const parsedId = Number(roastId);
			query = query.eq('roast_id', parsedId).order('time', { ascending: true });
		} else {
			// If no roast_id provided, get all logs for user's roast profiles
			const { data: userProfiles } = await supabase
				.from('roast_profiles')
				.select('roast_id')
				.eq('user', session.user.id);

			if (userProfiles && userProfiles.length > 0) {
				const roastIds = userProfiles.map((profile) => profile.roast_id);
				query = query.in('roast_id', roastIds).order('time', { ascending: true });
			}
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

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const session = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const logs = await request.json();
		const logsArray = Array.isArray(logs) ? logs : [logs];

		// Verify ownership of the roast profile
		const roastId = logsArray[0]?.roast_id;
		if (roastId) {
			const { data: profile } = await supabase
				.from('roast_profiles')
				.select('user')
				.eq('roast_id', roastId)
				.single();

			if (!profile || profile.user !== session.user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
		}

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

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const session = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const roastId = url.searchParams.get('roast_id');
		if (!roastId) {
			return json({ error: 'No roast_id provided' }, { status: 400 });
		}

		// Verify ownership of the roast profile
		const { data: profile } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', roastId)
			.single();

		if (!profile || profile.user !== session.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

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

export const PUT: RequestHandler = async ({
	url,
	request,
	locals: { supabase, safeGetSession }
}) => {
	try {
		const session = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership through the roast profile
		const { data: log } = await supabase
			.from('profile_log')
			.select('roast_id')
			.eq('log_id', id)
			.single();

		if (log) {
			const { data: profile } = await supabase
				.from('roast_profiles')
				.select('user')
				.eq('roast_id', log.roast_id)
				.single();

			if (!profile || profile.user !== session.user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
		}

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
