import type { LayoutServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user, role } = getPageAuthState(locals);
	const ppiAccess =
		locals.principal?.isAuthenticated === true ? locals.principal.ppiAccess === true : false;

	return {
		session:
			session && user
				? {
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						expires_in: session.expires_in,
						expires_at: session.expires_at,
						user: {
							id: user.id,
							email: user.email,
							role: user.role
						}
					}
				: null,
		user: user
			? {
					id: user.id,
					email: user.email,
					role: user.role
				}
			: null,
		role,
		ppiAccess
	};
};
