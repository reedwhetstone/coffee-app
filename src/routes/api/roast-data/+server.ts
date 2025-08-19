import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRoastDataService } from '$lib/services/roastDataService';
import { createMilestoneCalculationService } from '$lib/services/milestoneCalculationService';

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

		// Return normalized data structure directly
		const roastDataService = createRoastDataService(supabase);
		const chartData = await roastDataService.getChartData(parseInt(roastId));

		return json({
			temperatures: chartData.temperatures,
			events: [...chartData.milestones, ...chartData.controls],
			eventValueSeries: chartData.eventValueSeries,
			metadata: chartData.metadata
		});
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const requestData = await request.json();

		// Handle both legacy event-only format and new combined format
		let temperatures: any[] = [];
		let events: any[] = [];
		let roastId: number;

		if (Array.isArray(requestData)) {
			// Legacy format: array of events only
			events = requestData;
			roastId = events[0]?.roast_id;
		} else if (requestData.temperatures && requestData.events) {
			// New format: object with both temperatures and events
			temperatures = Array.isArray(requestData.temperatures) ? requestData.temperatures : [];
			events = Array.isArray(requestData.events) ? requestData.events : [];
			roastId = requestData.roast_id || temperatures[0]?.roast_id || events[0]?.roast_id;
		} else {
			// Assume it's a single event
			events = [requestData];
			roastId = requestData.roast_id;
		}

		if (!roastId) {
			return json({ error: 'roast_id is required' }, { status: 400 });
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

		let temperatureCount = 0;
		let eventCount = 0;

		// Insert temperatures if provided
		if (temperatures.length > 0) {
			const { error: tempError } = await supabase.from('roast_temperatures').insert(temperatures);
			if (tempError) {
				console.error('Temperature insert error:', tempError);
				return json({ error: tempError.message }, { status: 500 });
			}
			temperatureCount = temperatures.length;
		}

		// Insert events if provided
		if (events.length > 0) {
			const { error: eventError } = await supabase.from('roast_events').insert(events);
			if (eventError) {
				console.error('Event insert error:', eventError);
				return json({ error: eventError.message }, { status: 500 });
			}
			eventCount = events.length;
		}

		// Automatically calculate and update milestone data after saving
		try {
			const milestoneService = createMilestoneCalculationService(supabase);
			await milestoneService.updateRoastProfileMilestones(roastId);
			console.log(`Milestone calculation completed for roast ${roastId}`);
		} catch (milestoneError) {
			// Log error but don't fail the main operation
			console.warn(`Failed to calculate milestones for roast ${roastId}:`, milestoneError);
		}

		return json({
			success: true,
			temperatureCount,
			eventCount,
			totalCount: temperatureCount + eventCount,
			milestonesCalculated: true
		});
	} catch (error) {
		console.error('Error creating roast data:', error);
		return json({ error: 'Failed to create roast data' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!user) {
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

		// Delete from normalized structure
		const { error: tempError } = await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', parsedId)
			.eq('data_source', 'live');

		if (tempError) {
			console.error('Temperature delete error:', tempError);
			return json({ error: tempError.message }, { status: 500 });
		}

		// Delete events from normalized structure
		const { error: eventError } = await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', parsedId)
			.eq('user_generated', true);

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
