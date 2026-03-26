import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolveBlogPostSocialImage } from '$lib/seo/meta';
import { getAllPosts } from '$lib/server/blog';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ params, url }) => {
	const posts = await getAllPosts();
	const post = posts.find((candidate) => candidate.slug === params.slug);

	if (!post) {
		throw error(404, `Post not found: ${params.slug}`);
	}

	const baseUrl = `${url.protocol}//${url.host}`;
	const postUrl = `${baseUrl}/blog/${post.slug}`;
	const author = post.author || 'Reed Whetstone';
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
			dateModified: post.date,
			author: { '@type': 'Person', name: author },
			publisher: { '@type': 'Organization', name: 'Purveyors', url: baseUrl },
			image: {
				'@type': 'ImageObject',
				url: socialImage.url,
				width: socialImage.width,
				height: socialImage.height
			},
			keywords: post.tags,
			mainEntityOfPage: postUrl
		}
	]);

	return {
		meta: buildPublicMeta({
			baseUrl,
			path: `/blog/${post.slug}`,
			title: `${post.title} | Purveyors Blog`,
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
				modifiedTime: post.date,
				author,
				section: post.pillar,
				tags: post.tags
			}
		})
	};
};
