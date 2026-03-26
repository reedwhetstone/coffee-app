import type { LayoutServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { session, user, role } = getPageAuthState(locals);

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
		cookies: cookies.getAll().map((cookie: { name: string; value: string }) => ({
			name: cookie.name,
			value: cookie.value
		}))
	};
};
