import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET() {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const { data: rows, error } = await supabase.from('roast_profiles').select('*');

		if (error) throw error;
		return json({ data: rows });
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
		const data = await request.json();
		const profiles = Array.isArray(data) ? data : [data];

		const results = await Promise.all(
			profiles.map(async (profileData) => {
				if (!profileData.coffee_id) {
					throw new Error('coffee_id is required for all profiles');
				}

				// Check if coffee exists
				const { data: coffee, error: coffeeError } = await supabase
					.from('green_coffee_inv')
					.select('id, name')
					.eq('id', profileData.coffee_id)
					.single();

				if (coffeeError) throw coffeeError;
				if (!coffee) {
					throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
				}

				// Prepare profile data
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
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create roast profiles'
			},
			{ status: 500 }
		);
	}
}

export async function DELETE({ url, request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	const id = url.searchParams.get('id');
	if (id) {
		try {
			// Delete associated logs first
			const { error: logError } = await supabase.from('profile_log').delete().eq('roast_id', id);

			if (logError) throw logError;

			// Then delete the profile
			const { error: profileError } = await supabase
				.from('roast_profiles')
				.delete()
				.eq('roast_id', id);

			if (profileError) throw profileError;

			return json({ success: true });
		} catch (error) {
			console.error('Error deleting roast profile and associated data:', error);
			return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
		}
	}

	try {
		const { batch_name, roast_date } = await request.json();

		// Delete associated logs first using a join
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

		// Then delete the profiles
		const { error: profileError } = await supabase
			.from('roast_profiles')
			.delete()
			.eq('batch_name', batch_name)
			.eq('roast_date', roast_date);

		if (profileError) throw profileError;

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting batch profiles:', error);
		return json({ success: false, error: 'Failed to delete batch profiles' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();
		const { roast_id: _, has_log_data: __, ...updateData } = updates;

		// Format dates for PostgreSQL
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

		const { data: updatedRoast, error } = await supabase
			.from('roast_profiles')
			.update(updateData)
			.eq('roast_id', id)
			.select()
			.single();

		if (error) throw error;

		return new Response(JSON.stringify(updatedRoast), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return new Response(JSON.stringify({ error: 'Failed to update roast profile' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
