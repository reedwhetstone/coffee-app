import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET() {
	// Wait for database connection to be established
	let retries = 5;
	while (!dbConn && retries > 0) {
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
		retries--;
	}

	if (!dbConn) {
		throw new Error('Database connection could not be established after multiple attempts.');
	}

	try {
		const query = `
            SELECT 
                g.id,
                g.name as coffee_name,
                g.purchase_date,
                g.purchased_qty_lbs,
                g.purchased_qty_lbs * 16 as purchased_qty_oz,
                g.bean_cost,
                g.tax_ship_cost,
                COALESCE(SUM(s.price), 0) as total_sales,
                COALESCE(SUM(s.oz_sold), 0) as oz_sold,
                COALESCE(SUM(s.price), 0) - (g.bean_cost + g.tax_ship_cost) as profit,
                COALESCE((SELECT SUM(r2.oz_in) FROM roast_profiles r2 WHERE r2.coffee_id = g.id), 0) as oz_in,
                COALESCE((SELECT SUM(r2.oz_out) FROM roast_profiles r2 WHERE r2.coffee_id = g.id), 0) as oz_out,
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

		console.log('Executing query');
		const result = await dbConn.query(query);
		console.log('Query results:');

		// Format the date in each row
		const formattedRows = result.rows.map((row) => ({
			...row,
			purchase_date: row.purchase_date.toISOString().split('T')[0]
		}));
		console.log(formattedRows);
		return json(formattedRows);
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch profit data' }, { status: 500 });
	}
}
