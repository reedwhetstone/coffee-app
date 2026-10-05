import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { CatalogProxyValidationError, parseCatalogProxyId } from '$lib/server/catalogProxy';
import { applyBffCatalogNoStore } from '$lib/server/cacheHeaders';

// First-party BFF for the coffee card's price-history chart. Parchment owns
// entitlement (member, Intelligence, or scoped API key) and returns 401/403
// itself; this route forwards the session and never caches member data.
export const GET: RequestHandler = async (event) => {
	const headers = applyBffCatalogNoStore(new Headers());
	let id: string;
	try {
		id = parseCatalogProxyId(event.params.id);
	} catch (error) {
		if (error instanceof CatalogProxyValidationError) {
			return jsonResponse(
				{ error: 'Invalid catalog id', message: error.message },
				{ status: 400, headers }
			);
		}
		throw error;
	}

	const days = event.url.searchParams.get('days');
	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.catalog.priceHistory(
			id,
			days ? { days } : undefined
		);
		return jsonResponse(data ?? error ?? { error: 'Price history unavailable' }, {
			status: response.status,
			headers
		});
	} catch (error) {
		console.error(
			'Error proxying catalog price history:',
			error instanceof Error ? error.message : String(error)
		);
		return jsonResponse(
			{ error: 'Price history unavailable', message: 'Internal server error' },
			{ status: 500, headers }
		);
	}
};
