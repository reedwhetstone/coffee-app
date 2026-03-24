import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/blog';

export const load: PageServerLoad = async ({ params, url }) => {
	const posts = await getAllPosts();
	const post = posts.find((p) => p.slug === params.slug);

	if (!post) {
		throw error(404, `Post not found: ${params.slug}`);
	}

	const baseUrl = `${url.protocol}//${url.host}`;
	const postUrl = `${baseUrl}/blog/${post.slug}`;
	const heroImage = `${baseUrl}/blog/images/${post.slug}/hero.webp`;

	return {
		meta: {
			title: `${post.title} | Purveyors Blog`,
			description: post.description,
			canonical: postUrl,
			ogTitle: post.title,
			ogDescription: post.description,
			ogType: 'article' as const,
			ogUrl: postUrl,
			ogImage: heroImage,
			ogSiteName: 'Purveyors',
			twitterCard: 'summary_large_image' as const,
			twitterTitle: post.title,
			twitterDescription: post.description,
			twitterImage: heroImage,
			articlePublishedTime: post.date,
			articleTags: post.tags,
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: post.title,
				description: post.description,
				datePublished: post.date,
				author: { '@type': 'Person', name: 'Reed Whetstone' },
				publisher: { '@type': 'Organization', name: 'Purveyors', url: 'https://purveyors.io' },
				image: heroImage,
				mainEntityOfPage: postUrl
			}
		}
	};
};
