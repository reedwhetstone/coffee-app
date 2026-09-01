import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '$lib/types/blog.types';

const { buildReaderMock, getAllPostsMock, getSourceMock } = vi.hoisted(() => ({
	buildReaderMock: vi.fn(),
	getAllPostsMock: vi.fn(),
	getSourceMock: vi.fn()
}));

vi.mock('$lib/server/blog', () => ({ getAllPosts: getAllPostsMock }));
vi.mock('$lib/server/marketBriefReader', () => ({
	buildMarketBriefReaderExport: buildReaderMock,
	getRawMarketBriefSource: getSourceMock
}));

import { GET } from './+server';

const marketBrief = {
	slug: 'market-brief-007',
	title: 'Coffee finds a floor',
	date: '2026-08-30',
	description: 'A weekly market read.',
	tags: ['coffee', 'data', 'supply-chain'],
	pillar: 'market-intelligence',
	draft: false,
	format: 'market-brief',
	edition: 7
} as BlogPost;

function request(slug: string) {
	return GET({ params: { slug } } as never);
}

describe('/blog/[slug]/markdown', () => {
	beforeEach(() => {
		getAllPostsMock.mockResolvedValue([marketBrief]);
		getSourceMock.mockReturnValue('raw-source');
		buildReaderMock.mockReturnValue({
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-007',
			markdown: '## Supply tightens\n\nOffers narrowed.\n',
			sections: [{ id: 'supply-tightens', title: 'Supply tightens' }]
		});
	});

	it('serves only the clean Markdown body with a stable filename', async () => {
		const response = await request('market-brief-007');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe(
			'inline; filename="market-brief-007.md"'
		);
		expect(await response.text()).toBe('## Supply tightens\n\nOffers narrowed.\n');
		expect(buildReaderMock).toHaveBeenCalledWith(marketBrief, 'raw-source');
	});

	it('keeps essays and unknown slugs outside the export route', async () => {
		getAllPostsMock.mockResolvedValueOnce([{ ...marketBrief, slug: 'essay', format: 'essay' }]);
		await expect(request('essay')).rejects.toMatchObject({ status: 404 });
		await expect(request('missing')).rejects.toMatchObject({ status: 404 });
	});

	it('fails closed when an admitted edition loses its canonical source', async () => {
		getSourceMock.mockReturnValueOnce(undefined);
		await expect(request('market-brief-007')).rejects.toMatchObject({ status: 500 });
	});
});
