// src/lib/server/db.ts
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export async function query(query: string, params?: any[]) {
	try {
		const { data, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: params
		});

		if (error) throw error;
		return { rows: data };
	} catch (error) {
		console.error('Database query error:', error);
		throw error;
	}
}

export { supabase };
