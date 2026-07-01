import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { forwardCatalogUpstreamHeaders } from '$lib/server/catalogProxy';
import { withCatalogDeprecationHeaders } from '$lib/server/catalogDeprecation';

// Thin proxy in front of the canonical Parchment proof-coverage surface
// (ADR-007). The caller's own credential is forwarded and the aggregate response
// is relayed verbatim.
export const GET: RequestHandler = async (event) => {
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.catalog.proofCoverage();
	const headers = withCatalogDeprecationHeaders('/v1/catalog/proof-coverage');
	forwardCatalogUpstreamHeaders(response, headers);

	return jsonResponse(error ?? data, { status: response.status, headers });
};
