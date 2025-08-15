import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url, data: serverData }) => {
	const layoutData = await parent();

	// Combine layout data with server data
	const combinedData = { ...layoutData, ...serverData };

	// For catalog page, return authenticated app metadata
	return {
		...combinedData,
		meta: {
			title: 'Coffee Catalog - Purveyors',
			description:
				'Browse and discover coffee beans with AI-powered recommendations and semantic search.',
			keywords: 'coffee catalog, coffee search, coffee beans, roasting'
		}
	};
};
