import { json } from '@sveltejs/kit';
import { getCatalogFilterMetadata } from '$lib/data/catalog';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const visibility = resolveCatalogVisibility({
			session: locals.session,
			role: locals.role,
			showWholesaleRequested: url.searchParams.get('showWholesale') === 'true',
			wholesaleOnlyRequested: url.searchParams.get('wholesaleOnly') === 'true'
		});
		const rows = await getCatalogFilterMetadata(locals.supabase, {
			stockedOnly: true,
			publicOnly: visibility.publicOnly,
			showWholesale: visibility.showWholesale,
			wholesaleOnly: visibility.wholesaleOnly
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const uniqueValues: Record<string, any[]> = {};

		if (rows && rows.length > 0) {
			const sources = [...new Set(rows.map((row) => row.source).filter(Boolean))].sort();
			if (sources.length > 0) uniqueValues.sources = sources;

			const continents = [...new Set(rows.map((row) => row.continent).filter(Boolean))].sort();
			if (continents.length > 0) uniqueValues.continents = continents;

			const countries = [...new Set(rows.map((row) => row.country).filter(Boolean))].sort();
			if (countries.length > 0) uniqueValues.countries = countries;

			const processing = [...new Set(rows.map((row) => row.processing).filter(Boolean))].sort();
			if (processing.length > 0) uniqueValues.processing = processing;

			const cultivars = [...new Set(rows.map((row) => row.cultivar_detail).filter(Boolean))].sort();
			if (cultivars.length > 0) uniqueValues.cultivar_detail = cultivars;

			const types = [...new Set(rows.map((row) => row.type).filter(Boolean))].sort();
			if (types.length > 0) uniqueValues.type = types;

			const grades = [...new Set(rows.map((row) => row.grade).filter(Boolean))].sort();
			if (grades.length > 0) uniqueValues.grade = grades;

			const appearances = [...new Set(rows.map((row) => row.appearance).filter(Boolean))].sort();
			if (appearances.length > 0) uniqueValues.appearance = appearances;

			const arrivalDates = [...new Set(rows.map((row) => row.arrival_date).filter(Boolean))].sort();
			if (arrivalDates.length > 0) uniqueValues.arrivalDates = arrivalDates;
		}

		return json(uniqueValues);
	} catch (error) {
		console.error('Error fetching filter values:', error);
		return json({ error: 'Failed to fetch filter values' }, { status: 500 });
	}
};
