import type { PageServerLoad } from './$types';
import {
	buildGreenCoffeeQuery,
	processGreenCoffeeData,
	type GreenCoffeeRow
} from '$lib/server/greenCoffeeUtils.js';

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
			let query = buildGreenCoffeeQuery(supabase);

			if (shareData.resource_id === 'all') {
				query = query.eq('user', shareData.user_id);
			} else {
				query = query.eq('id', shareData.resource_id);
			}

			const { data: greenCoffeeData, error } = await query;
			if (error) throw error;

			const processedData = processGreenCoffeeData(greenCoffeeData || []);

			return {
				data: processedData,
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
		return {
			data: [],
			searchState: Object.fromEntries(url.searchParams.entries()),
			role,
			isShared: false
		};
	}

	// Get green coffee data with unified query approach
	const { data: greenCoffeeData, error } = await buildGreenCoffeeQuery(supabase)
		.eq('user', user.id)
		.order('purchase_date', { ascending: false });

	if (error) {
		throw error;
	}

	const processedData = processGreenCoffeeData(greenCoffeeData || []);

	return {
		data: processedData,
		searchState: Object.fromEntries(url.searchParams.entries()),
		role,
		isShared: false
	};
};
