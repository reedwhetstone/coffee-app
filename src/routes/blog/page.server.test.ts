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
			slug: 'market-brief-003',
			title: 'Fieldnotes Three',
			date: '2026-09-06',
			description: 'A Fieldnotes fixture.',
			tags: ['coffee', 'technology', 'ideas'],
			pillar: 'market-intelligence',
			draft: false,
			format: 'market-brief',
			newsletter: 'fieldnotes',
			edition: 3
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

	it('keeps each newsletter series metadata on its own canonical landing', async () => {
		const result = await loadBlog();
		if (!result) throw new Error('Expected blog archive data');

		const schema = JSON.stringify(result.meta.schemaData);
		expect(schema).toContain('"name":"Purveyors Market Brief"');
		expect(schema).toContain('"url":"https://purveyors.io/blog"');
		expect(schema).toContain('"name":"Purveyors Fieldnotes"');
		expect(schema).toContain('"url":"https://purveyors.io/fieldnotes"');
	});

	it.each([
		['market-brief', ['market-brief-001', 'market-brief-003']],
		['essay', ['an-essay']]
	])('filters the existing archive by %s', async (format, expectedSlugs) => {
		const result = await loadBlog(format);
		if (!result) throw new Error('Expected filtered blog archive data');
		expect(result.posts.map((post: BlogPost) => post.slug)).toEqual(expectedSlugs);
		expect(result.tags).toEqual(
			format === 'market-brief'
				? ['coffee', 'data', 'ideas', 'supply-chain', 'technology']
				: ['coffee', 'data', 'strategy']
		);
		expect(result.selectedFormat).toBe(format);
		expect(result.meta.canonical).toBe('https://purveyors.io/blog');

		const schema = JSON.stringify(result.meta.schemaData);
		for (const expectedSlug of expectedSlugs) {
			expect(schema).toContain(`https://purveyors.io/blog/${expectedSlug}`);
		}
		for (const post of posts.filter((candidate) => !expectedSlugs.includes(candidate.slug))) {
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
