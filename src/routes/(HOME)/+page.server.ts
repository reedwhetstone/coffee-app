import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data, error } = await supabase
		.from('green_coffee_inv')
		.select('*')
		.order('purchase_date', { ascending: false });

	if (error) throw error;

	return { data };
};
