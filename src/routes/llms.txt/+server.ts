import type { RequestHandler } from './$types';
import { PV_MICROLOT_FULL_NAME } from '$lib/benchmarks/marketing';
import { getPublishedPosts } from '$lib/server/blog';
import { getBlogPostPath } from '$lib/types/blog.types';

export const GET: RequestHandler = async ({ url }) => {
	const publishedPosts = await getPublishedPosts();
	const baseUrl = `${url.protocol}//${url.host}`;
	const benchmarkDescription =
		'Published system benchmark with 1,200 absolute evaluations and all 1,800 pairwise ballots. Harnessed systems beat Raw, but Purveyors did not clearly beat Pi and Parchment added no measured pairwise lift. The report also explains why V1 cannot attribute the full Raw gap to retrieval alone.';
	const benchmarkLabel = `${PV_MICROLOT_FULL_NAME} V1 findings`;

	const blogPostLines = publishedPosts
		.map(
			(post) => `- [${post.title}](${baseUrl}${getBlogPostPath(post.slug)}): ${post.description}`
		)
		.join('\n');

	const content = `# Purveyors.io

> Coffee intelligence platform for public catalog discovery, market analytics, developer integrations, and account-linked roasting workflows.

## Public Pages

- [Market Analytics](${baseUrl}/analytics): Public market-intelligence surface for origin price trends, processing mix, origin price ranges, and gated Parchment Intelligence modules.
- [Coffee Catalog](${baseUrl}/catalog): Public catalog for normalized green coffee listings with origin, processing, pricing, and availability data.
- [Cherry Evals](${baseUrl}/evals): Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.
- [${benchmarkLabel}](${baseUrl}/evals/coffeebench-v1): ${benchmarkDescription}
- [Parchment API](${baseUrl}/api): Product overview for the API, access tiers, and Console entry points.
- [Parchment Console](${baseUrl}/api-dashboard): Authenticated Console for API keys, usage, and billing.
- [Developer Docs](${baseUrl}/docs): Product and CLI documentation. Generated API reference lives at https://api.purveyors.io/docs.
- [Blog](${baseUrl}/blog): Coffee intelligence, product direction, and platform updates.
- [Market Brief](${baseUrl}/market-wire): Weekly, evidence-linked green coffee market intelligence with account-backed email signup.
- [PurveyorsBot](${baseUrl}/bot): Public crawler identity, request policy, data use, and opt-out instructions for website operators.

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
