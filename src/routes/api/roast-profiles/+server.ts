import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { data, error } = await supabase
			.from('roast_profiles')
			.select('*')
			.eq('user', user.id)
			.order('roast_date', { ascending: false });

		if (error) throw error;
		return json({ data });
	} catch (error) {
		console.error('Error fetching roast profiles:', error);
		return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

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
					...profileData,
					user: user.id,
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
		return json({ error: 'Failed to create roast profiles' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		const batchName = url.searchParams.get('name');

		if (id) {
			// Verify ownership
			const { data: existing } = await supabase
				.from('roast_profiles')
				.select('user')
				.eq('roast_id', id)
				.single();

			if (!existing || existing.user !== user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}

			// Delete associated logs first
			await supabase.from('profile_log').delete().eq('roast_id', id);
			// Then delete the profile
			await supabase.from('roast_profiles').delete().eq('roast_id', id).eq('user', user.id);
		} else if (batchName) {
			// Get all profile IDs in the batch that belong to the user
			const { data: profiles } = await supabase
				.from('roast_profiles')
				.select('roast_id')
				.eq('batch_name', batchName)
				.eq('user', user.id);

			if (profiles && profiles.length > 0) {
				const roastIds = profiles.map((p: { roast_id: number }) => p.roast_id);
				// Delete associated logs first
				await supabase.from('profile_log').delete().in('roast_id', roastIds);
				// Then delete all profiles in the batch
				await supabase
					.from('roast_profiles')
					.delete()
					.eq('batch_name', batchName)
					.eq('user', user.id);
			}
		} else {
			return json({ error: 'No ID or batch name provided' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting roast profile(s):', error);
		const message = error instanceof Error ? error.message : 'Failed to delete roast profile(s)';
		return json({ error: message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({
	request,
	url,
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

		const data = await request.json();

		// Verify ownership
		const { data: existing } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const { data: updated, error } = await supabase
			.from('roast_profiles')
			.update(data)
			.eq('roast_id', id)
			.eq('user', user.id)
			.select()
			.single();

		if (error) throw error;
		return json(updated);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
