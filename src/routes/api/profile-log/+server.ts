import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Feature flag to enable dual-write to new table structure
const ENABLE_NEW_STRUCTURE = true;

/**
 * Convert time string (HH:MM:SS) to seconds
 */
function convertTimeToSeconds(timeString: string): number {
	if (!timeString || !timeString.includes(':')) return 0;
	
	const parts = timeString.split(':');
	const hours = parseInt(parts[0] || '0', 10);
	const minutes = parseInt(parts[1] || '0', 10);
	const seconds = parseInt(parts[2] || '0', 10);
	
	return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Insert temperature and event data into new table structure
 */
async function insertToNewStructure(supabase: any, log: any, timeSeconds: number, userId: string) {
	const roastId = log.roast_id;
	
	// 1. Insert temperature data if present
	if (log.bean_temp !== null || log.environmental_temp !== null) {
		const { error: tempError } = await supabase
			.from('roast_temperatures')
			.insert({
				roast_id: roastId,
				time_seconds: timeSeconds,
				bean_temp: log.bean_temp || null,
				environmental_temp: log.environmental_temp || null,
				ambient_temp: log.ambient_temp || null,
				data_source: 'live'
			});
		
		if (tempError) {
			console.warn('Temperature insert error:', tempError);
		}
	}
	
	// 2. Insert control events if present
	const controlEvents = [];
	
	if (log.fan_setting !== null && log.fan_setting !== undefined) {
		controlEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: log.fan_setting.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: false,
			automatic: true
		});
	}
	
	if (log.heat_setting !== null && log.heat_setting !== undefined) {
		controlEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: log.heat_setting.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: false,
			automatic: true
		});
	}
	
	// 3. Insert milestone events (boolean events with NULL values)
	const milestoneEvents = [];
	
	if (log.start) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.charge) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'charge',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.maillard) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'dry_end', // Normalize: maillard -> dry_end
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.fc_start) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.fc_rolling) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_rolling',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.fc_end) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_end',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.sc_start) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'sc_start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.drop) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'drop',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (log.end) {
		milestoneEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: 'cool', // Normalize: end -> cool
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	// Insert all events
	const allEvents = [...controlEvents, ...milestoneEvents];
	
	if (allEvents.length > 0) {
		const { error: eventError } = await supabase
			.from('roast_events')
			.insert(allEvents);
		
		if (eventError) {
			console.warn('Event insert error:', eventError);
		}
	}
}

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
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

			if (!profile || profile.user !== user.id) {
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
				.eq('user', user.id);

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
		const { session, user } = await safeGetSession();
		if (!session || !user) {
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

			if (!profile || profile.user !== user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
		}

		const results = await Promise.all(
			logsArray.map(async (log) => {
				const timeValue = log.time?.includes(':') ? log.time : '00:00:00';
				const timeSeconds = log.time_seconds || convertTimeToSeconds(timeValue);

				// 1. INSERT INTO LEGACY TABLE (profile_log) - for backward compatibility
				const { data: legacyData, error: legacyError } = await supabase
					.from('profile_log')
					.insert({
						roast_id: log.roast_id || null,
						fan_setting: log.fan_setting || 0,
						heat_setting: log.heat_setting || 0,
						time: timeValue,
						time_seconds: timeSeconds,
						start: log.start ? 1 : 0,
						maillard: log.maillard ? 1 : 0,
						fc_start: log.fc_start ? 1 : 0,
						fc_rolling: log.fc_rolling ? 1 : 0,
						fc_end: log.fc_end ? 1 : 0,
						sc_start: log.sc_start ? 1 : 0,
						drop: log.drop ? 1 : 0,
						end: log.end ? 1 : 0,
						charge: log.charge ? 1 : 0,
						bean_temp: log.bean_temp || null,
						environmental_temp: log.environmental_temp || null,
						user: user.id
					})
					.select()
					.single();

				if (legacyError) throw legacyError;

				// 2. DUAL-WRITE TO NEW STRUCTURE (if enabled)
				if (ENABLE_NEW_STRUCTURE) {
					try {
						await insertToNewStructure(supabase, log, timeSeconds, user.id);
					} catch (newStructureError) {
						console.warn('Failed to write to new structure:', newStructureError);
						// Continue - don't fail the request if new structure fails
					}
				}

				return legacyData;
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
		const { session, user } = await safeGetSession();
		if (!session || !user) {
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

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const parsedId = parseInt(roastId, 10);
		
		// Delete from legacy table
		const { error: legacyError } = await supabase.from('profile_log').delete().eq('roast_id', parsedId);

		if (legacyError) {
			console.error('Database error:', legacyError);
			return json({ error: legacyError.message }, { status: 500 });
		}
		
		// Also delete from new structure if enabled
		if (ENABLE_NEW_STRUCTURE) {
			try {
				// Delete temperature data
				await supabase.from('roast_temperatures').delete().eq('roast_id', parsedId);
				
				// Delete event data
				await supabase.from('roast_events').delete().eq('roast_id', parsedId);
			} catch (newStructureError) {
				console.warn('Failed to delete from new structure:', newStructureError);
				// Continue - don't fail the request if new structure deletion fails
			}
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
		const { session, user } = await safeGetSession();
		if (!session || !user) {
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

			if (!profile || profile.user !== user.id) {
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
