import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { filterPostsByFormat, getAllPosts, getAllTags } from '$lib/server/blog';
import { createSchemaService } from '$lib/services/schemaService';
import { getBlogPostPath, isBlogFormat } from '$lib/types/blog.types';

export const load: PageServerLoad = async ({ url }) => {
	const posts = await getAllPosts();
	const tags = await getAllTags();
	const publishedPosts = posts.filter((post) => !post.draft);
	const requestedFormat = url.searchParams.get('format');
	if (requestedFormat !== null && !isBlogFormat(requestedFormat)) {
		throw error(404, `Blog format not found: ${requestedFormat}`);
	}
	const visiblePosts = requestedFormat ? filterPostsByFormat(posts, requestedFormat) : posts;
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
				url: `${baseUrl}${getBlogPostPath(post.slug)}`,
				datePublished: post.date,
				dateModified: post.updated ?? post.date,
				keywords: post.tags,
				...(post.format === 'market-brief'
					? {
							articleSection: 'Market Brief',
							position: post.edition,
							isPartOf: {
								'@type': 'CreativeWorkSeries',
								name: 'Purveyors Market Brief',
								url: `${baseUrl}/blog`
							}
						}
					: {}),
				author: {
					'@type': 'Person',
					name: post.author || 'Reed Whetstone'
				}
			}))
		}
	]);

	return {
		posts: visiblePosts,
		tags,
		selectedFormat: requestedFormat,
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
