import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	CatalogProxyValidationError,
	forwardCatalogUpstreamHeaders,
	parseCatalogProxyId,
	proxyCatalogSimilar,
	toCatalogSimilarQuery
} from '$lib/server/catalogProxy';

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
		{ status: 400 }
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

// First-party BFF for the catalog comparison panel. The public web-host /v1
// compatibility route is intentionally gone; Parchment owns the external API.
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
		return jsonResponse(body, { status });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardCatalogUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
