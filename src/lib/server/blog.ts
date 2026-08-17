import {
	BLOG_TAGS,
	getMarketBriefSlug,
	isBlogFormat,
	isBlogTag,
	validateBlogPostTags,
	type BlogFormat,
	type BlogPost,
	type BlogPostFrontmatter,
	type BlogPostModule
} from '$lib/types/blog.types';
import { assertMarketBriefEmailSource } from '$lib/server/marketBriefEmail';

const MARKET_BRIEF_SLUG_PREFIX = 'market-brief-';
const MARKET_BRIEF_PILLAR = 'market-intelligence';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const rawBlogSources = import.meta.glob<string>('/src/content/blog/*.svx', {
	eager: true,
	query: '?raw',
	import: 'default'
});

function isValidIsoDate(value: string): boolean {
	if (!ISO_DATE_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeBlogPost(slug: string, metadata: BlogPostFrontmatter): BlogPost {
	validateBlogPostTags(slug, metadata.tags);

	const rawFormat: unknown = metadata.format ?? 'essay';
	if (typeof rawFormat !== 'string' || !isBlogFormat(rawFormat)) {
		throw new Error(`Blog post ${slug} uses unsupported format: ${String(rawFormat)}`);
	}
	if (metadata.updated !== undefined) {
		if (!isValidIsoDate(metadata.updated) || metadata.updated < metadata.date) {
			throw new Error(`Blog post ${slug} uses an invalid updated date`);
		}
	}

	if (rawFormat === 'market-brief') {
		if (!isValidIsoDate(metadata.date)) {
			throw new Error(`Market Brief ${slug} requires an ISO publication date`);
		}
		if (!Number.isInteger(metadata.edition) || (metadata.edition ?? 0) <= 0) {
			throw new Error(`Market Brief ${slug} requires a positive integer edition`);
		}

		const expectedSlug = getMarketBriefSlug(metadata.edition!);
		if (slug !== expectedSlug) {
			throw new Error(
				`Market Brief edition ${metadata.edition} must use slug ${expectedSlug}, received ${slug}`
			);
		}

		if (metadata.pillar !== MARKET_BRIEF_PILLAR) {
			throw new Error(`Market Brief ${slug} must use the ${MARKET_BRIEF_PILLAR} pillar`);
		}
	} else {
		if (metadata.edition !== undefined) {
			throw new Error(`Essay ${slug} cannot declare a Market Brief edition`);
		}
		if (slug.startsWith(MARKET_BRIEF_SLUG_PREFIX)) {
			throw new Error(`Essay ${slug} cannot use the reserved Market Brief slug prefix`);
		}
	}

	return {
		...metadata,
		slug,
		format: rawFormat
	};
}

export function filterPostsByFormat(posts: BlogPost[], format: BlogFormat): BlogPost[] {
	return posts.filter((post) => post.format === format);
}

export function assertUniqueMarketBriefEditions(posts: BlogPost[]): void {
	const editions = new Set<number>();
	for (const post of posts) {
		if (post.format !== 'market-brief') continue;
		if (editions.has(post.edition!)) {
			throw new Error(`Duplicate Market Brief edition: ${post.edition}`);
		}
		editions.add(post.edition!);
	}
}

export function getRawBlogSource(slug: string): string | undefined {
	return rawBlogSources[`/src/content/blog/${slug}.svx`];
}

/**
 * Load all blog posts from src/content/blog/*.svx
 * Returns sorted by date (newest first), excludes drafts in production
 */
export async function getAllPosts(): Promise<BlogPost[]> {
	const modules = import.meta.glob<BlogPostModule>('/src/content/blog/*.svx', { eager: true });

	const discoveredPosts: BlogPost[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const slug = path.split('/').pop()?.replace('.svx', '') ?? '';
		const post = normalizeBlogPost(slug, module.metadata);
		if (post.format === 'market-brief') {
			const source = getRawBlogSource(slug);
			if (source === undefined) {
				throw new Error(`Market Brief ${slug} is missing its canonical source`);
			}
			assertMarketBriefEmailSource(post, source);
		}
		discoveredPosts.push(post);
	}

	assertUniqueMarketBriefEditions(discoveredPosts);

	const posts: BlogPost[] = [];
	for (const post of discoveredPosts) {
		// Skip drafts in production
		if (post.draft && import.meta.env.PROD) continue;

		// Estimate reading time (~200 words/min)
		// For .svx files we can't easily count words at build time,
		// so we'll use the description length as a rough proxy
		// or let the frontmatter specify it
		posts.push({
			...post,
			readingTime: post.readingTime ?? 5
		});
	}

	// Sort by date, newest first
	posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return posts;
}

/**
 * Get only public blog posts, independent of development preview behavior.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
	return (await getAllPosts()).filter((post) => !post.draft);
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
	return BLOG_TAGS.filter((tag) => tags.has(tag));
}

/**
 * Get posts filtered by tag
 */
export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
	if (!isBlogTag(tag)) return [];

	const posts = await getAllPosts();
	return posts.filter((p) => p.tags.includes(tag));
}

/**
 * Get posts filtered by publication format.
 */
export async function getPostsByFormat(format: BlogFormat): Promise<BlogPost[]> {
	return filterPostsByFormat(await getAllPosts(), format);
}

/**
 * Get posts filtered by pillar
 */
export async function getPostsByPillar(pillar: string): Promise<BlogPost[]> {
	const posts = await getAllPosts();
	return posts.filter((p) => p.pillar === pillar);
}
