import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { getAllPosts, getAllTags } from '$lib/server/blog';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ url }) => {
	const posts = await getAllPosts();
	const tags = await getAllTags();
	const publishedPosts = posts.filter((post) => !post.draft);
	const baseUrl = `${url.protocol}//${url.host}`;
	const pageUrl = `${baseUrl}/blog`;
	const schemaService = createSchemaService(baseUrl);

	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		{
			'@type': 'Blog',
			name: 'Purveyors Blog',
			description:
				'Coffee intelligence, AI-first product development, and supply chain technology from the team behind Purveyors.',
			url: pageUrl,
			publisher: {
				'@type': 'Organization',
				name: 'Purveyors',
				url: baseUrl
			},
			blogPost: publishedPosts.slice(0, 10).map((post) => ({
				'@type': 'BlogPosting',
				headline: post.title,
				description: post.description,
				url: `${baseUrl}/blog/${post.slug}`,
				datePublished: post.date,
				keywords: post.tags,
				author: {
					'@type': 'Person',
					name: post.author || 'Reed Whetstone'
				}
			}))
		}
	]);

	return {
		posts,
		tags,
		meta: buildPublicMeta({
			baseUrl,
			path: '/blog',
			title: 'Purveyors Blog — Coffee Intelligence & AI-First Development',
			description:
				'Insights on green coffee market data, AI-first product development, and supply chain technology from the team behind Purveyors.',
			keywords: [
				'coffee intelligence',
				'green coffee market data',
				'AI-first product development',
				'supply chain technology',
				'Purveyors blog'
			],
			twitterTitle: 'Purveyors Blog — Coffee Intelligence & AI-First Development',
			twitterDescription:
				'Green coffee market data, AI-first product development, and supply chain technology from Purveyors.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/blog.jpg',
				alt: 'Purveyors blog social preview card'
			}),
			schemaData
		})
	};
};
