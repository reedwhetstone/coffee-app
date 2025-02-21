import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session, user, role } = await safeGetSession();

	return {
		session: session
			? {
					access_token: session.access_token,
					refresh_token: session.refresh_token,
					expires_in: session.expires_in,
					expires_at: session.expires_at,
					user: {
						id: session.user.id,
						email: session.user.email,
						role: session.user.role
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
		cookies: cookies.getAll().map((cookie) => ({
			name: cookie.name,
			value: cookie.value
		}))
	};
};
