import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals.principal);

	if (!user) {
		return {
			role,
			user: null
		};
	}

	return {
		role,
		user: { id: user.id }
	};
};
