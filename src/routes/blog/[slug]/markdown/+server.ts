import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/blog';
import {
	buildMarketBriefReaderExport,
	getRawMarketBriefSource
} from '$lib/server/marketBriefReader';

export const GET: RequestHandler = async ({ params }) => {
	const post = (await getAllPosts()).find((candidate) => candidate.slug === params.slug);
	if (!post || post.format !== 'market-brief') {
		throw error(404, 'Market Wire edition not found');
	}

	const source = getRawMarketBriefSource(post.slug);
	if (source === undefined) {
		throw error(500, `Market Brief source not found: ${post.slug}`);
	}

	const reader = buildMarketBriefReaderExport(post, source);
	return new Response(reader.markdown, {
		headers: {
			'cache-control': 'public, max-age=300, s-maxage=3600',
			'content-disposition': `inline; filename="${post.slug}.md"`,
			'content-type': 'text/markdown; charset=utf-8'
		}
	});
};
