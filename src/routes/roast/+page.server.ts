import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	if (!user) {
		return {
			role,
			user: null,
			profiles: []
		};
	}

	const { data: profiles } = await locals.supabase
		.from('roast_profiles')
		.select('*')
		.eq('user', user.id)
		.order('roast_date', { ascending: false });

	return {
		role,
		user: { id: user.id },
		profiles: profiles ?? []
	};
};
