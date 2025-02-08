import { createSupabaseLoadClient } from '$lib/supabase';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	const supabase = createSupabaseLoadClient();

	return {
		supabase,
		session: data.session,
		role: data.role,
		user: data.user
	};
};
