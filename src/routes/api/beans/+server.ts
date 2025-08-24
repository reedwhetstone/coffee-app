import { json } from '@sveltejs/kit';
import { requireUserAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { buildGreenCoffeeQuery, processGreenCoffeeData } from '$lib/server/greenCoffeeUtils.js';
import { updateStockedStatus } from '$lib/server/stockedStatusUtils.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		let query = buildGreenCoffeeQuery(locals.supabase);

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
			// Standard user authentication - all users (including admins) see only their own data
			const sessionData = await locals.safeGetSession();
			const { session, user } = sessionData as { session: any; user: any };

			if (!session || !user) {
				return json({ data: [] });
			}

			query = query.eq('user', user.id);

			if (id) {
				query = query.eq('id', id);
			}
		}

		const { data: rows, error } = await query;
		if (error) throw error;

		// Process data consistently
		const processedData = processGreenCoffeeData(rows || []);

		return json({
			data: processedData,
			searchState: Object.fromEntries(url.searchParams.entries())
		});
	} catch (error) {
		console.error('Error querying beans:', error);
		return json({ data: [], error: 'Failed to fetch beans' });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireUserAuth(event);
		const { supabase } = event.locals;

		const bean = await event.request.json();
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
			.select()
			.single();

		if (error) throw error;

		// Get the full bean data with joins
		const { data: fullBean } = await buildGreenCoffeeQuery(supabase).eq('id', newBean.id).single();

		return json(processGreenCoffeeData([fullBean])[0]);
	} catch (error) {
		console.error('Error creating bean:', error);
		return json({ error: 'Failed to create bean' }, { status: 500 });
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
			.from('green_coffee_inv')
			.select('user')
			.eq('id', id)
			.single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updates = await request.json();
		const { id: _, ...rawUpdateData } = updates;

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


		// First do the update without the join to avoid schema cache issues
		const { error: updateError } = await supabase
			.from('green_coffee_inv')
			.update(updateData)
			.eq('id', id);

		if (updateError) {
			console.error('Update error:', updateError);
			throw updateError;
		}

		// Auto-update stocked status if inventory quantities changed and stocked wasn't manually set
		if (updateData.purchased_qty_lbs !== undefined && updateData.stocked === undefined) {
			try {
				await updateStockedStatus(supabase, parseInt(id), user.id);
			} catch (stockError) {
				console.warn('Failed to auto-update stocked status:', stockError);
				// Don't fail the whole operation if stocked status update fails
			}
		}

		// Then fetch the updated data with the join
		const { data: updatedBean } = await buildGreenCoffeeQuery(supabase).eq('id', id).single();

		return json(processGreenCoffeeData([updatedBean])[0]);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
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

		// If there are roast profiles, delete their associated data
		if (roastProfiles && roastProfiles.length > 0) {
			const roastIds = roastProfiles.map((profile: any) => profile.roast_id);

			// Delete from normalized tables
			const { error: tempError } = await supabase
				.from('roast_temperatures')
				.delete()
				.in('roast_id', roastIds);
			if (tempError) throw tempError;

			const { error: eventError } = await supabase
				.from('roast_events')
				.delete()
				.in('roast_id', roastIds);
			if (eventError) throw eventError;
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
