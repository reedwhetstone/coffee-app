import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Basic session and role info for client-side rendering
	const { session, user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';
	
	return {
		role,
		user: user ? { id: user.id } : null
	};
};