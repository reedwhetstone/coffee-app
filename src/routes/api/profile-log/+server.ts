import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRoastDataService } from '$lib/services/roastDataService';

/**
 * Convert milliseconds to seconds for database storage
 */
function msToSeconds(ms: number): number {
	return ms / 1000;
}

/**
 * Insert temperature data to roast_temperatures table
 */
async function insertTemperatureData(supabase: any, roastId: number, logEntry: any) {
	if (logEntry.bean_temp !== null || logEntry.environmental_temp !== null || logEntry.ambient_temp !== null) {
		const { error } = await supabase
			.from('roast_temperatures')
			.insert({
				roast_id: roastId,
				time_seconds: logEntry.time_seconds,
				bean_temp: logEntry.bean_temp || null,
				environmental_temp: logEntry.environmental_temp || null,
				ambient_temp: logEntry.ambient_temp || null,
				data_source: 'live'
			});
		
		if (error) {
			console.error('Temperature insert error:', error);
			throw error;
		}
	}
}

/**
 * Insert event data to roast_events table
 */
async function insertEventData(supabase: any, roastId: number, logEntry: any) {
	const events = [];
	
	// Control events (fan/heat settings with values)
	if (logEntry.fan_setting !== null && logEntry.fan_setting !== undefined) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 1,
			event_value: logEntry.fan_setting.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.heat_setting !== null && logEntry.heat_setting !== undefined) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 1,
			event_value: logEntry.heat_setting.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		});
	}
	
	// Milestone events (boolean events with NULL values)
	if (logEntry.start) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.charge) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'charge',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.maillard) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'dry_end', // Normalize: maillard -> dry_end
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.fc_start) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.fc_rolling) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_rolling',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.fc_end) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'fc_end',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.sc_start) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'sc_start',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.drop) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
			event_type: 10,
			event_value: null,
			event_string: 'drop',
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		});
	}
	
	if (logEntry.end) {
		events.push({
			roast_id: roastId,
			time_seconds: logEntry.time_seconds,
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
	if (events.length > 0) {
		const { error } = await supabase
			.from('roast_events')
			.insert(events);
		
		if (error) {
			console.error('Event insert error:', error);
			throw error;
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

		// Verify ownership of the roast profile
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

		if (!roastId) {
			return json({ error: 'roast_id parameter is required' }, { status: 400 });
		}

		// Use the roastDataService to get chart data
		const roastDataService = createRoastDataService(supabase);
		const chartData = await roastDataService.getChartData(parseInt(roastId));
		
		// Convert to legacy format for backward compatibility with existing components
		// Sort control events by time for proper carry-forward logic
		const fanEvents = chartData.controls.filter(c => c.event_string === 'fan_setting').sort((a, b) => a.time_seconds - b.time_seconds);
		const heatEvents = chartData.controls.filter(c => c.event_string === 'heat_setting').sort((a, b) => a.time_seconds - b.time_seconds);
		
		const legacyData = chartData.temperatures.map(temp => {
			// Find the most recent control event before or at this time
			const fanEvent = fanEvents.filter(c => c.time_seconds <= temp.time_seconds).pop();
			const heatEvent = heatEvents.filter(c => c.time_seconds <= temp.time_seconds).pop();
			
			// Find milestone events at this exact time (within 1 second)
			const milestoneEvents = chartData.milestones.filter(
				m => Math.abs(m.time_seconds - temp.time_seconds) < 1
			);
			
			// Convert to legacy format
			const legacyEntry: any = {
				roast_id: parseInt(roastId),
				time_seconds: temp.time_seconds,
				bean_temp: temp.bean_temp,
				environmental_temp: temp.environmental_temp,
				fan_setting: fanEvent ? parseInt(fanEvent.event_value) : 0,
				heat_setting: heatEvent ? parseInt(heatEvent.event_value) : 0,
				data_source: temp.data_source,
				// Convert milestone events back to boolean flags
				start: milestoneEvents.some(m => m.event_string === 'start'),
				charge: milestoneEvents.some(m => m.event_string === 'charge'),
				maillard: milestoneEvents.some(m => m.event_string === 'dry_end' || m.event_string === 'maillard'),
				fc_start: milestoneEvents.some(m => m.event_string === 'fc_start'),
				fc_rolling: milestoneEvents.some(m => m.event_string === 'fc_rolling'),
				fc_end: milestoneEvents.some(m => m.event_string === 'fc_end'),
				sc_start: milestoneEvents.some(m => m.event_string === 'sc_start'),
				drop: milestoneEvents.some(m => m.event_string === 'drop'),
				end: milestoneEvents.some(m => m.event_string === 'cool' || m.event_string === 'end')
			};
			
			return legacyEntry;
		});

		return json({ data: legacyData });
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
		if (!roastId) {
			return json({ error: 'roast_id is required' }, { status: 400 });
		}

		const { data: profile } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', roastId)
			.single();

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Process each log entry
		const results = await Promise.all(
			logsArray.map(async (log) => {
				// Convert time to seconds if needed
				const timeSeconds = log.time_seconds || (log.time ? msToSeconds(log.time) : 0);
				
				const logEntry = {
					...log,
					time_seconds: timeSeconds
				};

				// Insert temperature data
				await insertTemperatureData(supabase, roastId, logEntry);
				
				// Insert event data
				await insertEventData(supabase, roastId, logEntry);

				return { success: true, time_seconds: timeSeconds };
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
		
		// Delete from new structure only
		const { error: tempError } = await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', parsedId)
			.eq('data_source', 'live'); // Only delete live data, preserve imported data

		if (tempError) {
			console.error('Temperature delete error:', tempError);
			return json({ error: tempError.message }, { status: 500 });
		}
		
		// Delete events from new structure
		const { error: eventError } = await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', parsedId)
			.in('category', ['milestone', 'control'])
			.eq('user_generated', true); // Only delete user-generated events, preserve imported events
		
		if (eventError) {
			console.error('Event delete error:', eventError);
			return json({ error: eventError.message }, { status: 500 });
		}
		
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting profile logs:', error);
		return json({ error: 'Failed to delete profile logs' }, { status: 500 });
	}
};