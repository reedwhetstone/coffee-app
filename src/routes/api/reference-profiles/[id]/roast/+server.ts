import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { isReferenceId, routeFailure, upstreamFailure } from '$lib/server/referenceGeneration';

/**
 * Record an uploaded Artisan reference as a roast the member ran, against one of their
 * coffees. Parchment reads the file it already holds; the saved reference stays as it is.
 */
export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		if (!isReferenceId(event.params.id))
			return json({ error: 'Invalid saved reference' }, { status: 400 });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey) return json({ error: 'Idempotency-Key is required' }, { status: 400 });
		const body: unknown = await event.request.json();
		const coffeeId =
			typeof body === 'object' && body !== null && 'coffeeId' in body ? body.coffeeId : null;
		const revisionId =
			typeof body === 'object' && body !== null && 'revisionId' in body ? body.revisionId : null;
		if (typeof coffeeId !== 'number' || !Number.isSafeInteger(coffeeId) || coffeeId <= 0)
			return json({ error: 'Choose the coffee this roast was of' }, { status: 400 });
		if (!isReferenceId(revisionId))
			return json({ error: 'Invalid saved reference' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.roasts.importFromReference(
			{ referenceProfileId: event.params.id, referenceRevisionId: revisionId, coffeeId },
			{ idempotencyKey }
		);
		if (result.error || !result.data)
			return upstreamFailure(
				result.error,
				result.response?.status,
				'Unable to record this as a roast'
			);
		const roast = result.data.data.roast;
		return json(
			{ data: { roastId: roast.roast_id, coffeeName: roast.coffee_name ?? null } },
			{ status: result.response.status }
		);
	} catch (error) {
		return routeFailure(error, 'Unable to record this as a roast');
	}
};
