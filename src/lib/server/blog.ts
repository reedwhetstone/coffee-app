import type { BlogPost, BlogPostModule } from '$lib/types/blog.types';

/**
 * Load all blog posts from src/content/blog/*.svx
 * Returns sorted by date (newest first), excludes drafts in production
 */
export async function getAllPosts(): Promise<BlogPost[]> {
	const modules = import.meta.glob<BlogPostModule>('/src/content/blog/*.svx', { eager: true });

	const posts: BlogPost[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const slug = path.split('/').pop()?.replace('.svx', '') ?? '';
		const metadata = module.metadata;

		// Skip drafts in production
		if (metadata.draft && import.meta.env.PROD) continue;

		// Estimate reading time (~200 words/min)
		// For .svx files we can't easily count words at build time,
		// so we'll use the description length as a rough proxy
		// or let the frontmatter specify it
		posts.push({
			...metadata,
			slug,
			readingTime: metadata.readingTime ?? 5
		});
	}

	// Sort by date, newest first
	posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return posts;
}

/**
 * Get all unique tags across all posts
 */
export async function getAllTags(): Promise<string[]> {
	const posts = await getAllPosts();
	const tags = new Set<string>();
	for (const post of posts) {
		for (const tag of post.tags) {
			tags.add(tag);
		}
	}
	return [...tags].sort();
}

/**
 * Get posts filtered by tag
 */
export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
	const posts = await getAllPosts();
	return posts.filter((p) => p.tags.includes(tag));
}

/**
 * Get posts filtered by pillar
 */
export async function getPostsByPillar(pillar: string): Promise<BlogPost[]> {
	const posts = await getAllPosts();
	return posts.filter((p) => p.pillar === pillar);
}
