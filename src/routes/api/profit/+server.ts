import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Sale {
	price: number | null;
	oz_sold: number | null;
}

interface RoastProfile {
	oz_in: number | null;
	oz_out: number | null;
}

interface Row {
	id: number;
	purchase_date: string | null;
	purchased_qty_lbs: number | null;
	bean_cost: number | null;
	tax_ship_cost: number | null;
	catalog_id: number | null;
	coffee_catalog?:
		| {
				name: string;
				score_value: number | null;
				arrival_date: string | null;
				region: string | null;
				processing: string | null;
				cultivar_detail: string | null;
				cost_lb: number | null;
				source: string | null;
				stocked: boolean | null;
		  }[]
		| {
				name: string;
				score_value: number | null;
				arrival_date: string | null;
				region: string | null;
				processing: string | null;
				cultivar_detail: string | null;
				cost_lb: number | null;
				source: string | null;
				stocked: boolean | null;
		  }
		| null;
	sales?: Sale[];
	roast_profiles?: RoastProfile[];
}

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Fetch sales data with coffee catalog details
		const { data: sales, error: salesError } = await supabase
			.from('sales')
			.select(
				`
				*,
				green_coffee_inv!inner (
					id,
					catalog_id,
					coffee_catalog!catalog_id (
						name
					)
				)
			`
			)
			.eq('user', user.id)
			.order('sell_date', { ascending: false });

		if (salesError) {
			return json({ error: salesError.message }, { status: 500 });
		}

		// Fetch profit data with coffee catalog details
		const { data: profitData, error: profitError } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				id,
				purchase_date,
				purchased_qty_lbs,
				bean_cost,
				tax_ship_cost,
				catalog_id,
				coffee_catalog!catalog_id (
					name,
					score_value,
					arrival_date,
					region,
					processing,
					cultivar_detail,
					cost_lb,
					source,
					stocked
				),
				sales(
					price,
					oz_sold
				),
				roast_profiles(
					oz_in,
					oz_out
				)
			`
			)
			.eq('user', user.id)
			.order('purchase_date', { ascending: false });

		if (profitError) {
			return json({ error: profitError.message }, { status: 500 });
		}

		const formattedSales = sales.map((sale) => ({
			...sale,
			coffee_name: sale.green_coffee_inv?.coffee_catalog?.name || null
		}));

		const formattedProfitRows = profitData.map((row: Row) => {
			const totalSales = row.sales?.reduce((sum, sale) => sum + (sale.price || 0), 0) || 0;
			const totalOzSold = row.sales?.reduce((sum, sale) => sum + (sale.oz_sold || 0), 0) || 0;
			const totalOzIn =
				row.roast_profiles?.reduce((sum, profile) => sum + (profile.oz_in || 0), 0) || 0;
			const totalOzOut =
				row.roast_profiles?.reduce((sum, profile) => sum + (profile.oz_out || 0), 0) || 0;
			const totalCost = (row.bean_cost || 0) + (row.tax_ship_cost || 0);
			const profit = totalSales - totalCost;
			const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

			// Use coffee catalog name if available
			const displayName = Array.isArray(row.coffee_catalog)
				? row.coffee_catalog[0]?.name
				: row.coffee_catalog?.name;

			return {
				id: row.id,
				coffee_name: displayName,
				purchase_date: row.purchase_date?.split('T')[0],
				purchased_qty_lbs: row.purchased_qty_lbs,
				purchased_qty_oz: (row.purchased_qty_lbs || 0) * 16,
				bean_cost: row.bean_cost,
				tax_ship_cost: row.tax_ship_cost,
				total_sales: totalSales,
				oz_sold: totalOzSold,
				profit: profit,
				oz_in: totalOzIn,
				oz_out: totalOzOut,
				profit_margin: profitMargin
			};
		});

		return json({
			sales: formattedSales,
			profit: formattedProfitRows
		});
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
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
		const { data: existing } = await supabase.from('sales').select('user').eq('id', id).single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updates = await request.json();
		const { coffee_name: _, ...updateData } = updates;

		const { data, error } = await supabase
			.from('sales')
			.update(updateData)
			.eq('id', id)
			.eq('user', user.id)
			.select()
			.single();

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json(data);
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const saleData = await request.json();
		const { coffee_name: _, id: __, ...insertData } = saleData;

		if (!insertData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		// Verify ownership of the green coffee inventory
		const { data: coffee } = await supabase
			.from('green_coffee_inv')
			.select('user')
			.eq('id', insertData.green_coffee_inv_id)
			.single();

		if (!coffee || coffee.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Insert the new sale with user ID
		const { data: newSale, error: insertError } = await supabase
			.from('sales')
			.insert({ ...insertData, user: user.id })
			.select()
			.single();

		if (insertError) {
			return json({ error: insertError.message }, { status: 500 });
		}

		// Get the coffee name separately for the response
		const { data: coffeeData } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				purchase_date,
				coffee_catalog!catalog_id (
					name
				)
			`
			)
			.eq('id', insertData.green_coffee_inv_id)
			.single();

		// Format the response to match the expected structure
		const formattedSale = {
			...newSale,
			coffee_name: Array.isArray(coffeeData?.coffee_catalog)
				? (coffeeData?.coffee_catalog as any)[0]?.name || null
				: (coffeeData?.coffee_catalog as any)?.name || null,
			purchase_date: coffeeData?.purchase_date || null
		};

		return json(formattedSale);
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
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
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabase.from('sales').select('user').eq('id', id).single();

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const { error } = await supabase.from('sales').delete().eq('id', id).eq('user', user.id);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
};
