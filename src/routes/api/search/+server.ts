import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const query = url.searchParams.get('q')?.toLowerCase() || '';

	if (!query || query.length < 2) {
		return json([]);
	}

	try {
		const { data: greenCoffeeResults, error: greenError } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				id,
				name,
				region,
				processing
			`
			)
			.or(`name.ilike.%${query}%,region.ilike.%${query}%,processing.ilike.%${query}%`)
			.limit(5);

		if (greenError) {
			return json({ error: greenError.message }, { status: 500 });
		}

		const formattedGreenResults = greenCoffeeResults?.map((result) => ({
			id: result.id,
			title: result.name,
			description: `Green Coffee - ${result.region || ''}`,
			url: '/',
			type: 'green',
			item_id: result.id
		}));

		const { data: roastResults, error: roastError } = await supabase
			.from('roast_profiles')
			.select(
				`
				roast_id,
				coffee_name,
				batch_name,
				roast_notes
			`
			)
			.or(`coffee_name.ilike.%${query}%,batch_name.ilike.%${query}%,roast_notes.ilike.%${query}%`)
			.limit(5);

		if (roastError) {
			return json({ error: roastError.message }, { status: 500 });
		}

		const formattedRoastResults = roastResults?.map((result) => ({
			id: result.roast_id,
			title: `${result.coffee_name} - ${result.batch_name}`,
			description: 'Roast Profile',
			url: '/ROAST',
			type: 'roast',
			item_id: result.roast_id
		}));

		const allResults = [...formattedGreenResults, ...formattedRoastResults].slice(0, 10);
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};
