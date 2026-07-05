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

> Coffee intelligence platform for public catalog discovery, market analytics, developer integrations, and account-linked roasting workflows.

## Public Pages

- [Market Analytics](${baseUrl}/analytics): Public market-intelligence surface for origin price trends, processing mix, origin price ranges, and gated Parchment Intelligence modules.
- [Coffee Catalog](${baseUrl}/catalog): Public catalog for normalized green coffee listings with origin, processing, pricing, and availability data.
- [Parchment API](${baseUrl}/api): Product overview for the API, access tiers, and Console entry points.
- [Parchment Console](${baseUrl}/api-dashboard): Authenticated Console for API keys, usage, and billing.
- [Developer Docs](${baseUrl}/docs): Product and CLI documentation. Generated API reference lives at https://api.purveyors.io/docs.
- [Blog](${baseUrl}/blog): Coffee intelligence, product direction, and platform updates.

## API and Platform

- [Generated Parchment API reference](https://api.purveyors.io/docs): Canonical OpenAPI/Scalar documentation for HTTP integrations.
- [Parchment API product page](${baseUrl}/api): Access tiers and Console entry points.
- /api/* routes on this host are private BFF routes for the first-party app and Console. They are not the public API contract.

## Blog Posts

${blogPostLines}

## Data and Workflows

- Normalized supplier listings with origin, legacy processing labels, structured process transparency, grade, pricing, availability metadata, and opt-in proof summaries
- Beta catalog similarity matching for likely-same-bean and similar-profile research with cautious confidence labels
- Daily pricing and availability snapshots for catalog and analytics surfaces
- Inventory, roast, sales, tasting, chat, and workspace workflows in the web app
- Shared CLI-backed tooling for terminal and agent workflows
`;

	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
