import type { LayoutServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user, role } = getPageAuthState(locals.principal);
	const ppiAccess = locals.principal.isAuthenticated ? locals.principal.ppiAccess === true : false;

	return {
		auth: {
			isSignedIn: Boolean(session && user),
			user: user
				? {
						id: user.id,
						email: user.email ?? null
					}
				: null,
			role,
			ppiAccess
		}
	};
};
