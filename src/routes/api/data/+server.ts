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

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		let query = supabase.from('green_coffee_inv').select(`
			*,
			coffee_catalog!catalog_id (
				name,
				score_value,
				arrival_date,
				region,
				processing,
				drying_method,
				lot_size,
				bag_size,
				packaging,
				cultivar_detail,
				grade,
				appearance,
				roast_recs,
				type,
				description_short,
				description_long,
				farm_notes,
				link,
				cost_lb,
				source,
				stocked,
				cupping_notes,
				stocked_date,
				unstocked_date,
				ai_description,
				ai_tasting_notes,
				public_coffee
			)
		`);

		// If share token is provided, verify it and show shared data
		if (shareToken) {
			const { data: shareData } = await supabase
				.from('shared_links')
				.select('user_id, resource_id')
				.eq('share_token', shareToken)
				.eq('is_active', true)
				.gte('expires_at', new Date().toISOString())
				.single();

			if (shareData) {
				// Show only the shared bean or all beans from the user
				if (shareData.resource_id === 'all') {
					query = query.eq('user', shareData.user_id);
				} else {
					query = query.eq('id', shareData.resource_id);
				}
			} else {
				return json({ data: [] });
			}
		} else {
			// Regular authorization logic
			const sessionData = await safeGetSession();
			const { session, user, role } = sessionData as { session: any; user: any; role: string };
			if (role !== 'admin') {
				if (session && user) {
					query = query.eq('user', user.id);
				} else {
					return json({ data: [] });
				}
			}
			if (id) {
				query = query.eq('id', id);
			}
		}

		const { data: rows, error } = await query;
		if (error) throw error;

		// Get roast profiles for the coffee data (only if we have data and user)
		let enrichedData = rows || [];
		if (rows && rows.length > 0) {
			const { session, user } = await safeGetSession();
			if (user) {
				const coffeeIds = rows.map((bean) => bean.id);
				const { data: roastProfilesData } = await supabase
					.from('roast_profiles')
					.select('coffee_id, oz_in, oz_out')
					.in('coffee_id', coffeeIds)
					.eq('user', user.id);

				// Manually join roast profiles data
				enrichedData = rows.map((bean) => {
					const profiles =
						roastProfilesData?.filter((profile) => profile.coffee_id === bean.id) || [];
					return {
						...bean,
						roast_profiles: profiles.map((profile) => ({
							oz_in: profile.oz_in,
							oz_out: profile.oz_out
						}))
					};
				});
			}
		}

		return json({
			data: enrichedData,
			searchState: Object.fromEntries(url.searchParams.entries())
		});
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
		let catalogId = bean.catalog_id;

		// If this is a manual entry (no catalog_id but has manual_name), create catalog entry first
		if (!catalogId && bean.manual_name) {
			const catalogData: { [key: string]: any } = {
				name: bean.manual_name,
				coffee_user: user.id,
				public_coffee: false,
				last_updated: new Date().toISOString().split('T')[0] // date format
			};

			// Add optional catalog fields if they exist
			const optionalCatalogFields = [
				'region',
				'processing',
				'drying_method',
				'roast_recs',
				'lot_size',
				'bag_size',
				'packaging',
				'cultivar_detail',
				'grade',
				'appearance',
				'description_short',
				'farm_notes',
				'type',
				'description_long',
				'cost_lb',
				'source',
				'cupping_notes',
				'arrival_date',
				'score_value',
				'ai_description',
				'ai_tasting_notes'
			];

			optionalCatalogFields.forEach((field) => {
				if (bean[field] !== undefined && bean[field] !== null && bean[field] !== '') {
					catalogData[field] = bean[field];
				}
			});

			const { data: newCatalogEntry, error: catalogError } = await supabase
				.from('coffee_catalog')
				.insert(catalogData)
				.select('id')
				.single();

			if (catalogError) {
				console.error('Error creating catalog entry:', catalogError);
				return json({ error: 'Failed to create catalog entry' }, { status: 500 });
			}

			catalogId = newCatalogEntry.id;
		}

		// Clean and prepare the green_coffee_inv data for insertion
		const validInventoryColumns = [
			'rank',
			'notes',
			'purchase_date',
			'purchased_qty_lbs',
			'bean_cost',
			'tax_ship_cost',
			'stocked',
			'cupping_notes'
		];

		const cleanedBean: { [key: string]: any } = {
			user: user.id,
			catalog_id: catalogId,
			last_updated: new Date().toISOString(),
			// Ensure numeric fields are properly formatted
			tax_ship_cost:
				typeof bean.tax_ship_cost === 'number' ? parseFloat(bean.tax_ship_cost.toFixed(2)) : 0.0,
			bean_cost: typeof bean.bean_cost === 'number' ? parseFloat(bean.bean_cost.toFixed(2)) : 0.0
		};

		// Add only valid inventory columns
		validInventoryColumns.forEach((field) => {
			if (bean[field] !== undefined) {
				cleanedBean[field] = bean[field];
			}
		});

		// If this bean references a catalog item, verify it exists
		if (catalogId) {
			const { data: catalogBean, error: catalogError } = await supabase
				.from('coffee_catalog')
				.select('id')
				.eq('id', catalogId)
				.single();

			if (catalogError || !catalogBean) {
				return json({ error: 'Invalid catalog reference' }, { status: 400 });
			}
		}

		const { data: newBean, error } = await supabase
			.from('green_coffee_inv')
			.insert(cleanedBean)
			.select(
				`
				*,
				coffee_catalog!catalog_id (
					name,
					score_value,
					arrival_date,
					region,
					processing,
					drying_method,
					lot_size,
					bag_size,
					packaging,
					cultivar_detail,
					grade,
					appearance,
					roast_recs,
					type,
					description_short,
					description_long,
					farm_notes,
					link,
					cost_lb,
					source,
					stocked,
					cupping_notes,
					stocked_date,
					unstocked_date,
					ai_description,
					ai_tasting_notes,
					public_coffee
				)
			`
			)
			.single();

		if (error) throw error;
		return json(newBean);
	} catch (error) {
		console.error('Error creating bean:', error);
		return json({ error: 'Failed to create bean' }, { status: 500 });
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

		// Verify ownership and get catalog_id for potential cascade deletion
		const { data: existing } = await supabase
			.from('green_coffee_inv')
			.select('user, catalog_id')
			.eq('id', id)
			.single();

		if (!existing || existing.user !== user.id) {
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

		// Check if we need to cascade delete the coffee_catalog entry
		// Only delete if the catalog entry is user-owned (coffee_user = user.id)
		if (existing.catalog_id) {
			const { data: catalogEntry } = await supabase
				.from('coffee_catalog')
				.select('coffee_user, public_coffee')
				.eq('id', existing.catalog_id)
				.single();

			// Delete catalog entry if it's user-owned and private (manual entry)
			if (
				catalogEntry &&
				catalogEntry.coffee_user === user.id &&
				catalogEntry.public_coffee === false
			) {
				const { error: catalogDeleteError } = await supabase
					.from('coffee_catalog')
					.delete()
					.eq('id', existing.catalog_id);

				if (catalogDeleteError) {
					console.error('Error deleting user-owned catalog entry:', catalogDeleteError);
					// Don't fail the whole operation if catalog deletion fails
				}
			}
		}

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
			.select('user')
			.eq('id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updates = await request.json();
		const { id: _, ...rawUpdateData } = updates;

		console.log('PUT request - updating bean ID:', id);
		console.log('Raw update data keys:', Object.keys(rawUpdateData));

		// Filter to only include actual green_coffee_inv table columns
		const validColumns = [
			'rank',
			'notes',
			'purchase_date',
			'purchased_qty_lbs',
			'bean_cost',
			'tax_ship_cost',
			'last_updated',
			'user',
			'catalog_id',
			'stocked',
			'cupping_notes'
		];

		const updateData = Object.fromEntries(
			Object.entries(rawUpdateData).filter(([key]) => validColumns.includes(key))
		);

		console.log('Filtered update data:', JSON.stringify(updateData, null, 2));

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

		// First do the update without the join to avoid schema cache issues
		const { error: updateError } = await supabase
			.from('green_coffee_inv')
			.update(updateData)
			.eq('id', id);

		if (updateError) {
			console.error('Update error:', updateError);
			throw updateError;
		}

		// Then fetch the updated data with the join
		const { data: updatedBeans, error } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				*,
				coffee_catalog!catalog_id (
					name,
					score_value,
					arrival_date,
					region,
					processing,
					drying_method,
					lot_size,
					bag_size,
					packaging,
					cultivar_detail,
					grade,
					appearance,
					roast_recs,
					type,
					description_short,
					description_long,
					farm_notes,
					link,
					cost_lb,
					source,
					stocked,
					cupping_notes,
					stocked_date,
					unstocked_date,
					ai_description,
					ai_tasting_notes,
					public_coffee
				)
			`
			)
			.eq('id', id);

		if (error) {
			console.warn('Join query failed, falling back to basic select:', error);
			// Fallback: just return the basic updated record without the join
			const { data: basicData, error: basicError } = await supabase
				.from('green_coffee_inv')
				.select('*')
				.eq('id', id)
				.single();

			if (basicError) throw basicError;
			return json(basicData);
		}

		if (!updatedBeans || updatedBeans.length === 0) {
			return json({ success: false, error: 'Update failed' }, { status: 500 });
		}

		return json(updatedBeans[0]);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
};
