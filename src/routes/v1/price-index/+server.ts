import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	forwardPriceIndexUpstreamHeaders,
	priceIndexProxyErrorResponse,
	proxyPriceIndexList
} from '$lib/server/priceIndexProxy';

const LEGACY_PRICE_INDEX_HEADERS = {
	Deprecation: 'true',
	Link: '<https://api.purveyors.io/v1/price-index>; rel="successor-version"',
	Sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
} as const;

function withLegacyPriceIndexHeaders(headers: HeadersInit = {}): Headers {
	const merged = new Headers(headers);

	for (const [name, value] of Object.entries(LEGACY_PRICE_INDEX_HEADERS)) {
		merged.set(name, value);
	}

	return merged;
}

// Legacy coffee-app proxy for the canonical Parchment price-index route (ADR-007).
// Parchment owns auth, entitlement (ppiAccess), rate limiting, aggregation, and
// query validation; this handler only keeps the old coffee-app URL alive while
// relaying the upstream response and migration headers.
export const GET: RequestHandler = async (event) => {
	let proxied: Awaited<ReturnType<typeof proxyPriceIndexList>>;
	try {
		proxied = await proxyPriceIndexList(event);
	} catch (error) {
		const { status, body } = priceIndexProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: withLegacyPriceIndexHeaders() });
	}

	const { status, body, upstream } = proxied;
	const headers = withLegacyPriceIndexHeaders();
	forwardPriceIndexUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
