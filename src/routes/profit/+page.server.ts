import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	return {
		role,
		user: user ? { id: user.id } : null
	};
};
