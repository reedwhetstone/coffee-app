import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthError, requireParchmentAccess } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { getTrackedLotSummaries } from '$lib/server/trackedLots';
import { fetchParchmentCatalogItemsByIds } from '$lib/server/parchmentCatalog';

export const GET: RequestHandler = async (event) => {
	const headers = { 'cache-control': 'no-store' };
	try {
		await requireParchmentAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const trackedLots = await getTrackedLotSummaries(client, 100);
		const trackedCatalog = await fetchParchmentCatalogItemsByIds(
			client,
			trackedLots.map((lot) => lot.catalogId)
		);
		return json({ trackedLots, trackedCatalog }, { headers });
	} catch (error) {
		return json(
			{ error: error instanceof AuthError ? error.message : 'Unable to load bookmarked lots.' },
			{ status: error instanceof AuthError ? error.status : 502, headers }
		);
	}
};
