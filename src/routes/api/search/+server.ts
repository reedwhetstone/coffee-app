import { json } from '@sveltejs/kit';
import { supabase } from '$lib/auth/supabase';

export async function GET({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized');
	}

	const query = url.searchParams.get('q')?.toLowerCase() || '';
	console.log('Search query:', query); // Debug log

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
				name,
				region,
				processing
			`
			)
			.or(`name.ilike.%${query}%,region.ilike.%${query}%,processing.ilike.%${query}%`)
			.limit(5);

		console.log('Green coffee results:', greenCoffeeResults); // Debug log
		if (greenError) throw greenError;

		// Format green coffee results
		const formattedGreenResults =
			greenCoffeeResults?.map((result) => ({
				id: result.id,
				title: result.name,
				description: `Green Coffee - ${result.region || ''}`,
				url: '/',
				type: 'green',
				item_id: result.id
			})) || [];

		// Query for roast profile results
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

		console.log('Roast results:', roastResults); // Debug log
		if (roastError) throw roastError;

		// Format roast results
		const formattedRoastResults =
			roastResults?.map((result) => ({
				id: result.roast_id,
				title: `${result.coffee_name} - ${result.batch_name}`,
				description: 'Roast Profile',
				url: '/ROAST',
				type: 'roast',
				item_id: result.roast_id
			})) || [];

		const allResults = [...formattedGreenResults, ...formattedRoastResults].slice(0, 10);
		console.log('Final results:', allResults); // Debug log
		return json(allResults);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
