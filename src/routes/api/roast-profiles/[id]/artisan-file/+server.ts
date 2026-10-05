import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { artisanFileResponse } from '$lib/server/artisanFile';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure } from '$lib/server/referenceGeneration';

/** The Artisan file stored with a roast when it was imported. Internal to the roast pages. */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		if (!/^[1-9]\d*$/.test(event.params.id) || !Number.isSafeInteger(Number(event.params.id)))
			return json({ error: 'Invalid roast ID' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		return artisanFileResponse(
			await client.roasts.downloadArtisanFile(event.params.id),
			'Unable to download this Artisan file'
		);
	} catch (error) {
		return routeFailure(error, 'Unable to download this Artisan file');
	}
};
