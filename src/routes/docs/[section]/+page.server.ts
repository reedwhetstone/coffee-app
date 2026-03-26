import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDefaultSlug, getDocsSection } from '$lib/docs/content';

export const load: PageServerLoad = async ({ params }) => {
	const section = getDocsSection(params.section);
	if (!section) {
		throw error(404, 'Documentation section not found');
	}

	const defaultSlug = getDefaultSlug(params.section);
	if (!defaultSlug) {
		throw error(404, 'Documentation page not found');
	}

	throw redirect(307, `/docs/${params.section}/${defaultSlug}`);
};
