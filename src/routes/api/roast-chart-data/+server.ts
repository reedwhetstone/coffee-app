import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { unwrapParchment } from '$lib/services/tools/parchment';
import { isCookieSessionPrincipal } from '$lib/server/principal';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	if (!isCookieSessionPrincipal(locals.principal)) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const roastId = url.searchParams.get('roastId');
	if (!roastId || isNaN(parseInt(roastId))) {
		return json({ error: 'Valid roastId parameter required' }, { status: 400 });
	}

	const roastIdNum = parseInt(roastId);

	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = unwrapParchment(
			await client.roasts.chartData(String(roastIdNum), { target_points: 400 })
		).data;
		return json(data);
	} catch (error) {
		console.error('Error fetching roast chart data from Parchment:', error);
		return json({ error: 'Failed to process chart data' }, { status: 500 });
	}
};
