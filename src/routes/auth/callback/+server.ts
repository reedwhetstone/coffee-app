import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code') as string;
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data?.session?.provider_token) {
			// Store provider_token and provider_refresh_token if needed
			// You can store these in your database or secure storage
			const { provider_token, provider_refresh_token } = data.session;

			// Continue with redirect
			throw redirect(303, next);
		}
		console.error('Auth error:', error);
	}

	// return the user to an error page with instructions
	throw redirect(303, '/auth/auth-code-error');
};
