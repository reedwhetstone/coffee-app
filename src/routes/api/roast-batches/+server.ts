import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	fetchParchmentRoastBatches,
	roastBatchRouteFailure
} from '$lib/server/parchmentRoastBatches';

/**
 * The member's roast batches. `?include_empty=true` also lists batches that hold no roasts,
 * which is how a batch left behind by a deleted roast is found.
 */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const includeEmpty = event.url.searchParams.get('include_empty');
		if (includeEmpty !== null && includeEmpty !== 'true' && includeEmpty !== 'false') {
			return json({ error: 'include_empty must be true or false' }, { status: 400 });
		}
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const data = await fetchParchmentRoastBatches(client, {
			includeEmpty: includeEmpty === 'true'
		});
		return json({ data });
	} catch (error) {
		return roastBatchRouteFailure(error, 'Unable to load roast batches');
	}
};
