import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');
	const next = url.searchParams.get('next') ?? '/';

	if (error) {
		throw redirect(303, `/?error=${error}&error_description=${error_description}`);
	}

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) {
			throw redirect(303, `/?error=session_error&error_description=${error.message}`);
		}
		throw redirect(303, next);
	}

	throw redirect(303, '/');
};
