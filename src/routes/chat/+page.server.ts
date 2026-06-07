import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get session and user data using the existing pattern from other routes
	const { session, user, role } = await locals.safeGetSession();
	const ppiAccess =
		locals.principal?.isAuthenticated === true ? locals.principal.ppiAccess === true : false;

	return {
		session,
		user,
		role,
		ppiAccess
	};
};
