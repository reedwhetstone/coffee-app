import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	// First validate the session
	const { session, user } = await safeGetSession();

	const { data, error } = await supabase
		.from('green_coffee_inv')
		.select('*')
		.order('purchase_date', { ascending: false });

	if (error) throw error;

	return {
		data,
		searchState: Object.fromEntries(url.searchParams.entries()),
		session,
		user
	};
};
