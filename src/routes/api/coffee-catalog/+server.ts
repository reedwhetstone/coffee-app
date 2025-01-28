import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET() {
	if (!supabase) {
		console.error('Supabase client check failed:', supabase);
		throw new Error('Supabase client is not initialized.');
	}
	console.log('Supabase client:', !!supabase);

	try {
		console.log('Attempting to fetch coffee catalog data...');
		const { data: rows, error } = await supabase
			.from('coffee_catalog')
			.select('*')
			.order('arrival_date', { ascending: false });

		console.log('Direct query response:', rows);

		if (error) {
			console.error('Supabase query error:', error);
			throw error;
		}

		return json({ data: rows || [] });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch coffee catalog data' });
	}
}
