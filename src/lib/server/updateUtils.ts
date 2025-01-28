import { supabase } from './db';

export async function updateGreenCoffeeWithCatalogData() {
	if (!supabase) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const query = `
            UPDATE green_coffee_inv g
            SET 
                name = COALESCE(g.name, c.name),
                region = c.region,
                processing = c.processing,
                drying_method = c.drying_method,
                arrival_date = c.arrival_date,
                lot_size = c.lot_size,
                bag_size = c.bag_size,
                packaging = c.packaging,
                farm_gate = c.farm_gate,
                cultivar_detail = c.cultivar_detail,
                grade = c.grade,
                appearance = c.appearance,
                roast_recs = c.roast_recs,
                type = c.type,
                score_value = c.score_value,
                description_short = c.description_short,
                description_long = c.description_long,
                farm_notes = c.farm_notes,
                last_updated = NOW()
            FROM coffee_catalog c
            WHERE g.link = c.link
            AND g.link IS NOT NULL 
            AND g.link != ''
            AND c.link IS NOT NULL
            AND c.link != ''
            RETURNING *
        `;

		const { data, error } = await supabase.rpc('run_query', {
			query_text: query
		});

		if (error) throw error;

		console.log('Update complete:', data);
		return { success: true, result: data };
	} catch (error) {
		console.error('Error updating green coffee inventory:', error);
		throw error;
	}
}
