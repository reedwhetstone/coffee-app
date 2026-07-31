import { redirect } from '@sveltejs/kit';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!isCookieSessionPrincipal(locals.principal)) {
		throw redirect(303, '/auth?next=/account');
	}

	return {
		email: locals.principal.user.email ?? ''
	};
};
