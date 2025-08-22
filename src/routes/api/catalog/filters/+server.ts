import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Fetch unique values for filter dropdowns from stocked coffee
		const { data: rows, error } = await supabase
			.from('coffee_catalog')
			.select(
				'source, continent, country, processing, cultivar_detail, type, grade, appearance, arrival_date'
			)
			.eq('stocked', true);

		if (error) throw error;

		const uniqueValues: Record<string, any[]> = {};

		if (rows && rows.length > 0) {
			// Get unique sources
			const sources = [...new Set(rows.map((r) => r.source).filter(Boolean))].sort();
			if (sources.length > 0) uniqueValues.sources = sources;

			// Get unique continents
			const continents = [...new Set(rows.map((r) => r.continent).filter(Boolean))].sort();
			if (continents.length > 0) uniqueValues.continents = continents;

			// Get unique countries
			const countries = [...new Set(rows.map((r) => r.country).filter(Boolean))].sort();
			if (countries.length > 0) uniqueValues.countries = countries;

			// Get unique processing methods
			const processing = [...new Set(rows.map((r) => r.processing).filter(Boolean))].sort();
			if (processing.length > 0) uniqueValues.processing = processing;

			// Get unique cultivar details
			const cultivars = [...new Set(rows.map((r) => r.cultivar_detail).filter(Boolean))].sort();
			if (cultivars.length > 0) uniqueValues.cultivar_detail = cultivars;

			// Get unique types (importers)
			const types = [...new Set(rows.map((r) => r.type).filter(Boolean))].sort();
			if (types.length > 0) uniqueValues.type = types;

			// Get unique grades
			const grades = [...new Set(rows.map((r) => r.grade).filter(Boolean))].sort();
			if (grades.length > 0) uniqueValues.grade = grades;

			// Get unique appearances
			const appearances = [...new Set(rows.map((r) => r.appearance).filter(Boolean))].sort();
			if (appearances.length > 0) uniqueValues.appearance = appearances;

			// Get unique arrival dates
			const arrivalDates = [...new Set(rows.map((r) => r.arrival_date).filter(Boolean))].sort();
			if (arrivalDates.length > 0) uniqueValues.arrivalDates = arrivalDates;
		}

		return json(uniqueValues);
	} catch (error) {
		console.error('Error fetching filter values:', error);
		return json({ error: 'Failed to fetch filter values' }, { status: 500 });
	}
};
