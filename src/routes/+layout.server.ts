import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session, user, role } = await safeGetSession();

	return {
		session,
		user,
		role,
		cookies: cookies.getAll()
	};
};
