import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '$lib/supabase';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { safeGetSession } = locals;
	const { user } = await safeGetSession();

	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const roastId = url.searchParams.get('roastId');
	if (!roastId || isNaN(parseInt(roastId))) {
		return json({ error: 'Valid roastId parameter required' }, { status: 400 });
	}

	const roastIdNum = parseInt(roastId);
	const supabase = createClient();

	try {
		const { data: dataRaw, error } = await supabase
			.from('roast_profiles')
			.select('chart_x_min, chart_x_max, chart_y_min, chart_y_max, chart_z_min, chart_z_max')
			.eq('roast_id', roastIdNum)
			.single();

		const data = dataRaw as {
			chart_x_min: number | null;
			chart_x_max: number | null;
			chart_y_min: number | null;
			chart_y_max: number | null;
			chart_z_min: number | null;
			chart_z_max: number | null;
		} | null;

		if (error) {
			console.error('Error fetching chart settings:', error);
			return json({ settings: null });
		}

		const settings = {
			xRange: [data?.chart_x_min, data?.chart_x_max],
			yRange: [data?.chart_y_min, data?.chart_y_max],
			zRange: [data?.chart_z_min, data?.chart_z_max]
		};

		return json({ settings });
	} catch (error) {
		console.error('Error fetching chart settings:', error);
		return json({ settings: null });
	}
};
