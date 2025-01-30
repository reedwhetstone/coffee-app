import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase }, cookies }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');
	const next = url.searchParams.get('next') ?? '/';
	const pkce_verifier = url.searchParams.get('pkce_verifier');

	if (error) {
		console.error('Auth error from provider:', error, error_description);
		throw redirect(303, `/?error=${error}&error_description=${error_description}`);
	}

	if (code) {
		try {
			const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code, {
				verifier: pkce_verifier
			});

			if (exchangeError) {
				console.error('Exchange error:', exchangeError);
				throw exchangeError;
			}

			if (!data.session) {
				throw new Error('No session received');
			}
		} catch (error) {
			console.error('Auth error:', error);
			throw redirect(303, '/?error=auth_error');
		}
	}

	throw redirect(303, next);
};
