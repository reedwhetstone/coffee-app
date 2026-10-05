import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	parseReferenceTitle,
	parseRoastRevision,
	roastSourceFailure,
	routeFailure
} from '$lib/server/referenceGeneration';

/**
 * Keep a roast's Artisan file as a saved reference, so a plan can be built on it. Parchment
 * returns the reference already kept from that file instead of making a second one, and
 * the roast is not changed.
 */
export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey) return json({ error: 'Idempotency-Key is required' }, { status: 400 });
		const body: unknown = await event.request.json();
		const roast = parseRoastRevision(body);
		if (!roast) return json({ error: 'Choose a roast to plan from' }, { status: 400 });
		const title = parseReferenceTitle(body);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.fromRoast(
			{ ...roast, basis: 'artisan_source', ...(title ? { title } : {}) },
			idempotencyKey
		);
		if (result.error || !result.data)
			return roastSourceFailure(
				result.error,
				result.response?.status,
				'Unable to keep this roast as a saved reference'
			);
		return json(result.data, { status: result.response.status });
	} catch (error) {
		return routeFailure(error, 'Unable to keep this roast as a saved reference');
	}
};
