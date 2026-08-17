import { describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '$lib/types/blog.types';

const { marketBrief } = vi.hoisted(() => ({
	marketBrief: {
		slug: 'market-brief-001',
		title: 'Market Brief One',
		date: '2026-08-17',
		updated: '2026-08-18',
		description: 'The first Market Brief fixture.',
		tags: ['coffee', 'data', 'supply-chain'],
		pillar: 'market-intelligence',
		draft: false,
		format: 'market-brief',
		edition: 1
	} as BlogPost
}));

vi.mock('$lib/server/blog', () => ({
	getAllPosts: vi.fn(async () => [marketBrief])
}));

import { load } from './+page.server';

function loadPost(slug: string) {
	return load({
		params: { slug },
		url: new URL(`https://purveyors.io/blog/${slug}`)
	} as never);
}

describe('/blog/[slug] Market Brief metadata', () => {
	it('uses the normalized edition as the sole reader and metadata identity', async () => {
		const result = await loadPost('market-brief-001');
		if (!result) throw new Error('Expected Market Brief reader data');

		expect(result.metadata).toEqual(marketBrief);
		expect(result.meta).toMatchObject({
			title: 'Market Brief One | Purveyors Market Brief',
			canonical: 'https://purveyors.io/blog/market-brief-001',
			ogType: 'article',
			articlePublishedTime: '2026-08-17',
			articleModifiedTime: '2026-08-18',
			articleSection: 'Market Brief'
		});
		expect(JSON.stringify(result.meta.schemaData)).toContain('Purveyors Market Brief');
		expect(JSON.stringify(result.meta.schemaData)).not.toContain('market_read');
	});

	it('keeps unknown edition slugs closed', async () => {
		await expect(loadPost('market-brief-002')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Post not found: market-brief-002' }
		});
	});
});
