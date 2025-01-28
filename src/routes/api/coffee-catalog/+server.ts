import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET() {
	if (!supabase) {
		console.error('Supabase client check failed:', supabase);
		throw new Error('Supabase client is not initialized.');
	}

	try {
		console.log('Attempting to fetch coffee catalog data...');
		const { data, error } = await supabase
			.from('coffee_catalog')
			.select('*')
			.order('arrival_date', { ascending: false });

		if (error) {
			console.error('Supabase query error:', error);
			throw error;
		}

		console.log('Received data:', data);
		return json({ data: data || [] });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch coffee catalog data' });
	}
}
