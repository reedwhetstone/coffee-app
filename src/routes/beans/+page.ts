// src/routes/beans/+page.ts
import type { Load } from '@sveltejs/kit';

export const load: Load = async ({ parent }) => {
	const parentData = await parent();

	return {
		data: parentData.data || [],
		role: parentData.role || 'viewer',
		searchState: parentData.searchState || {},
		isShared: parentData.isShared || false
	};
};
