import type { RequestHandler } from './$types';
import { MARKDOWN_HEADERS, renderDocsIndexMarkdown } from '$lib/docs/markdown';

export const GET: RequestHandler = async ({ url }) =>
	new Response(renderDocsIndexMarkdown(url.origin), { headers: MARKDOWN_HEADERS });
