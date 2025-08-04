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
		if (!roastId) {
			return json({ error: 'roast_id parameter is required' }, { status: 400 });
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

		// Get event value series using roastDataService
		const roastDataService = createRoastDataService(supabase);
		const eventValueSeries = await roastDataService.getEventValueSeries(parseInt(roastId));

		return json({ data: eventValueSeries });
	} catch (error) {
		console.error('Error fetching event value series:', error);
		return json({ error: 'Failed to fetch event value series' }, { status: 500 });
	}
};
