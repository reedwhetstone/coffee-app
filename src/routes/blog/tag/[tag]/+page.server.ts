import { getPostsByTag } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const posts = await getPostsByTag(params.tag);
	return { posts, tag: params.tag };
};
