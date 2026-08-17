import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '$lib/types/blog.types';

const { posts } = vi.hoisted(() => ({
	posts: [
		{
			slug: 'market-brief-001',
			title: 'Market Brief One',
			date: '2026-08-17',
			description: 'The first Market Brief fixture.',
			tags: ['coffee', 'data', 'supply-chain'],
			pillar: 'market-intelligence',
			draft: false,
			format: 'market-brief',
			edition: 1
		},
		{
			slug: 'an-essay',
			title: 'An Essay',
			date: '2026-08-16',
			description: 'An essay fixture.',
			tags: ['coffee', 'data', 'strategy'],
			pillar: 'market-intelligence',
			draft: false,
			format: 'essay'
		}
	] as BlogPost[]
}));

vi.mock('$lib/server/blog', () => ({
	getAllPosts: vi.fn(async () => posts),
	getAllTags: vi.fn(async () => ['coffee', 'data', 'strategy', 'supply-chain']),
	filterPostsByFormat: vi.fn((input: BlogPost[], format: string) =>
		input.filter((post) => post.format === format)
	)
}));

import { load } from './+page.server';

function loadBlog(format?: string) {
	const url = new URL('https://purveyors.io/blog');
	if (format !== undefined) url.searchParams.set('format', format);
	return load({ url } as never);
}

describe('/blog format archive', () => {
	it('keeps the canonical archive unfiltered by default', async () => {
		const result = await loadBlog();
		if (!result) throw new Error('Expected blog archive data');
		expect(result.posts).toEqual(posts);
		expect(result.selectedFormat).toBeNull();
		expect(result.meta.canonical).toBe('https://purveyors.io/blog');
	});

	it.each([
		['market-brief', 'market-brief-001'],
		['essay', 'an-essay']
	])('filters the existing archive by %s', async (format, expectedSlug) => {
		const result = await loadBlog(format);
		if (!result) throw new Error('Expected filtered blog archive data');
		expect(result.posts.map((post: BlogPost) => post.slug)).toEqual([expectedSlug]);
		expect(result.selectedFormat).toBe(format);
		expect(result.meta.canonical).toBe('https://purveyors.io/blog');

		const schema = JSON.stringify(result.meta.schemaData);
		expect(schema).toContain(`https://purveyors.io/blog/${expectedSlug}`);
		for (const post of posts.filter((candidate) => candidate.slug !== expectedSlug)) {
			expect(schema).not.toContain(`https://purveyors.io/blog/${post.slug}`);
		}
	});

	it('rejects unknown publication formats', async () => {
		await expect(loadBlog('market_read')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Blog format not found: market_read' }
		});
	});
});
