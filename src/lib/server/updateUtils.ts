import { dbConn } from './db';

export async function updateGreenCoffeeWithCatalogData() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const query = `
            UPDATE green_coffee_inv g
            JOIN coffee_catalog c ON g.link = c.link
            SET 
                g.name = COALESCE(g.name, c.name),
                g.region = c.region,
                g.processing = c.processing,
                g.drying_method = c.drying_method,
                g.arrival_date = c.arrival_date,
                g.lot_size = c.lot_size,
                g.bag_size = c.bag_size,
                g.packaging = c.packaging,
                g.farm_gate = c.farm_gate,
                g.cultivar_detail = c.cultivar_detail,
                g.grade = c.grade,
                g.appearance = c.appearance,
                g.roast_recs = c.roast_recs,
                g.type = c.type,
                g.score_value = c.score_value,
                g.last_updated = NOW()
            WHERE g.link IS NOT NULL 
            AND g.link != ''
            AND c.link IS NOT NULL
            AND c.link != ''
        `;

		const [result] = await dbConn.query(query);
		console.log('Update complete:', result);
		return { success: true, result };
	} catch (error) {
		console.error('Error updating green coffee inventory:', error);
		throw error;
	}
}
