import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/blog';

export const GET: RequestHandler = async () => {
	const posts = await getAllPosts();
	const publishedPosts = posts.filter((post) => !post.draft);

	const blogPostLines = publishedPosts
		.map((post) => `- [${post.title}](https://purveyors.io/blog/${post.slug}): ${post.description}`)
		.join('\n');

	const content = `# Purveyors.io

> Green coffee marketplace and market intelligence platform. Real-time pricing data from 39+ US green coffee importers and roasters, normalized and updated daily.

## Public Pages

- [Market Analytics](https://purveyors.io/analytics): Live green coffee price trends by origin, processing method distribution, origin price ranges. Updated daily from the Purveyors Price Index (PPI).
- [Coffee Catalog](https://purveyors.io/catalog): Browse 1,200+ specialty and commercial green coffees from 39 suppliers with origin, processing, altitude, tasting notes, and pricing.
- [Blog](https://purveyors.io/blog): Coffee intelligence, AI-first product development, supply chain analysis. 10+ articles on coffee data, market structure, and technology.

## API

- [Parchment API](https://purveyors.io/api): RESTful API for green coffee catalog data. Free tier available.
- [API Dashboard](https://purveyors.io/api-dashboard): Interactive API explorer and documentation.

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
