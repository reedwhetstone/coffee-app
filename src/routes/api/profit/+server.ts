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
	name: string;
	purchase_date: string | null;
	purchased_qty_lbs: number | null;
	bean_cost: number | null;
	tax_ship_cost: number | null;
	sales?: Sale[];
	roast_profiles?: RoastProfile[];
}

export const GET: RequestHandler = async ({ locals: { supabase } }) => {
	try {
		// Fetch sales data
		const { data: sales, error: salesError } = await supabase
			.from('sales')
			.select(
				`
				*,
				green_coffee_inv!inner (
					name
				)
			`
			)
			.order('sell_date', { ascending: false });

		if (salesError) {
			return json({ error: salesError.message }, { status: 500 });
		}

		// Fetch profit data
		const { data: profitData, error: profitError } = await supabase
			.from('green_coffee_inv')
			.select(
				`
				id,
				name:name,
				coffee_name:name,
				purchase_date,
				purchased_qty_lbs,
				purchased_qty_oz:purchased_qty_lbs,
				bean_cost,
				tax_ship_cost,
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
			.order('purchase_date', { ascending: false });

		if (profitError) {
			return json({ error: profitError.message }, { status: 500 });
		}

		const formattedSales = sales.map((sale) => ({
			...sale,
			coffee_name: sale.green_coffee_inv?.name || null
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

			return {
				id: row.id,
				coffee_name: row.name,
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

export const PUT: RequestHandler = async ({ url, request, locals: { supabase } }) => {
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'No ID provided' }, { status: 400 });
	}

	try {
		const updates = await request.json();
		const { coffee_name: _, ...updateData } = updates;

		const { data, error } = await supabase
			.from('sales')
			.update(updateData)
			.eq('id', id)
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

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	try {
		const saleData = await request.json();
		const { coffee_name: _, ...insertData } = saleData;

		if (!insertData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		const columns = Object.keys(insertData).join(', ');
		const placeholders = Object.keys(insertData)
			.map((_, index) => `$${index + 1}`)
			.join(', ');
		const values = Object.values(insertData);

		const { data: result, error: insertError } = await supabase.rpc('run_query', {
			query_text: `INSERT INTO sales (${columns}) VALUES (${placeholders}) RETURNING id`,
			query_params: values
		});

		if (insertError) {
			return json({ error: insertError.message }, { status: 500 });
		}

		const { data: newSale, error: fetchError } = await supabase.rpc('run_query', {
			query_text: `
				SELECT s.*, g.name as coffee_name, g.purchase_date
				FROM sales s
				LEFT JOIN green_coffee_inv g ON s.green_coffee_inv_id = g.id
				WHERE s.id = $1
			`,
			query_params: [result[0].id]
		});

		if (fetchError) {
			return json({ error: fetchError.message }, { status: 500 });
		}

		return json(newSale[0]);
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase } }) => {
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'No ID provided' }, { status: 400 });
	}

	try {
		const { error } = await supabase.from('sales').delete().eq('id', id);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
};
