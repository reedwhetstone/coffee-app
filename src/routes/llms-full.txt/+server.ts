import type { RequestHandler } from './$types';
import { renderLlmsFull } from '$lib/docs/markdown';

export const GET: RequestHandler = async ({ url }) =>
	new Response(renderLlmsFull(url.origin), {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=3600'
		}
	});
