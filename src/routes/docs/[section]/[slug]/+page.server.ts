import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDocsPage, getDocsSection } from '$lib/docs/content';

export const load: PageServerLoad = async ({ params }) => {
	const section = getDocsSection(params.section);
	if (!section) {
		throw error(404, 'Documentation section not found');
	}

	const page = getDocsPage(params.section, params.slug);
	if (!page) {
		throw error(404, 'Documentation page not found');
	}

	return {
		page,
		section: section.key,
		slug: params.slug
	};
};
