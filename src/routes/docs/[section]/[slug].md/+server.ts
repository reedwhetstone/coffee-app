import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocsPage } from '$lib/docs/content';
import { MARKDOWN_HEADERS, renderDocsPageMarkdown } from '$lib/docs/markdown';

export const GET: RequestHandler = async ({ params, url }) => {
	if (params.section === 'api') {
		throw redirect(307, 'https://api.purveyors.io/docs');
	}

	const page = getDocsPage(params.section, params.slug);
	if (!page) {
		throw error(404, 'Documentation page not found');
	}

	return new Response(renderDocsPageMarkdown(page, url.origin), { headers: MARKDOWN_HEADERS });
};
