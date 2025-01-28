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
		let query = supabase.from('green_coffee_inv').select('*');

		if (id) {
			query = query.eq('id', id);
		}

		//console.log('Executing Supabase query for table:', 'green_coffee_inv');
		//console.log('Query filter:', id ? `id = ${id}` : 'none');

		const { data: rows, error } = await query;

		//	console.log('Supabase response:', { rows, error });

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

		const { data: newBean, error } = await supabase
			.from('green_coffee_inv')
			.insert({
				name: bean.name,
				rank: bean.rank,
				notes: bean.notes,
				purchase_date: bean.purchase_date,
				purchased_qty_lbs: bean.purchased_qty_lbs,
				bean_cost: bean.bean_cost,
				tax_ship_cost: bean.tax_ship_cost,
				link: bean.link,
				last_updated: bean.last_updated
			})
			.select()
			.single();

		if (error) throw error;

		return json(newBean);
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
		// Get roast profiles first
		const { data: roastProfiles, error: selectError } = await supabase
			.from('roast_profiles')
			.select('roast_id')
			.eq('coffee_id', id);

		if (selectError) throw selectError;

		// If there are roast profiles, delete their logs
		if (roastProfiles && roastProfiles.length > 0) {
			const roastIds = roastProfiles.map((profile) => profile.roast_id);
			const { error: logError } = await supabase
				.from('profile_log')
				.delete()
				.in('roast_id', roastIds);

			if (logError) throw logError;
		}

		// Delete roast profiles
		const { error: profileError } = await supabase
			.from('roast_profiles')
			.delete()
			.eq('coffee_id', id);

		if (profileError) throw profileError;

		// Finally, delete the coffee
		const { error: deleteError } = await supabase.from('green_coffee_inv').delete().eq('id', id);

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

		//	console.log('PUT request - ID:', id);
		//	console.log('PUT request - Update data:', updateData);

		// First, verify the record exists
		const { data: existingBean, error: checkError } = await supabase
			.from('green_coffee_inv')
			.select('id')
			.eq('id', id)
			.single();

		if (checkError) {
			console.log('Error checking for existing bean:', checkError);
			throw checkError;
		}

		if (!existingBean) {
			console.log(`No bean found with ID ${id}`);
			return json({ success: false, error: 'Bean not found' }, { status: 404 });
		}

		const { data: updatedBeans, error } = await supabase
			.from('green_coffee_inv')
			.update(updateData)
			.eq('id', id)
			.select();

		if (error) throw error;

		if (!updatedBeans || updatedBeans.length === 0) {
			return json({ success: false, error: 'Update failed' }, { status: 500 });
		}

		return json(updatedBeans[0]);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
}
