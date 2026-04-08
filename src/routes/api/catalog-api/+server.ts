import type { RequestHandler } from './$types';
import { buildCanonicalCatalogResponse } from '$lib/server/catalogResource';

// Legacy endpoint — delegates to the canonical /v1/catalog resource.
// A 308 redirect was attempted here previously but does not work under
// adapter-vercel: the framework converts it to HTTP 200 with an empty body,
// silently breaking callers who followed the redirect. Delegating to the
// canonical handler directly is the only reliable option under this adapter.
//
// The Deprecation header signals to callers that they should migrate to
// /v1/catalog. The endpoint continues to serve real data so existing
// integrations that relied on the old /api/catalog-api URL keep working.
export const GET: RequestHandler = async (event) => {
	const response = await buildCanonicalCatalogResponse(event, { requestPath: '/v1/catalog' });

	// Clone response to add deprecation headers without mutating the original
	const headers = new Headers(response.headers);
	headers.set('Deprecation', 'true');
	headers.set('Link', '</v1/catalog>; rel="successor-version"');
	headers.set('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');

	return new Response(response.body, {
		status: response.status,
		headers
	});
};
