import { json } from '@sveltejs/kit';
import { requireUserAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		// If share token is provided, verify it and show shared data
		if (shareToken) {
			const { data: shareData } = await locals.supabase
				.from('shared_links')
				.select('user_id, resource_id')
				.eq('share_token', shareToken)
				.eq('is_active', true)
				.gte('expires_at', new Date().toISOString())
				.single();

			if (shareData) {
				let query = locals.supabase
					.from('roast_profiles')
					.select('*')
					.order('roast_date', { ascending: false });

				// Show only the shared roast or all roasts from the user
				if (shareData.resource_id === 'all') {
					query = query.eq('user', shareData.user_id);
				} else {
					query = query.eq('roast_id', shareData.resource_id);
				}

				const { data: rows, error } = await query;
				if (error) throw error;

				return json({
					data: rows || [],
					searchState: Object.fromEntries(url.searchParams.entries())
				});
			} else {
				return json({ data: [] });
			}
		} else {
			// Standard user authentication - all users (including admins) see only their own data
			const sessionData = await locals.safeGetSession();
			const { session, user } = sessionData as { session: any; user: any };

			if (!session || !user) {
				return json({ data: [] });
			}

			let query = locals.supabase
				.from('roast_profiles')
				.select('*')
				.eq('user', user.id)
				.order('roast_date', { ascending: false });

			if (id) {
				query = query.eq('roast_id', id);
			}

			const { data: rows, error } = await query;
			if (error) throw error;

			return json({
				data: rows || [],
				searchState: Object.fromEntries(url.searchParams.entries())
			});
		}
	} catch (error) {
		console.error('Error querying roast profiles:', error);
		return json({ data: [], error: 'Failed to fetch roast profiles' });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireUserAuth(event);
		const { supabase } = event.locals;

		const roastProfile = await event.request.json();

		// Clean and prepare the roast profile data for insertion
		const validColumns = [
			'coffee_id',
			'roast_date',
			'batch_name',
			'coffee_name',
			'roast_notes',
			'roast_targets',
			'oz_in',
			'oz_out',
			'roast_time',
			'drop_temp',
			'first_crack_start',
			'first_crack_end',
			'second_crack_start',
			'development_time_ratio',
			'weight_loss_percent'
		];

		const cleanedProfile: { [key: string]: any } = {
			user: user.id,
			created_at: new Date().toISOString()
		};

		// Add only valid columns
		validColumns.forEach((field) => {
			if (roastProfile[field] !== undefined) {
				cleanedProfile[field] = roastProfile[field];
			}
		});

		const { data: newProfile, error } = await supabase
			.from('roast_profiles')
			.insert(cleanedProfile)
			.select()
			.single();

		if (error) throw error;

		return json(newProfile);
	} catch (error) {
		console.error('Error creating roast profile:', error);
		return json({ error: 'Failed to create roast profile' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireUserAuth(event);
		const { supabase } = event.locals;
		const { url, request } = event;

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updates = await request.json();
		const { roast_id: _, ...rawUpdateData } = updates;

		// Filter to only include actual roast_profiles table columns
		const validColumns = [
			'coffee_id',
			'roast_date',
			'batch_name',
			'coffee_name',
			'roast_notes',
			'roast_targets',
			'oz_in',
			'oz_out',
			'roast_time',
			'drop_temp',
			'first_crack_start',
			'first_crack_end',
			'second_crack_start',
			'development_time_ratio',
			'weight_loss_percent',
			'user'
		];

		const updateData = Object.fromEntries(
			Object.entries(rawUpdateData).filter(([key]) => validColumns.includes(key))
		);

		// Update the roast profile
		const { error: updateError } = await supabase
			.from('roast_profiles')
			.update(updateData)
			.eq('roast_id', id);

		if (updateError) {
			console.error('Update error:', updateError);
			throw updateError;
		}

		// Fetch the updated data
		const { data: updatedProfile } = await supabase
			.from('roast_profiles')
			.select('*')
			.eq('roast_id', id)
			.single();

		return json(updatedProfile);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ success: false, error: 'Failed to update roast profile' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireUserAuth(event);
		const { supabase } = event.locals;
		const { url } = event;

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Delete associated data first
		const { error: tempError } = await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', id);
		if (tempError) throw tempError;

		const { error: eventError } = await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', id);
		if (eventError) throw eventError;

		// Finally, delete the roast profile
		const { error: deleteError } = await supabase
			.from('roast_profiles')
			.delete()
			.eq('roast_id', id);

		if (deleteError) throw deleteError;

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting roast profile and associated data:', error);
		return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
	}
};