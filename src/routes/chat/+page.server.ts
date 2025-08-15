import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get session and user data using the existing pattern from other routes
	const { session, user, role } = await locals.safeGetSession();

	return {
		session,
		user,
		role
	};
};