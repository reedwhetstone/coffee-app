import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { buildCanonicalCatalogResponse } from '$lib/server/catalogResource';

const LEGACY_CATALOG_API_HEADERS = {
	Deprecation: 'true',
	Link: '</v1/catalog>; rel="successor-version"',
	Sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
} as const;

function withLegacyCatalogHeaders(headers: HeadersInit = {}): Headers {
	const merged = new Headers(headers);

	for (const [name, value] of Object.entries(LEGACY_CATALOG_API_HEADERS)) {
		merged.set(name, value);
	}

	return merged;
}

// Legacy endpoint — delegates to the canonical /v1/catalog resource.
// A 308 redirect was attempted here previously but does not work under
// adapter-vercel: the framework converts it to HTTP 200 with an empty body,
// silently breaking callers who followed the redirect. Delegating to the
// canonical handler directly is the only reliable option under this adapter.
//
// ADR-004 narrows this alias to API-key callers only. Anonymous discovery,
// browser sessions, and public docs should all point at /v1/catalog instead.
export const GET: RequestHandler = async (event) => {
	try {
		await requireApiKeyAccess(event, {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return json(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{
					status: error.status,
					headers: withLegacyCatalogHeaders()
				}
			);
		}

		throw error;
	}

	const response = await buildCanonicalCatalogResponse(event, {
		requestPath: '/api/catalog-api'
	});

	return new Response(response.body, {
		status: response.status,
		headers: withLegacyCatalogHeaders(response.headers)
	});
};
