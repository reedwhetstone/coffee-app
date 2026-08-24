import { afterEach, describe, expect, it, vi } from 'vitest';

describe('blog runtime isolation', () => {
	afterEach(() => {
		vi.doUnmock('$lib/server/marketBriefEmail');
		vi.resetModules();
	});

	it('does not initialize the Market Brief projection for an essay-only corpus', async () => {
		const projectionFactory = vi.fn(() => {
			throw new Error('Market Brief projection initialized');
		});
		vi.doMock('$lib/server/marketBriefEmail', projectionFactory);

		const { getAllPosts } = await import('./blog');
		const posts = await getAllPosts();

		expect(posts.length).toBeGreaterThan(0);
		expect(posts.every((post) => post.format === 'essay')).toBe(true);
		expect(projectionFactory).not.toHaveBeenCalled();
	});
});
