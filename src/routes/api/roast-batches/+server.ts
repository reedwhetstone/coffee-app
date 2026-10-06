import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { parseRoastDay } from '$lib/roast/roast-list-filters';
import {
	fetchParchmentRoastBatches,
	roastBatchRouteFailure
} from '$lib/server/parchmentRoastBatches';

/**
 * The member's roast batches. `?include_empty=true` also lists batches that hold no roasts,
 * which is how a batch left behind by a deleted roast is found. `?date_start=` and
 * `?date_end=` keep the batches dated in that span, which is how the roast list reads the
 * batches of the page it is showing and no others.
 */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const includeEmpty = event.url.searchParams.get('include_empty');
		if (includeEmpty !== null && includeEmpty !== 'true' && includeEmpty !== 'false') {
			return json({ error: 'include_empty must be true or false' }, { status: 400 });
		}
		const days: { dateStart?: string; dateEnd?: string } = {};
		for (const [name, key] of [
			['date_start', 'dateStart'],
			['date_end', 'dateEnd']
		] as const) {
			const param = event.url.searchParams.get(name);
			if (param === null) continue;
			const day = parseRoastDay(param);
			if (day === null) return json({ error: `${name} must be a date` }, { status: 400 });
			days[key] = day;
		}
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const data = await fetchParchmentRoastBatches(client, {
			includeEmpty: includeEmpty === 'true',
			...days
		});
		return json({ data });
	} catch (error) {
		return roastBatchRouteFailure(error, 'Unable to load roast batches');
	}
};
