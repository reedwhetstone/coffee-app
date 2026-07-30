import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals.principal);

	return {
		role,
		user: user ? { id: user.id } : null
	};
};
