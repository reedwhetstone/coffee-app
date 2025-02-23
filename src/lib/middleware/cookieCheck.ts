import type { Handle } from '@sveltejs/kit';

export const handleCookieCheck: Handle = async ({ event, resolve }) => {
	// Check if cookies are disabled
	const cookiesEnabled = event.request.headers.get('cookie') !== null;

	if (!cookiesEnabled) {
		// Instead of redirecting, add a custom header that the page can use
		// to show a warning banner
		const response = await resolve(event);
		return new Response(response.body, {
			...response,
			headers: {
				...response.headers,
				'X-Cookies-Disabled': 'true'
			}
		});
	}

	return resolve(event);
};
