import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '$lib/types/blog.types';

const { publishedPosts } = vi.hoisted(() => ({
	publishedPosts: [
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
		}
	] as BlogPost[]
}));

vi.mock('$lib/server/blog', () => ({
	getPublishedPosts: vi.fn(async () => publishedPosts)
}));

import { GET } from './+server';

describe('/blog/feed.xml Market Brief projection', () => {
	it('uses the canonical edition URL and public format category exactly once', async () => {
		const response = await GET({} as never);
		const xml = await response.text();

		expect(xml).toContain('<link>https://purveyors.io/blog/market-brief-001</link>');
		expect(xml).toContain(
			'<guid isPermaLink="true">https://purveyors.io/blog/market-brief-001</guid>'
		);
		expect(xml.match(/<category>Market Brief<\/category>/g)).toHaveLength(1);
		expect(xml).not.toContain('market_read');
	});
});
