import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/blog';

export const GET: RequestHandler = async ({ url }) => {
	const posts = await getAllPosts();
	const publishedPosts = posts.filter((post) => !post.draft);
	const baseUrl = `${url.protocol}//${url.host}`;

	const blogPostLines = publishedPosts
		.map((post) => `- [${post.title}](${baseUrl}/blog/${post.slug}): ${post.description}`)
		.join('\n');

	const content = `# Purveyors.io

> Green coffee marketplace and market intelligence platform. Real-time pricing data from 39+ US green coffee importers and roasters, normalized and updated daily.

## Public Pages

- [Market Analytics](${baseUrl}/analytics): Live green coffee price trends by origin, processing method distribution, origin price ranges. Updated daily from the live Purveyors market data pipeline.
- [Coffee Catalog](${baseUrl}/catalog): Browse 1,200+ specialty and commercial green coffees from 39 suppliers with origin, processing, altitude, tasting notes, and pricing.
- [Blog](${baseUrl}/blog): Coffee intelligence, AI-first product development, supply chain analysis. 10+ articles on coffee data, market structure, and technology.

## API and Docs

- [Parchment API](${baseUrl}/api): Public API overview, product positioning, and entry point for Parchment API.
- [Developer Docs](${baseUrl}/docs): Canonical public docs for the HTTP API, CLI, auth contexts, and integration guides.
- [Catalog API Docs](${baseUrl}/docs/api/catalog): Canonical contract for GET /v1/catalog, including anonymous and API-key usage.

## Blog Posts

${blogPostLines}

## Data

- 39+ supplier integrations across US green coffee market
- Daily price snapshots with origin, processing method, grade breakdowns
- Historical price index data (26+ weeks)
- AI-generated tasting notes and bean descriptions
`;

	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
