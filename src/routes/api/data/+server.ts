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

		let query = supabase.from('green_coffee_inv').select('*');

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
			const { session, user, role } = await safeGetSession();
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

		return json({
			data: rows || [],
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

		// If this bean came from the catalog, verify the catalog entry exists
		if (bean.catalog_id) {
			const { data: catalogBean, error: catalogError } = await supabase
				.from('coffee_catalog')
				.select('*')
				.eq('id', bean.catalog_id)
				.single();

			if (catalogError || !catalogBean) {
				return json({ error: 'Invalid catalog reference' }, { status: 400 });
			}

			// Ensure consistent mapping between coffee_catalog and green_coffee_inv
			// This serves as a safety check to ensure all required fields are mapped
			const mappedBean = {
				...bean,
				// Core fields always come from the form submission
				user: user.id,
				purchase_date: bean.purchase_date,
				purchased_qty_lbs: bean.purchased_qty_lbs,
				tax_ship_cost:
					typeof bean.tax_ship_cost === 'number' ? parseFloat(bean.tax_ship_cost.toFixed(2)) : 0.0,
				last_updated: bean.last_updated,

				// Fields that should come from catalog if not manually overridden
				name: bean.name || catalogBean.name,
				score_value: bean.score_value ?? catalogBean.score_value,
				arrival_date: bean.arrival_date || catalogBean.arrival_date,
				region: bean.region || catalogBean.region,
				processing: bean.processing || catalogBean.processing,
				drying_method: bean.drying_method || catalogBean.drying_method,
				lot_size: bean.lot_size || catalogBean.lot_size,
				bag_size: bean.bag_size || catalogBean.bag_size,
				packaging: bean.packaging || catalogBean.packaging,
				cultivar_detail: bean.cultivar_detail || catalogBean.cultivar_detail,
				grade: bean.grade || catalogBean.grade,
				appearance: bean.appearance || catalogBean.appearance,
				roast_recs: bean.roast_recs || catalogBean.roast_recs,
				type: bean.type || catalogBean.type,
				description_short: bean.description_short || catalogBean.description_short,
				description_long: bean.description_long || catalogBean.description_long,
				farm_notes: bean.farm_notes || catalogBean.farm_notes,
				link: bean.link || catalogBean.link,
				// Ensure bean_cost is properly formatted as decimal
				bean_cost:
					typeof bean.bean_cost === 'number'
						? parseFloat(bean.bean_cost.toFixed(2))
						: typeof catalogBean.cost_lb === 'number'
							? parseFloat(catalogBean.cost_lb.toFixed(2))
							: 0.0,
				catalog_id: catalogBean.id,
				cupping_notes: bean.cupping_notes || catalogBean.cupping_notes,
				source: bean.source || catalogBean.source
			};

			const { data: newBean, error } = await supabase
				.from('green_coffee_inv')
				.insert(mappedBean)
				.select()
				.single();

			if (error) throw error;
			return json(newBean);
		} else {
			// No catalog_id, just regular insert
			const { data: newBean, error } = await supabase
				.from('green_coffee_inv')
				.insert({
					...bean,
					user: user.id
				})
				.select()
				.single();

			if (error) throw error;
			return json(newBean);
		}
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

		// Verify ownership
		const { data: existing } = await supabase
			.from('green_coffee_inv')
			.select('user')
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
		const { id: _, ...updateData } = updates;

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

		const { data: updatedBeans, error } = await supabase
			.from('green_coffee_inv')
			.update(updateData)
			.eq('id', id)
			.select();

		if (error) throw error;

		if (!updatedBeans || updatedBeans.length === 0) {
			return json({ success: false, error: 'Update failed' }, { status: 500 });
		}

		return json(updatedBeans[0]);
	} catch (error) {
		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
};
