import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { BlogPostModule } from '$lib/types/blog.types';

export const load: PageLoad = async ({ params, data: serverData }) => {
	try {
		const post = (await import(`../../../content/blog/${params.slug}.svx`)) as BlogPostModule;

		return {
			...serverData,
			content: post.default,
			metadata: {
				...post.metadata,
				slug: params.slug
			}
		};
	} catch {
		throw error(404, `Post not found: ${params.slug}`);
	}
};
