import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { artisanFileResponse } from '$lib/server/artisanFile';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { isReferenceId, routeFailure } from '$lib/server/referenceGeneration';

/**
 * The Artisan file a saved reference was added from, or kept from a roast, as it was stored.
 * A plan has no original file; it downloads through its revision's export.
 */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		if (!isReferenceId(event.params.id))
			return json({ error: 'Invalid saved reference' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		return artisanFileResponse(
			await client.referenceProfiles.downloadArtisanFile(event.params.id),
			'Unable to download this Artisan file'
		);
	} catch (error) {
		return routeFailure(error, 'Unable to download this Artisan file');
	}
};
