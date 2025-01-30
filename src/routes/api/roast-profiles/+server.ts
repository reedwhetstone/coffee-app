import { createServerSupabaseClient } from '$lib/supabase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	try {
		const { data, error } = await supabase.from('roast_profiles').select('*');

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}
		return json({ data });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	try {
		const data = await request.json();
		const profiles = Array.isArray(data) ? data : [data];

		const results = await Promise.all(
			profiles.map(async (profileData) => {
				if (!profileData.coffee_id) {
					throw new Error('coffee_id is required for all profiles');
				}

				const { data: coffee, error: coffeeError } = await supabase
					.from('green_coffee_inv')
					.select('id, name')
					.eq('id', profileData.coffee_id)
					.single();

				if (coffeeError) throw coffeeError;
				if (!coffee) {
					throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
				}

				const profile = {
					batch_name:
						profileData.batch_name || `${coffee.name} - ${new Date().toLocaleDateString()}`,
					coffee_id: profileData.coffee_id,
					coffee_name: profileData.coffee_name || coffee.name,
					roast_date: profileData.roast_date
						? new Date(profileData.roast_date).toISOString().slice(0, 19).replace('T', ' ')
						: new Date().toISOString().slice(0, 19).replace('T', ' '),
					last_updated: profileData.last_updated
						? new Date(profileData.last_updated).toISOString().slice(0, 19).replace('T', ' ')
						: new Date().toISOString().slice(0, 19).replace('T', ' '),
					oz_in: profileData.oz_in || null,
					oz_out: profileData.oz_out || null,
					roast_notes: profileData.roast_notes || null,
					roast_targets: profileData.roast_targets || null
				};

				const { data: newRoast, error } = await supabase
					.from('roast_profiles')
					.insert(profile)
					.select()
					.single();

				if (error) throw error;
				return newRoast;
			})
		);

		return json(results);
	} catch (error) {
		console.error('Error creating roast profiles:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create roast profiles'
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url, request, cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });
	const id = url.searchParams.get('id');

	if (id) {
		try {
			const { error: logError } = await supabase.from('profile_log').delete().eq('roast_id', id);
			if (logError) throw logError;

			const { error: profileError } = await supabase
				.from('roast_profiles')
				.delete()
				.eq('roast_id', id);

			if (profileError) throw profileError;
			return json({ success: true });
		} catch (error) {
			console.error('Error deleting roast profile and associated data:', error);
			return json({ error: 'Failed to delete roast profile' }, { status: 500 });
		}
	}

	try {
		const { batch_name, roast_date } = await request.json();

		const { error: logError } = await supabase
			.from('profile_log')
			.delete()
			.eq(
				'roast_id',
				supabase
					.from('roast_profiles')
					.select('roast_id')
					.eq('batch_name', batch_name)
					.eq('roast_date', roast_date)
			);

		if (logError) throw logError;

		const { error: profileError } = await supabase
			.from('roast_profiles')
			.delete()
			.eq('batch_name', batch_name)
			.eq('roast_date', roast_date);

		if (profileError) throw profileError;

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting batch profiles:', error);
		return json({ error: 'Failed to delete batch profiles' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ url, request, cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { roast_id: _, has_log_data: __, ...updateData } = updates;

		if (updateData.roast_date) {
			updateData.roast_date = new Date(updateData.roast_date)
				.toISOString()
				.slice(0, 19)
				.replace('T', ' ');
		}
		if (updateData.last_updated) {
			updateData.last_updated = new Date(updateData.last_updated)
				.toISOString()
				.slice(0, 19)
				.replace('T', ' ');
		}

		const { data, error } = await supabase
			.from('roast_profiles')
			.update(updateData)
			.eq('roast_id', id)
			.select()
			.single();

		if (error) throw error;

		return json(data);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
