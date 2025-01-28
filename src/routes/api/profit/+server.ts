import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

interface ProfitRow {
	purchase_date: string;
	[key: string]: any;
}

export async function GET() {
	if (!supabase) {
		throw new Error('Supabase client is not initialized.');
	}

	try {
		const { data: rows, error } = await supabase
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

		if (error) throw error;

		// Transform the data to match the expected format
		const formattedRows = rows.map((row) => {
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

		return json(formattedRows);
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch profit data' }, { status: 500 });
	}
}
