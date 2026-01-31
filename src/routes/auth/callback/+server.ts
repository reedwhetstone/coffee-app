import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code') as string;
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data?.session) {
			// Validate the user after exchange
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError || !userData.user) {
				throw redirect(303, '/auth/auth-code-error');
			}

			// Now safe to proceed with validated user

			throw redirect(303, next);
		}
		console.error('Auth error:', error);
	}

	throw redirect(303, '/auth/auth-code-error');
};
