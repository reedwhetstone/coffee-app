// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

interface GreenCoffeeRow {
	purchase_date: string | null;
	[key: string]: any;
}

interface RoastProfile {
	roast_id: number;
}

export async function GET({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const id = url.searchParams.get('id');
		let query = 'SELECT * FROM green_coffee_inv';
		let params = [];

		if (id) {
			query += ' WHERE id = $1';
			params.push(id);
		}

		const { data: rows, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: params
		});

		if (error) throw error;

		const formattedRows = rows.map((row: GreenCoffeeRow) => ({
			...row,
			purchase_date: row.purchase_date ? row.purchase_date.split('T')[0] : null
		}));
		return json({ data: formattedRows });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch data' });
	}
}

export async function POST({ request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const bean = await request.json();

		const query = `
			INSERT INTO green_coffee_inv (
				name, 
				"rank",
				notes, 
				purchase_date, 
				purchased_qty_lbs, 
				bean_cost, 
				tax_ship_cost, 
				link,
				last_updated
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING *`;

		const values = [
			bean.name,
			bean.rank,
			bean.notes,
			bean.purchase_date,
			bean.purchased_qty_lbs,
			bean.bean_cost,
			bean.tax_ship_cost,
			bean.link,
			bean.last_updated
		];

		const { data: newBean, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: values
		});

		if (error) throw error;

		return json(newBean[0]);
	} catch (error) {
		console.error('Error creating bean:', error);
		return json({ success: false, error: 'Failed to create bean' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	const id = url.searchParams.get('id');

	if (!id) {
		return json({ success: false, error: 'No ID provided' }, { status: 400 });
	}

	try {
		// Start a transaction
		const transactionQueries = [
			{
				query: 'SELECT roast_id FROM roast_profiles WHERE coffee_id = $1',
				params: [id]
			},
			{
				query: 'DELETE FROM profile_log WHERE roast_id = ANY($1)',
				params: [] // Will be populated after first query
			},
			{
				query: 'DELETE FROM roast_profiles WHERE coffee_id = $1',
				params: [id]
			},
			{
				query: 'DELETE FROM green_coffee_inv WHERE id = $1',
				params: [id]
			}
		];

		// Execute first query to get roast_ids
		const { data: roastProfiles, error: selectError } = await supabase.rpc('run_query', {
			query_text: transactionQueries[0].query,
			query_params: transactionQueries[0].params
		});

		if (selectError) throw selectError;

		// If there are roast profiles, delete their logs
		if (roastProfiles.length > 0) {
			const roastIds = roastProfiles.map((profile: RoastProfile) => profile.roast_id);
			transactionQueries[1].params = [roastIds];

			const { error: logError } = await supabase.rpc('run_query', {
				query_text: transactionQueries[1].query,
				query_params: transactionQueries[1].params
			});

			if (logError) throw logError;
		}

		// Delete roast profiles
		const { error: profileError } = await supabase.rpc('run_query', {
			query_text: transactionQueries[2].query,
			query_params: transactionQueries[2].params
		});

		if (profileError) throw profileError;

		// Finally, delete the coffee
		const { error: deleteError } = await supabase.rpc('run_query', {
			query_text: transactionQueries[3].query,
			query_params: transactionQueries[3].params
		});

		if (deleteError) throw deleteError;

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting bean and associated data:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { id: _, ...updateData } = updates;

		// Convert object to SET clause and values array
		const setEntries = Object.entries(updateData);
		const setClause = setEntries.map((entry, index) => `"${entry[0]}" = $${index + 1}`).join(', ');
		const values = [...setEntries.map(([_, value]) => value), id];

		const query = `
			UPDATE green_coffee_inv 
			SET ${setClause} 
			WHERE id = $${values.length} 
			RETURNING *`;

		const { data: updatedBean, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: values
		});

		if (error) throw error;

		if (!updatedBean[0]) {
			return json({ success: false, error: 'Bean not found' }, { status: 404 });
		}

		return json(updatedBean[0]);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
}
