import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals);

	return {
		role,
		user: user ? { id: user.id } : null
	};
};
