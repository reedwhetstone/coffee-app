import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
type ReferenceProfileFromRoastRequest = components['schemas']['ReferenceProfileFromRoastRequest'];
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure } from '$lib/server/referenceGeneration';
import { roastPlanFailure } from '$lib/server/fromRoastPlan';

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const key = event.request.headers.get('idempotency-key')?.trim();
		if (!key) return json({ error: 'Idempotency-Key is required' }, { status: 400 });
		const raw: unknown = await event.request.json();
		if (
			!raw ||
			typeof raw !== 'object' ||
			!('roastId' in raw) ||
			!('roastRevision' in raw) ||
			!Number.isSafeInteger(raw.roastId) ||
			Number(raw.roastId) <= 0 ||
			typeof raw.roastRevision !== 'string' ||
			!raw.roastRevision
		)
			return json({ error: 'Choose a roast' }, { status: 400 });
		const body: ReferenceProfileFromRoastRequest = {
			roastId: Number(raw.roastId),
			roastRevision: raw.roastRevision,
			basis: 'artisan_source'
		};
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.fromRoast(body, key);
		if (result.error || !result.data)
			return roastPlanFailure(
				result.error,
				result.response?.status,
				'Unable to save this roast as a reference'
			);
		return json(result.data, { status: result.response.status });
	} catch (error) {
		return routeFailure(error, 'Unable to save this roast as a reference');
	}
};
