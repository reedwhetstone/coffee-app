import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	isReferenceId,
	parseReferenceTitle,
	routeFailure,
	upstreamFailure
} from '$lib/server/referenceGeneration';

/** Rename a saved reference or plan. */
export const PATCH: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		if (!isReferenceId(event.params.id))
			return json({ error: 'Invalid saved reference' }, { status: 400 });
		const title = parseReferenceTitle(await event.request.json());
		if (!title) return json({ error: 'Enter a name' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.update(event.params.id, { title });
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to rename this');
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to rename this');
	}
};

/** Remove a saved reference or plan. Roasts are not changed. */
export const DELETE: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		if (!isReferenceId(event.params.id))
			return json({ error: 'Invalid saved reference' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.delete(event.params.id);
		if (result.error)
			return upstreamFailure(result.error, result.response?.status, 'Unable to remove this');
		return new Response(null, { status: 204 });
	} catch (error) {
		return routeFailure(error, 'Unable to remove this');
	}
};
