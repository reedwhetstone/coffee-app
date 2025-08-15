import type { PageServerLoad } from './$types';

interface RoastProfile {
	oz_in: number | null;
	oz_out: number | null;
}

interface CoffeeCatalog {
	name: string;
	score_value: number | null;
	arrival_date: string | null;
	region: string | null;
	processing: string | null;
	drying_method: string | null;
	lot_size: string | null;
	bag_size: string | null;
	packaging: string | null;
	cultivar_detail: string | null;
	grade: string | null;
	appearance: string | null;
	roast_recs: string | null;
	type: string | null;
	description_short: string | null;
	description_long: string | null;
	farm_notes: string | null;
	link: string | null;
	cost_lb: number | null;
	source: string | null;
	stocked: boolean | null;
	cupping_notes: string | null;
	stocked_date: string | null;
	unstocked_date: string | null;
	ai_description: string | null;
	ai_tasting_notes: any;
	public_coffee: boolean | null;
}

interface GreenCoffeeRow {
	id: number;
	rank: number | null;
	notes: string | null;
	purchase_date: string | null;
	purchased_qty_lbs: number | null;
	bean_cost: number | null;
	tax_ship_cost: number | null;
	last_updated: string;
	user: string;
	catalog_id: number | null;
	stocked: boolean | null;
	coffee_catalog?: CoffeeCatalog | null;
	roast_profiles?: RoastProfile[];
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { supabase, safeGetSession } = locals;
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
				coffee_catalog!catalog_id (
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
				),
				roast_profiles!coffee_id (
					oz_in,
					oz_out,
					roast_id,
					batch_name,
					roast_date
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
	const { session, user } = await safeGetSession();
	const role = locals.role || 'viewer';

	if (!session || !user) {
		console.log('Server: No session or user, returning empty data');
		return {
			data: [],
			searchState: Object.fromEntries(url.searchParams.entries()),
			role,
			isShared: false
		};
	}

	// First get the green coffee data
	const { data: greenCoffeeData, error } = await supabase
		.from('green_coffee_inv')
		.select(
			`
			*,
			coffee_catalog!catalog_id (
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
		.eq('user', user.id)
		.order('purchase_date', { ascending: false });

	if (error) {
		console.log('Server: Query error:', error);
		throw error;
	}

	// Separately get roast profiles for all coffee IDs
	const coffeeIds = greenCoffeeData?.map((bean) => bean.id) || [];
	const { data: roastProfilesData, error: roastError } = await supabase
		.from('roast_profiles')
		.select('coffee_id, oz_in, oz_out, roast_id, batch_name, roast_date')
		.in('coffee_id', coffeeIds)
		.eq('user', user.id);

	if (roastError) {
		throw roastError;
	}

	// Manually join roast profiles data
	const cleanData =
		greenCoffeeData?.map((bean) => {
			// Find roast profiles for this coffee
			const profiles = roastProfilesData?.filter((profile) => profile.coffee_id === bean.id) || [];

			return {
				...bean,
				ai_tasting_notes: bean.coffee_catalog?.ai_tasting_notes
					? JSON.stringify(bean.coffee_catalog.ai_tasting_notes)
					: null,
				coffee_catalog: bean.coffee_catalog
					? {
							...bean.coffee_catalog,
							ai_tasting_notes: bean.coffee_catalog.ai_tasting_notes
								? JSON.stringify(bean.coffee_catalog.ai_tasting_notes)
								: null
						}
					: null,
				roast_profiles: profiles.map((profile) => ({
					oz_in: profile.oz_in,
					oz_out: profile.oz_out
				}))
			};
		}) || [];

	return {
		data: cleanData,
		searchState: Object.fromEntries(url.searchParams.entries()),
		role,
		isShared: false
	};
};
