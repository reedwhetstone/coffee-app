import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// First validate the session
	const { session, user } = await locals.safeGetSession();
	const role = locals.role || 'viewer'; // Get role from locals

	try {
		if (!session || !user) {
			return {
				data: [],
				role
			};
		}

		// Fetch roast profiles directly from the database
		const { data: roastProfiles, error } = await locals.supabase
			.from('roast_profiles')
			.select('*')
			.eq('user', user.id)
			.order('roast_date', { ascending: false });

		if (error) {
			console.error('Error fetching roast profiles:', error);
			return {
				data: [],
				role,
				error: 'Failed to fetch roast profiles'
			};
		}

		return {
			data: roastProfiles || [],
			role,
			session,
			user
		};
	} catch (error) {
		console.error('Error in roast page load function:', error);
		return {
			data: [],
			role,
			error: 'An unexpected error occurred while loading roast data'
		};
	}
};
