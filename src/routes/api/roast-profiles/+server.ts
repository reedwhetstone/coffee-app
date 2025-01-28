import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function GET() {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const { data: rows, error } = await supabase.rpc('run_query', {
			query_text: 'SELECT * FROM roast_profiles'
		});

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
				const { data: coffeeExists, error: coffeeError } = await supabase.rpc('run_query', {
					query_text: 'SELECT id, name FROM green_coffee_inv WHERE id = $1',
					query_params: [profileData.coffee_id]
				});

				if (coffeeError) throw coffeeError;
				if (!coffeeExists.length) {
					throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
				}

				// Prepare profile data
				const profile = {
					batch_name:
						profileData.batch_name ||
						`${coffeeExists[0].name} - ${new Date().toLocaleDateString()}`,
					coffee_id: profileData.coffee_id,
					coffee_name: profileData.coffee_name || coffeeExists[0].name,
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

				const query = `
					INSERT INTO roast_profiles (
						batch_name,
						coffee_id,
						coffee_name,
						roast_date,
						last_updated,
						oz_in,
						oz_out,
						roast_notes,
						roast_targets
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
					RETURNING *
				`;

				const { data: newRoast, error } = await supabase.rpc('run_query', {
					query_text: query,
					query_params: [
						profile.batch_name,
						profile.coffee_id,
						profile.coffee_name,
						profile.roast_date,
						profile.last_updated,
						profile.oz_in,
						profile.oz_out,
						profile.roast_notes,
						profile.roast_targets
					]
				});

				if (error) throw error;
				return newRoast[0];
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
			const { error: logError } = await supabase.rpc('run_query', {
				query_text: 'DELETE FROM profile_log WHERE roast_id = $1',
				query_params: [id]
			});
			if (logError) throw logError;

			// Then delete the profile
			const { error: profileError } = await supabase.rpc('run_query', {
				query_text: 'DELETE FROM roast_profiles WHERE roast_id = $1',
				query_params: [id]
			});
			if (profileError) throw profileError;

			return json({ success: true });
		} catch (error) {
			console.error('Error deleting roast profile and associated data:', error);
			return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
		}
	}

	try {
		const { batch_name, roast_date } = await request.json();

		// Delete associated logs first
		const { error: logError } = await supabase.rpc('run_query', {
			query_text: `DELETE FROM profile_log pl USING roast_profiles rp 
						WHERE pl.roast_id = rp.roast_id 
						AND rp.batch_name = $1 AND rp.roast_date = $2`,
			query_params: [batch_name, roast_date]
		});
		if (logError) throw logError;

		// Then delete the profiles
		const { error: profileError } = await supabase.rpc('run_query', {
			query_text: 'DELETE FROM roast_profiles WHERE batch_name = $1 AND roast_date = $2',
			query_params: [batch_name, roast_date]
		});
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

		// Convert object to UPDATE query
		const setClause = Object.keys(updateData)
			.map((key, index) => `${key} = $${index + 1}`)
			.join(', ');
		const values = [...Object.values(updateData), id];

		const { data: updatedRoast, error } = await supabase.rpc('run_query', {
			query_text: `UPDATE roast_profiles SET ${setClause} WHERE roast_id = $${values.length} RETURNING *`,
			query_params: values
		});

		if (error) throw error;

		return new Response(JSON.stringify(updatedRoast[0]), {
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
