import { json } from '@sveltejs/kit';
import { getCatalogFilterMetadata } from '$lib/data/catalog';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import { resolveCatalogAccessCapabilities } from '$lib/server/catalogAccess';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const catalogAccess = resolveCatalogAccessCapabilities({
			principal: locals.principal,
			session: locals.session,
			role: locals.role
		});
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

			if (catalogAccess.canViewPremiumFilterMetadata) {
				const processingBaseMethods = [
					...new Set(rows.map((row) => row.processing_base_method).filter(Boolean))
				].sort();
				if (processingBaseMethods.length > 0) {
					uniqueValues.processing_base_method = processingBaseMethods;
				}

				const fermentationTypes = [
					...new Set(rows.map((row) => row.fermentation_type).filter(Boolean))
				].sort();
				if (fermentationTypes.length > 0) uniqueValues.fermentation_type = fermentationTypes;

				const processAdditives = [
					...new Set(rows.flatMap((row) => row.process_additives ?? []).filter(Boolean))
				].sort();
				if (processAdditives.length > 0) uniqueValues.process_additives = processAdditives;

				const processingDisclosureLevels = [
					...new Set(rows.map((row) => row.processing_disclosure_level).filter(Boolean))
				].sort();
				if (processingDisclosureLevels.length > 0) {
					uniqueValues.processing_disclosure_level = processingDisclosureLevels;
				}
			}

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
