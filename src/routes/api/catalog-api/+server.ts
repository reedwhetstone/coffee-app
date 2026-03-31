import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Legacy endpoint archived 2026-03-30. Use /v1/catalog instead.
// 308 Permanent Redirect — clients MUST update their URLs.
export const GET: RequestHandler = ({ url }) => {
	const target = new URL('/v1/catalog', url.origin);
	// Forward all query params to the new endpoint
	for (const [key, value] of url.searchParams) {
		target.searchParams.set(key, value);
	}
	throw redirect(308, target.toString());
};
