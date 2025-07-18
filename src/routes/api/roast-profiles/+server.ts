import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';

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

		const requestData = await request.json();

		// Handle both single profiles and batch creation
		if (requestData.batch_beans) {
			// Batch creation from form
			const { batch_name, batch_beans, roast_date, roast_notes, roast_targets } = requestData;

			// Validate all beans have coffee_id
			for (const bean of batch_beans) {
				if (!bean.coffee_id) {
					throw new Error('coffee_id is required for all beans in batch');
				}
			}

			// Fetch all coffee data in single query to avoid N+1 problem
			const coffeeIds = batch_beans.map((bean: any) => bean.coffee_id);
			const { data: coffees, error: coffeeError } = await supabase
				.from('green_coffee_inv')
				.select(
					`
					id,
					coffee_catalog!catalog_id (
						name
					)
				`
				)
				.in('id', coffeeIds)
				.eq('user', user.id);

			if (coffeeError) throw coffeeError;
			if (!coffees || coffees.length === 0) {
				throw new Error('No valid coffee_ids found for this user');
			}
			if (coffees.length !== batch_beans.length) {
				const foundIds = coffees.map(c => c.id);
				const missingIds = coffeeIds.filter((id: number) => !foundIds.includes(id));
				throw new Error(`Coffee IDs not found or not owned by user: ${missingIds.join(', ')}`);
			}

			// Create lookup map for efficient access
			const coffeeMap = new Map(coffees.map(coffee => [coffee.id, coffee]));

			// Create profiles with coffee data from map
			const profilesData = batch_beans.map((bean: any) => {
				const coffee = coffeeMap.get(bean.coffee_id);
				if (!coffee || !coffee.coffee_catalog) {
					throw new Error(`Invalid coffee_id - coffee not found: ${bean.coffee_id}`);
				}

				return {
					user: user.id,
					batch_name:
						batch_name || `${coffee.coffee_catalog.name} - ${new Date().toLocaleDateString()}`,
					coffee_id: bean.coffee_id,
					coffee_name: bean.coffee_name || coffee.coffee_catalog.name,
					roast_date: roast_date
						? new Date(roast_date).toISOString().slice(0, 19).replace('T', ' ')
						: new Date().toISOString().slice(0, 19).replace('T', ' '),
					last_updated: new Date().toISOString().slice(0, 19).replace('T', ' '),
					oz_in: bean.oz_in || null,
					oz_out: bean.oz_out || null,
					roast_notes: roast_notes || null,
					roast_targets: roast_targets || null
				};
			});

			// Insert all profiles in batch
			const { data: profiles, error } = await supabase
				.from('roast_profiles')
				.insert(profilesData)
				.select();

			if (error) throw error;

			// Update stocked status for all affected coffees
			await Promise.all(
				coffeeIds.map((coffee_id: number) => updateStockedStatus(supabase, coffee_id, user.id))
			);

			// Return in format expected by form
			return json({
				profiles,
				roast_ids: profiles.map((p) => p.roast_id)
			});
		} else {
			// Single profile creation (legacy support)
			const profiles = Array.isArray(requestData) ? requestData : [requestData];

			// Validate all profiles have coffee_id
			for (const profileData of profiles) {
				if (!profileData.coffee_id) {
					throw new Error('coffee_id is required for all profiles');
				}
			}

			// Fetch all coffee data in single query to avoid N+1 problem
			const coffeeIds = profiles.map((profileData: any) => profileData.coffee_id);
			const { data: coffees, error: coffeeError } = await supabase
				.from('green_coffee_inv')
				.select(
					`
					id,
					coffee_catalog!catalog_id (
						name
					)
				`
				)
				.in('id', coffeeIds)
				.eq('user', user.id);

			if (coffeeError) throw coffeeError;
			if (!coffees || coffees.length === 0) {
				throw new Error('No valid coffee_ids found for this user');
			}
			if (coffees.length !== profiles.length) {
				const foundIds = coffees.map(c => c.id);
				const missingIds = coffeeIds.filter((id: number) => !foundIds.includes(id));
				throw new Error(`Coffee IDs not found or not owned by user: ${missingIds.join(', ')}`);
			}

			// Create lookup map for efficient access
			const coffeeMap = new Map(coffees.map(coffee => [coffee.id, coffee]));

			// Create profiles with coffee data from map
			const profilesData = profiles.map((profileData: any) => {
				const coffee = coffeeMap.get(profileData.coffee_id);
				if (!coffee || !coffee.coffee_catalog) {
					throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
				}

				return {
					...profileData,
					user: user.id,
					batch_name:
						profileData.batch_name ||
						`${coffee.coffee_catalog.name} - ${new Date().toLocaleDateString()}`,
					coffee_id: profileData.coffee_id,
					coffee_name: profileData.coffee_name || coffee.coffee_catalog.name,
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
			});

			// Insert all profiles in batch
			const { data: results, error } = await supabase
				.from('roast_profiles')
				.insert(profilesData)
				.select();

			if (error) throw error;

			// Update stocked status for all affected coffees
			await Promise.all(
				coffeeIds.map((coffee_id: number) => updateStockedStatus(supabase, coffee_id, user.id))
			);

			return json(results);
		}
	} catch (error) {
		console.error('Error creating roast profiles:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create roast profiles' },
			{ status: 500 }
		);
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
			// Verify ownership and get coffee_id for stocked status update
			const { data: existing } = await supabase
				.from('roast_profiles')
				.select('user, coffee_id')
				.eq('roast_id', id)
				.single();

			if (!existing || existing.user !== user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}

			const coffee_id = existing.coffee_id;

			// Delete associated logs first
			await supabase.from('profile_log').delete().eq('roast_id', id);
			// Then delete the profile
			await supabase.from('roast_profiles').delete().eq('roast_id', id).eq('user', user.id);

			// Update stocked status for this coffee after deletion
			await updateStockedStatus(supabase, coffee_id, user.id);
		} else if (batchName) {
			// Get all profile IDs and coffee_ids in the batch that belong to the user
			const { data: profiles } = await supabase
				.from('roast_profiles')
				.select('roast_id, coffee_id')
				.eq('batch_name', batchName)
				.eq('user', user.id);

			if (profiles && profiles.length > 0) {
				const roastIds = profiles.map((p: { roast_id: number; coffee_id: number }) => p.roast_id);
				const coffeeIds = [
					...new Set(profiles.map((p: { roast_id: number; coffee_id: number }) => p.coffee_id))
				];

				// Delete associated logs first
				await supabase.from('profile_log').delete().in('roast_id', roastIds);
				// Then delete all profiles in the batch
				await supabase
					.from('roast_profiles')
					.delete()
					.eq('batch_name', batchName)
					.eq('user', user.id);

				// Update stocked status for all affected coffees after batch deletion
				for (const coffee_id of coffeeIds) {
					await updateStockedStatus(supabase, coffee_id, user.id);
				}
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

		// Verify ownership and get coffee_id for stocked status update
		const { data: existing } = await supabase
			.from('roast_profiles')
			.select('user, coffee_id')
			.eq('roast_id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const coffee_id = existing.coffee_id;

		const { data: updated, error } = await supabase
			.from('roast_profiles')
			.update(data)
			.eq('roast_id', id)
			.eq('user', user.id)
			.select()
			.single();

		if (error) throw error;

		// Update stocked status for this coffee after updating roast profile
		await updateStockedStatus(supabase, coffee_id, user.id);

		return json(updated);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
