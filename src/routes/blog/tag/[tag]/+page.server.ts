import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { getPostsByTag } from '$lib/server/blog';
import { createSchemaService } from '$lib/services/schemaService';

function formatTagLabel(tag: string): string {
	return tag
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export const load: PageServerLoad = async ({ params, url }) => {
	const posts = await getPostsByTag(params.tag);
	const baseUrl = `${url.protocol}//${url.host}`;
	const pageUrl = `${baseUrl}${url.pathname}`;
	const tagLabel = formatTagLabel(params.tag);
	const schemaService = createSchemaService(baseUrl);

	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		{
			'@type': 'CollectionPage',
			name: `${tagLabel} posts on the Purveyors Blog`,
			description: `Browse ${posts.length} Purveyors blog post${posts.length === 1 ? '' : 's'} tagged ${tagLabel}.`,
			url: pageUrl,
			mainEntity: {
				'@type': 'ItemList',
				itemListElement: posts.map((post, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					url: `${baseUrl}/blog/${post.slug}`,
					name: post.title
				}))
			}
		}
	]);

	return {
		posts,
		tag: params.tag,
		meta: buildPublicMeta({
			baseUrl,
			path: url.pathname,
			title: `${tagLabel} Posts | Purveyors Blog`,
			description: `Browse ${posts.length} Purveyors blog post${posts.length === 1 ? '' : 's'} about ${tagLabel.toLowerCase()}.`,
			keywords: [tagLabel, 'Purveyors blog', 'coffee intelligence', 'AI-first development'],
			ogTitle: `${tagLabel} Posts | Purveyors Blog`,
			ogDescription: `Browse ${posts.length} Purveyors blog post${posts.length === 1 ? '' : 's'} tagged ${tagLabel}.`,
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/blog.jpg',
				alt: `Purveyors blog tag page for ${tagLabel}`
			}),
			schemaData
		})
	};
};
