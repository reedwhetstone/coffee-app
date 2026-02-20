import { getAllPosts, getAllTags } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const posts = await getAllPosts();
	const tags = await getAllTags();

	return { posts, tags };
};
