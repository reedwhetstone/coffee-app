import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const query = `
            SELECT 
                g.id,
                g.name as coffee_name,
                g.purchase_date,
                g.purchased_qty_lbs,
                g.bean_cost,
                g.tax_ship_cost,
                COALESCE(SUM(s.price), 0) as total_sales,
                COALESCE(SUM(s.oz_sold), 0) as oz_sold,
                COALESCE(SUM(s.price), 0) - (g.bean_cost + g.tax_ship_cost) as profit,
                CASE 
                    WHEN (g.bean_cost + g.tax_ship_cost) > 0 
                    THEN ((COALESCE(SUM(s.price), 0) - (g.bean_cost + g.tax_ship_cost)) / (g.bean_cost + g.tax_ship_cost)) * 100
                    ELSE 0 
                END as profit_margin
            FROM green_coffee_inv g
            LEFT JOIN sales s ON g.id = s.green_coffee_inv_id
            GROUP BY g.id, g.name, g.purchase_date, g.purchased_qty_lbs, g.bean_cost, g.tax_ship_cost
            ORDER BY g.purchase_date DESC
        `;

		const [rows] = await dbConn.query(query);
		return json(rows);
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch profit data' }, { status: 500 });
	}
}
