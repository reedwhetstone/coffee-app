import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlogPostFrontmatter, BlogPostModule } from '$lib/types/blog.types';

describe('blog runtime isolation', () => {
	afterEach(() => {
		vi.doUnmock('$lib/server/marketBriefEmail');
		vi.resetModules();
	});

	it('does not initialize the Market Brief projection for an essay corpus', async () => {
		const projectionFactory = vi.fn(() => {
			throw new Error('Market Brief projection initialized');
		});
		vi.doMock('$lib/server/marketBriefEmail', projectionFactory);

		const { getPostsFromModules } = await import('./blog');
		const metadata = {
			title: 'An essay',
			date: '2026-08-17',
			description: 'A test essay.',
			tags: ['coffee', 'data', 'strategy'],
			pillar: 'market-intelligence',
			draft: false,
			format: 'essay'
		} satisfies BlogPostFrontmatter;
		const modules = {
			'/src/content/blog/an-essay.svx': {
				metadata,
				default: {} as BlogPostModule['default']
			}
		} satisfies Record<string, BlogPostModule>;
		const posts = getPostsFromModules(modules);

		expect(posts.length).toBeGreaterThan(0);
		expect(posts.every((post) => post.format === 'essay')).toBe(true);
		expect(projectionFactory).not.toHaveBeenCalled();
	});

	it('keeps the projection renderer out of shared enumeration when an edition exists', async () => {
		const projectionFactory = vi.fn(() => {
			throw new Error('Market Brief projection initialized during shared enumeration');
		});
		vi.doMock('$lib/server/marketBriefEmail', projectionFactory);

		const { getPostsFromModules } = await import('./blog');
		const metadata = {
			title: 'Market Brief',
			date: '2026-08-17',
			description: 'A test edition.',
			tags: ['coffee', 'data', 'strategy'],
			pillar: 'market-intelligence',
			draft: false,
			format: 'market-brief',
			edition: 1
		} satisfies BlogPostFrontmatter;
		const modules = {
			'/src/content/blog/market-brief-001.svx': {
				metadata,
				default: {} as BlogPostModule['default']
			}
		} satisfies Record<string, BlogPostModule>;

		expect(getPostsFromModules(modules)).toMatchObject([
			{ slug: 'market-brief-001', format: 'market-brief', edition: 1 }
		]);
		expect(projectionFactory).not.toHaveBeenCalled();
	});
});
