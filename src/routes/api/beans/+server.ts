import { json } from '@sveltejs/kit';
import { requireUserAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Database } from '$lib/types/database.types';
import { buildGreenCoffeeQuery, processGreenCoffeeData } from '$lib/server/greenCoffeeUtils.js';
import { addToInventory, updateInventory, deleteInventoryItem } from '$lib/data/inventory.js';

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
			const { session, user } = sessionData;

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
			const catalogData: Record<string, unknown> = {
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
				'price_per_lb',
				'price_tiers',
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
				.insert(catalogData as Database['public']['Tables']['coffee_catalog']['Insert'])
				.select('id')
				.single();

			if (catalogError) {
				console.error('Error creating catalog entry:', catalogError);
				return json({ error: 'Failed to create catalog entry' }, { status: 500 });
			}

			catalogId = newCatalogEntry.id;
		}

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

		const created = await addToInventory(supabase, user.id, {
			catalog_id: catalogId ?? null,
			rank: bean.rank,
			notes: bean.notes,
			purchase_date: bean.purchase_date,
			purchased_qty_lbs: bean.purchased_qty_lbs,
			bean_cost: bean.bean_cost,
			tax_ship_cost: bean.tax_ship_cost,
			stocked: bean.stocked,
			cupping_notes: bean.cupping_notes
		});

		return json(created);
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

		let updated;
		try {
			updated = await updateInventory(supabase, Number(id), user.id, updateData);
		} catch (err) {
			if (err instanceof Error && err.message === 'Unauthorized') {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
			throw err;
		}

		// Stocked status auto-update is handled inside updateInventory()
		// when purchased_qty_lbs changes, so the returned data is always fresh.
		return json(updated);
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

		try {
			await deleteInventoryItem(supabase, Number(id), user.id);
		} catch (err) {
			if (err instanceof Error && err.message === 'Unauthorized') {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
			throw err;
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting bean and associated data:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
};
