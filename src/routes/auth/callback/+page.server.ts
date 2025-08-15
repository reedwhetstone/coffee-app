import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');

	if (error) {
		console.error('Auth error:', error, error_description);
		throw redirect(303, '/auth/error');
	}

	if (!code) {
		throw redirect(303, '/catalog');
	}

	try {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) throw error;
	} catch (error) {
		console.error('Failed to exchange code for session:', error);
		throw redirect(303, '/auth/error');
	}

	throw redirect(303, '/catalog');
};
