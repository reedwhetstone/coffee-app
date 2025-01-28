import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET() {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const { data: rows, error } = await supabase.rpc('run_query', {
			query_text: `
                SELECT 
                    s.*,
                    g.name as coffee_name,
                    g.purchase_date
                FROM sales s
                LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
                ORDER BY s.sell_date DESC
            `
		});

		if (error) throw error;
		return json(rows);
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch sales data' });
	}
}

export async function PUT({ url, request }) {
	if (!supabase) {
		return json({ error: 'Supabase client is not initialized' }, { status: 500 });
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const updates = await request.json();
		const { coffee_name: _, ...updateData } = updates;

		if (!updateData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		// Convert object to SET clause for PostgreSQL
		const setClause = Object.keys(updateData)
			.map((key, index) => `${key} = $${index + 1}`)
			.join(', ');
		const values = [...Object.values(updateData), id];

		const { data: updatedSale, error } = await supabase.rpc('run_query', {
			query_text: `UPDATE sales SET ${setClause} WHERE id = $${values.length} RETURNING *`,
			query_params: values
		});

		if (error) throw error;

		// Fetch updated sale with coffee name
		const { data: fullSale, error: fetchError } = await supabase.rpc('run_query', {
			query_text: `
				SELECT s.*, g.name as coffee_name, g.purchase_date
				FROM sales s
				LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
				WHERE s.id = $1
			`,
			query_params: [id]
		});

		if (fetchError) throw fetchError;

		return json(fullSale[0]);
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
}

export async function POST({ request }) {
	if (!supabase) {
		return json({ error: 'Supabase client is not initialized' }, { status: 500 });
	}

	try {
		const saleData = await request.json();
		const { coffee_name: _, ...insertData } = saleData;

		if (!insertData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		const columns = Object.keys(insertData).join(', ');
		const placeholders = Object.keys(insertData)
			.map((_, index) => `$${index + 1}`)
			.join(', ');
		const values = Object.values(insertData);

		const { data: result, error } = await supabase.rpc('run_query', {
			query_text: `INSERT INTO sales (${columns}) VALUES (${placeholders}) RETURNING id`,
			query_params: values
		});

		if (error) throw error;

		// Fetch new sale with coffee name
		const { data: newSale, error: fetchError } = await supabase.rpc('run_query', {
			query_text: `
				SELECT s.*, g.name as coffee_name, g.purchase_date
				FROM sales s
				LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
				WHERE s.id = $1
			`,
			query_params: [result[0].id]
		});

		if (fetchError) throw fetchError;

		return json(newSale[0]);
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!supabase) {
		return json({ error: 'Supabase client is not initialized' }, { status: 500 });
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const { error } = await supabase.rpc('run_query', {
			query_text: 'DELETE FROM sales WHERE id = $1',
			query_params: [id]
		});

		if (error) throw error;
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
}
