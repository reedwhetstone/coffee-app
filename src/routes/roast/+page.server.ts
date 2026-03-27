import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals);

	if (!user) {
		return {
			role,
			user: null,
			profiles: []
		};
	}

	const { data: rawProfiles } = await locals.supabase
		.from('roast_profiles')
		.select('*, green_coffee_inv!coffee_id ( coffee_catalog!catalog_id ( wholesale ) )')
		.eq('user', user.id)
		.order('roast_date', { ascending: false });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const profiles = (rawProfiles ?? []).map((row: any) => {
		const inv = row.green_coffee_inv;
		const catalog = inv?.coffee_catalog;
		const wholesale = Array.isArray(catalog) ? catalog[0]?.wholesale : catalog?.wholesale;
		const { green_coffee_inv: _, ...profile } = row;
		return { ...profile, is_wholesale: wholesale === true };
	});

	return {
		role,
		user: { id: user.id },
		profiles
	};
};
