import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { unwrapParchment } from '$lib/services/tools/parchment';
import { isCookieSessionPrincipal } from '$lib/server/principal';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	// Use the auth state resolved by hooks.server.ts. Re-reading the Supabase
	// cookie here could disagree with an Authorization header that the hook
	// treated as authoritative, causing the Parchment lookup to use a different
	// principal than the one that passed this route's auth gate.
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
		const data = unwrapParchment(await client.roasts.get(String(roastIdNum))).data;

		const settings = {
			xRange: [data.chart_x_min, data.chart_x_max],
			yRange: [data.chart_y_min, data.chart_y_max],
			zRange: [data.chart_z_min, data.chart_z_max]
		};

		return json({ settings });
	} catch (error) {
		console.error('Error fetching chart settings:', error);
		return json({ settings: null });
	}
};
