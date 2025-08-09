import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRoastDataService } from '$lib/services/roastDataService';

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

		const events = await request.json();
		const eventsArray = Array.isArray(events) ? events : [events];

		// Verify all events have roast_id and validate ownership
		const roastId = eventsArray[0]?.roast_id;
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

		// Insert events directly to roast_events table
		const { error } = await supabase.from('roast_events').insert(eventsArray);

		if (error) {
			console.error('Event insert error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true, count: eventsArray.length });
	} catch (error) {
		console.error('Error creating profile log:', error);
		return json({ error: 'Failed to create profile log' }, { status: 500 });
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
