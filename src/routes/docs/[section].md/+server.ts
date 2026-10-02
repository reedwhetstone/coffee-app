import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MARKDOWN_HEADERS, renderDocsSectionMarkdown } from '$lib/docs/markdown';

export const GET: RequestHandler = async ({ params, url }) => {
	if (params.section === 'api') {
		throw redirect(307, 'https://api.purveyors.io/docs');
	}

	const markdown = renderDocsSectionMarkdown(params.section, url.origin);
	if (!markdown) {
		throw error(404, 'Documentation section not found');
	}

	return new Response(markdown, { headers: MARKDOWN_HEADERS });
};
