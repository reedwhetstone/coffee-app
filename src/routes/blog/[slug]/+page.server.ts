import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolveBlogPostSocialImage } from '$lib/seo/meta';
import { getAllPosts } from '$lib/server/blog';
import { createSchemaService } from '$lib/services/schemaService';
import { getBlogPostPath } from '$lib/types/blog.types';

export const load: PageServerLoad = async ({ params, url }) => {
	const posts = await getAllPosts();
	const post = posts.find((candidate) => candidate.slug === params.slug);

	if (!post) {
		throw error(404, `Post not found: ${params.slug}`);
	}

	const baseUrl = `${url.protocol}//${url.host}`;
	const postPath = getBlogPostPath(post.slug);
	const postUrl = `${baseUrl}${postPath}`;
	const author = post.author || 'Reed Whetstone';
	const isMarketBrief = post.format === 'market-brief';
	const socialImage = resolveBlogPostSocialImage({
		baseUrl,
		slug: post.slug,
		title: post.title
	});
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		{
			'@type': 'BlogPosting',
			headline: post.title,
			description: post.description,
			datePublished: post.date,
			dateModified: post.updated ?? post.date,
			author: { '@type': 'Person', name: author },
			publisher: { '@type': 'Organization', name: 'Purveyors', url: baseUrl },
			image: {
				'@type': 'ImageObject',
				url: socialImage.url,
				width: socialImage.width,
				height: socialImage.height
			},
			keywords: post.tags,
			articleSection: isMarketBrief ? 'Market Brief' : post.pillar,
			...(isMarketBrief
				? {
						position: post.edition,
						isPartOf: {
							'@type': 'CreativeWorkSeries',
							name: 'Purveyors Market Brief',
							url: `${baseUrl}/blog`
						}
					}
				: {}),
			mainEntityOfPage: postUrl
		}
	]);

	return {
		metadata: post,
		meta: buildPublicMeta({
			baseUrl,
			path: postPath,
			title: `${post.title} | ${isMarketBrief ? 'Purveyors Market Brief' : 'Purveyors Blog'}`,
			description: post.description,
			keywords: post.tags,
			ogTitle: post.title,
			ogDescription: post.description,
			twitterTitle: post.title,
			twitterDescription: post.description,
			type: 'article',
			author,
			image: socialImage,
			schemaData,
			article: {
				publishedTime: post.date,
				modifiedTime: post.updated ?? post.date,
				author,
				section: isMarketBrief ? 'Market Brief' : post.pillar,
				tags: post.tags
			}
		})
	};
};
