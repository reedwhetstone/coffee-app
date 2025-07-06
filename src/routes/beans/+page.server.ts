import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const shareToken = url.searchParams.get('share');

	if (shareToken) {
		const { data: shareData } = await supabase
			.from('shared_links')
			.select('user_id, resource_id')
			.eq('share_token', shareToken)
			.eq('is_active', true)
			.gte('expires_at', new Date().toISOString())
			.single();

		if (shareData) {
			let query = supabase.from('green_coffee_inv').select(`
				*,
				coffee_catalog (
					name,
					score_value,
					arrival_date,
					region,
					processing,
					drying_method,
					lot_size,
					bag_size,
					packaging,
					cultivar_detail,
					grade,
					appearance,
					roast_recs,
					type,
					description_short,
					description_long,
					farm_notes,
					link,
					cost_lb,
					source,
					stocked,
					cupping_notes,
					stocked_date,
					unstocked_date,
					ai_description,
					ai_tasting_notes,
					public_coffee
				)
			`);

			if (shareData.resource_id === 'all') {
				query = query.eq('user', shareData.user_id);
			} else {
				query = query.eq('id', shareData.resource_id);
			}

			const { data: greenCoffeeData, error } = await query;
			if (error) throw error;

			return {
				data: greenCoffeeData || [],
				role: 'viewer',
				searchState: Object.fromEntries(url.searchParams.entries()),
				isShared: true
			};
		}

		// Return empty data if share link is invalid
		return {
			data: [],
			role: 'viewer',
			searchState: {},
			isShared: true
		};
	}

	// First validate the session
	const { session, user, role } = await safeGetSession();

	const { data: greenCoffeeData, error } = await supabase
		.from('green_coffee_inv')
		.select(
			`
			*,
			coffee_catalog (
				name,
				score_value,
				arrival_date,
				region,
				processing,
				drying_method,
				lot_size,
				bag_size,
				packaging,
				cultivar_detail,
				grade,
				appearance,
				roast_recs,
				type,
				description_short,
				description_long,
				farm_notes,
				link,
				cost_lb,
				source,
				stocked,
				cupping_notes,
				stocked_date,
				unstocked_date,
				ai_description,
				ai_tasting_notes,
				public_coffee
			)
		`
		)
		.order('purchase_date', { ascending: false });

	if (error) throw error;

	return {
		data: greenCoffeeData || [],
		searchState: Object.fromEntries(url.searchParams.entries()),
		role,
		isShared: false,
		session,
		user
	};
};
