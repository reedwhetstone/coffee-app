import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

// Temporary raw-path adapter until the generated SDK release includes comparison.
// The shared client still owns credentials, transport, and upstream authorization.
export const GET: RequestHandler = async (event) => {
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const query = Object.fromEntries(event.url.searchParams);
	const get = client.raw.GET as unknown as (
		path: string,
		options: { params: { query: Record<string, string> } }
	) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
	const { data, error, response } = await get('/v1/price-index/comparison', { params: { query } });
	return json(data ?? error ?? { error: { message: 'Price comparison unavailable' } }, {
		status: response.status,
		headers: { 'Cache-Control': 'private, no-store' }
	});
};
