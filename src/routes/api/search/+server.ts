import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized');
	}

	const query = url.searchParams.get('q')?.toLowerCase() || '';

	if (!query || query.length < 2) {
		return json([]);
	}

	try {
		// Query for green coffee results
		const { data: greenCoffeeResults, error: greenError } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				id,
				title:name,
				description:region,
				url:raw(''),
				type:raw('green'),
				item_id:id
			`
			)
			.or(`name.ilike.%${query}%,region.ilike.%${query}%,processing.ilike.%${query}%`)
			.limit(5);

		if (greenError) throw greenError;

		// Format green coffee results
		const formattedGreenResults =
			greenCoffeeResults?.map((result: Record<string, any>) => ({
				id: result.id,
				title: result.title,
				description: `Green Coffee - ${result.description || ''}`,
				url: '/',
				type: result.type,
				item_id: result.item_id
			})) || [];

		// Query for roast profile results
		const { data: roastResults, error: roastError } = await supabase
			.from('roast_profiles')
			.select(
				`
				id:roast_id,
				coffee_name,
				batch_name,
				title:coffee_name,
				description:raw('Roast Profile'),
				url:raw('/ROAST'),
				type:raw('roast'),
				item_id:roast_id
			`
			)
			.or(`coffee_name.ilike.%${query}%,batch_name.ilike.%${query}%,roast_notes.ilike.%${query}%`)
			.limit(5);

		if (roastError) throw roastError;

		// Format roast results
		const formattedRoastResults =
			roastResults?.map((result: Record<string, any>) => ({
				id: result.id,
				coffee_name: result.coffee_name,
				batch_name: result.batch_name,
				title: `${result.coffee_name} - ${result.batch_name}`,
				description: result.description,
				url: result.url,
				type: result.type,
				item_id: result.item_id
			})) || [];

		const allResults = [...formattedGreenResults, ...formattedRoastResults].slice(0, 10);
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
