import type { RequestHandler } from './$types';

// Legacy endpoint archived 2026-03-30. Use /v1/catalog instead.
// 308 Permanent Redirect — clients MUST update their URLs.
// Note: SvelteKit's throw redirect() doesn't produce proper HTTP redirect status codes
// in API routes under adapter-vercel. Use native Response instead.
export const GET: RequestHandler = ({ url }) => {
	const target = new URL('/v1/catalog', url.origin);
	// Forward all query params to the new endpoint
	for (const [key, value] of url.searchParams) {
		target.searchParams.set(key, value);
	}
	return new Response(null, {
		status: 308,
		headers: {
			Location: target.toString()
		}
	});
};
