// src/routes/api/data/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface GreenCoffeeRow {
	purchase_date: string | null;
	[key: string]: any;
}

interface RoastProfile {
	roast_id: string;
}

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	try {
		const id = url.searchParams.get('id');
		let query = supabase.from('green_coffee_inv').select('*');

		if (id) {
			query = query.eq('id', id);
		}

		const { data: rows, error } = await query;

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
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const bean = await request.json();
		const { data: newBean, error } = await supabase
			.from('green_coffee_inv')
			.insert({
				...bean,
				user_id: user.id
			})
			.select()
			.single();

		if (error) throw error;
		return json(newBean);
	} catch (error) {
		console.error('Error creating bean:', error);
		return json({ success: false, error: 'Failed to create bean' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabase
			.from('green_coffee_inv')
			.select('user_id')
			.eq('id', id)
			.single();

		if (!existing || existing.user_id !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Get roast profiles first
		const { data: roastProfiles, error: selectError } = await supabase
			.from('roast_profiles')
			.select('roast_id')
			.eq('coffee_id', id);

		if (selectError) throw selectError;

		// If there are roast profiles, delete their logs
		if (roastProfiles && roastProfiles.length > 0) {
			const roastIds = roastProfiles.map((profile: RoastProfile) => profile.roast_id);
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
};

export const PUT: RequestHandler = async ({
	url,
	request,
	locals: { supabase, safeGetSession }
}) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabase
			.from('green_coffee_inv')
			.select('user_id')
			.eq('id', id)
			.single();

		if (!existing || existing.user_id !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updates = await request.json();
		const { id: _, ...updateData } = updates;

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
};
