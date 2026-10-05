import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
type ReferenceProfileRoastGenerationRequest =
	components['schemas']['ReferenceProfileRoastGenerationRequest'];
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { parseGenerationRequest, routeFailure } from '$lib/server/referenceGeneration';
import { roastPlanFailure } from '$lib/server/fromRoastPlan';

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const raw: unknown = await event.request.json();
		if (!raw || typeof raw !== 'object' || !('roastId' in raw) || !('roastRevision' in raw))
			return json({ error: 'Choose a roast' }, { status: 400 });
		const input = parseGenerationRequest(raw);
		if (
			!input ||
			!Number.isSafeInteger(raw.roastId) ||
			Number(raw.roastId) <= 0 ||
			typeof raw.roastRevision !== 'string' ||
			!raw.roastRevision
		)
			return json({ error: 'Choose a roast and valid temperature adjustment' }, { status: 400 });
		const body: ReferenceProfileRoastGenerationRequest = {
			...input,
			roastId: Number(raw.roastId),
			roastRevision: raw.roastRevision
		};
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.previewFromRoast(body);
		if (result.error || !result.data)
			return roastPlanFailure(result.error, result.response?.status, 'Unable to preview this plan');
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to preview this plan');
	}
};
