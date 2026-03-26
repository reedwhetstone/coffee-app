import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, data: serverData }) => {
	const layoutData = await parent();

	// Combine layout data with server data while preserving the server-generated public metadata.
	return {
		...layoutData,
		...serverData
	};
};
