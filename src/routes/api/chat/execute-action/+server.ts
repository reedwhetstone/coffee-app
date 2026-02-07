import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';
import type { RequestHandler } from './$types';
import type { Database } from '$lib/types/database.types';

const ALLOWED_ACTIONS = new Set([
	'add_bean_to_inventory',
	'update_bean',
	'create_roast_session',
	'update_roast_notes',
	'record_sale'
]);

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;
		const { actionType, fields } = await event.request.json();

		if (!ALLOWED_ACTIONS.has(actionType)) {
			return json({ error: `Unknown action type: ${actionType}` }, { status: 400 });
		}

		// Convert fields array/object to a flat params map
		const params: Record<string, unknown> = typeof fields === 'object' && !Array.isArray(fields)
			? fields
			: {};

		switch (actionType) {
			case 'add_bean_to_inventory': {
				// catalog_id can come from explicit field or from coffee_bean dropdown value
				const catalogId = params.catalog_id
					? Number(params.catalog_id)
					: params.coffee_bean
						? Number(params.coffee_bean)
						: null;
				const manualName = params.manual_name as string | undefined;

				let finalCatalogId = catalogId;

				// Create manual catalog entry if needed
				if (!finalCatalogId && manualName) {
					const { data: newCatalog, error: catErr } = await supabase
						.from('coffee_catalog')
						.insert({
							name: manualName,
							coffee_user: user.id,
							public_coffee: false,
							last_updated: new Date().toISOString().split('T')[0]
						} as Database['public']['Tables']['coffee_catalog']['Insert'])
						.select('id')
						.single();

					if (catErr) return json({ error: catErr.message }, { status: 500 });
					finalCatalogId = newCatalog.id;
				}

				if (!finalCatalogId) {
					return json({ error: 'Either catalog_id or manual_name is required' }, { status: 400 });
				}

				// Compute total bean_cost from cost_per_lb * quantity
				const qty = Number(params.purchased_qty_lbs) || 0;
				const costPerLb = Number(params.cost_per_lb) || 0;
				const totalBeanCost = Math.round(costPerLb * qty * 100) / 100;

				const invData: Record<string, unknown> = {
					user: user.id,
					catalog_id: finalCatalogId,
					purchased_qty_lbs: qty,
					bean_cost: totalBeanCost,
					tax_ship_cost: Number(params.tax_ship_cost) || 0,
					purchase_date: params.purchase_date || new Date().toISOString().split('T')[0],
					notes: params.notes || '',
					stocked: true,
					last_updated: new Date().toISOString()
				};

				const { data: newBean, error: beanErr } = await supabase
					.from('green_coffee_inv')
					.insert(invData as Database['public']['Tables']['green_coffee_inv']['Insert'])
					.select('id')
					.single();

				if (beanErr) return json({ error: beanErr.message }, { status: 500 });
				return json({ success: true, id: newBean.id, message: 'Bean added to inventory' });
			}

			case 'update_bean': {
				const beanId = Number(params.bean_id);
				if (!beanId) return json({ error: 'bean_id is required' }, { status: 400 });

				// Verify ownership
				const { data: existing } = await supabase
					.from('green_coffee_inv')
					.select('user')
					.eq('id', beanId)
					.single();

				if (!existing || existing.user !== user.id) {
					return json({ error: 'Bean not found or unauthorized' }, { status: 403 });
				}

				const validFields = ['rank', 'notes', 'stocked', 'purchased_qty_lbs'];
				const updateData: Record<string, unknown> = { last_updated: new Date().toISOString() };
				for (const key of validFields) {
					if (params[key] !== undefined) {
						if (key === 'stocked') {
							updateData[key] = params[key] === 'true' || params[key] === true;
						} else if (key === 'rank' || key === 'purchased_qty_lbs') {
							updateData[key] = Number(params[key]);
						} else {
							updateData[key] = params[key];
						}
					}
				}

				const { error: updateErr } = await supabase
					.from('green_coffee_inv')
					.update(updateData as Database['public']['Tables']['green_coffee_inv']['Update'])
					.eq('id', beanId);

				if (updateErr) return json({ error: updateErr.message }, { status: 500 });

				// Auto-update stocked status
				if (updateData.purchased_qty_lbs !== undefined && updateData.stocked === undefined) {
					try {
						await updateStockedStatus(supabase, beanId, user.id);
					} catch { /* non-critical */ }
				}

				return json({ success: true, id: beanId, message: 'Bean updated' });
			}

			case 'create_roast_session': {
				const coffeeId = Number(params.coffee_id);
				if (!coffeeId) return json({ error: 'coffee_id is required' }, { status: 400 });

				// Verify coffee ownership
				const { data: coffee } = await supabase
					.from('green_coffee_inv')
					.select('user')
					.eq('id', coffeeId)
					.single();

				if (!coffee || coffee.user !== user.id) {
					return json({ error: 'Coffee not found or unauthorized' }, { status: 403 });
				}

				const roastData = {
					user: user.id,
					coffee_id: coffeeId,
					coffee_name: String(params.coffee_name || ''),
					batch_name: String(params.batch_name || ''),
					roast_date: String(params.roast_date || new Date().toISOString().split('T')[0]),
					oz_in: params.oz_in ? Number(params.oz_in) : null,
					roast_notes: params.roast_notes ? String(params.roast_notes) : null,
					roaster_type: params.roaster_type ? String(params.roaster_type) : null,
					last_updated: new Date().toISOString()
				};

				const { data: newRoast, error: roastErr } = await supabase
					.from('roast_profiles')
					.insert(roastData as Database['public']['Tables']['roast_profiles']['Insert'])
					.select('roast_id')
					.single();

				if (roastErr) return json({ error: roastErr.message }, { status: 500 });
				return json({ success: true, id: newRoast.roast_id, message: 'Roast session created' });
			}

			case 'update_roast_notes': {
				const roastId = Number(params.roast_id);
				if (!roastId) return json({ error: 'roast_id is required' }, { status: 400 });

				// Verify ownership
				const { data: roast } = await supabase
					.from('roast_profiles')
					.select('user')
					.eq('roast_id', roastId)
					.single();

				if (!roast || roast.user !== user.id) {
					return json({ error: 'Roast not found or unauthorized' }, { status: 403 });
				}

				const updateData: Record<string, unknown> = { last_updated: new Date().toISOString() };
				if (params.roast_notes !== undefined) updateData.roast_notes = String(params.roast_notes);
				if (params.roast_targets !== undefined) updateData.roast_targets = String(params.roast_targets);

				const { error: updateErr } = await supabase
					.from('roast_profiles')
					.update(updateData as Database['public']['Tables']['roast_profiles']['Update'])
					.eq('roast_id', roastId);

				if (updateErr) return json({ error: updateErr.message }, { status: 500 });
				return json({ success: true, id: roastId, message: 'Roast notes updated' });
			}

			case 'record_sale': {
				const invId = Number(params.green_coffee_inv_id);
				if (!invId) return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });

				// Verify ownership
				const { data: inv } = await supabase
					.from('green_coffee_inv')
					.select('user')
					.eq('id', invId)
					.single();

				if (!inv || inv.user !== user.id) {
					return json({ error: 'Inventory item not found or unauthorized' }, { status: 403 });
				}

				const saleData = {
					user: user.id,
					green_coffee_inv_id: invId,
					batch_name: String(params.batch_name || ''),
					oz_sold: Number(params.oz_sold) || 0,
					price: Number(params.price) || 0,
					buyer: String(params.buyer || ''),
					sell_date: String(params.sell_date || new Date().toISOString().split('T')[0]),
					purchase_date: String(params.purchase_date || new Date().toISOString().split('T')[0])
				};

				const { data: newSale, error: saleErr } = await supabase
					.from('sales')
					.insert(saleData as Database['public']['Tables']['sales']['Insert'])
					.select('id')
					.single();

				if (saleErr) return json({ error: saleErr.message }, { status: 500 });

				// Auto-update stocked status
				try {
					await updateStockedStatus(supabase, invId, user.id);
				} catch { /* non-critical */ }

				return json({ success: true, id: newSale.id, message: 'Sale recorded' });
			}

			default:
				return json({ error: 'Unhandled action type' }, { status: 400 });
		}
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
