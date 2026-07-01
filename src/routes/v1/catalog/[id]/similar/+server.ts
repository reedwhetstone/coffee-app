import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	CatalogProxyValidationError,
	forwardCatalogUpstreamHeaders,
	parseCatalogProxyId,
	proxyCatalogSimilar,
	toCatalogSimilarQuery
} from '$lib/server/catalogProxy';

const LEGACY_SIMILAR_HEADERS = {
	Deprecation: 'true',
	Link: '<https://api.purveyors.io/v1/catalog/{id}/similar>; rel="successor-version"',
	Sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
} as const;

function withLegacySimilarHeaders(headers: HeadersInit = {}): Headers {
	const merged = new Headers(headers);

	for (const [name, value] of Object.entries(LEGACY_SIMILAR_HEADERS)) {
		merged.set(name, value);
	}

	return merged;
}

function validationErrorResponse(error: CatalogProxyValidationError): Response {
	return jsonResponse(
		{
			error: 'Invalid query parameter',
			message: error.message,
			details: {
				parameter: error.parameter,
				value: error.value,
				expected: error.expected
			}
		},
		{ status: 400, headers: withLegacySimilarHeaders() }
	);
}

function similarProxyErrorResponse(error: unknown): {
	status: number;
	body: { error: string; message: string };
} {
	if (error instanceof Error && error.name === 'ParchmentConfigError') {
		return {
			status: 503,
			body: { error: 'Catalog schema unavailable', message: error.message }
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error('Error proxying catalog similarity request:', message);
	return {
		status: 500,
		body: { error: 'Failed to fetch similar coffees', message: 'Internal server error' }
	};
}

// Legacy coffee-app proxy for the canonical Parchment similarity route. Parchment
// owns auth, entitlement, rate limiting, matching, and query validation; this
// handler only keeps the old coffee-app URL alive while relaying the upstream
// response and migration headers.
export const GET: RequestHandler = async (event) => {
	let id: string;

	try {
		id = parseCatalogProxyId(event.params.id);
	} catch (error) {
		if (error instanceof CatalogProxyValidationError) {
			return validationErrorResponse(error);
		}
		throw error;
	}

	const query = toCatalogSimilarQuery(event.url);

	let proxied: Awaited<ReturnType<typeof proxyCatalogSimilar>>;
	try {
		proxied = await proxyCatalogSimilar(event, id, query);
	} catch (error) {
		const { status, body } = similarProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: withLegacySimilarHeaders() });
	}

	const { status, body, upstream } = proxied;
	const headers = withLegacySimilarHeaders();
	forwardCatalogUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
