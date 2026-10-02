import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDocsPage, getDocsSection, getPrevNextDocs } from '$lib/docs/content';
import { docsMarkdownPath } from '$lib/docs/markdown';

export const load: PageServerLoad = async ({ params }) => {
	if (params.section === 'api') {
		throw redirect(307, 'https://api.purveyors.io/docs');
	}

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
		navSection: section,
		prevNext: getPrevNextDocs(params.section, params.slug),
		markdownHref: docsMarkdownPath(page),
		slug: params.slug
	};
};
