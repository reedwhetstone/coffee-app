import type { Handle } from '@sveltejs/kit';

export const handleCookieCheck: Handle = async ({ event, resolve }) => {
	// Check if cookies are disabled
	const cookiesEnabled = event.request.headers.get('cookie') !== null;

	if (!cookiesEnabled && !event.url.pathname.startsWith('/no-cookies')) {
		// Redirect to a warning page if cookies are disabled
		return new Response(null, {
			status: 302,
			headers: { Location: '/no-cookies' }
		});
	}

	return resolve(event);
};
