import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '$lib/types/blog.types';

const {
	buildMarketBriefDeploymentManifestMock,
	buildMarketBriefEmailProjectionMock,
	buildMarketBriefReaderExportMock,
	emailModuleInitializedMock,
	getAllPostsMock,
	getRawMarketBriefSourceMock,
	marketBrief,
	marketBriefSource
} = vi.hoisted(() => ({
	buildMarketBriefDeploymentManifestMock: vi.fn(),
	buildMarketBriefEmailProjectionMock: vi.fn(),
	buildMarketBriefReaderExportMock: vi.fn(),
	emailModuleInitializedMock: vi.fn(),
	getAllPostsMock: vi.fn(),
	getRawMarketBriefSourceMock: vi.fn(),
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
	} as BlogPost,
	marketBriefSource: `---
title: "Market Brief One"
date: "2026-08-17"
description: "The first Market Brief fixture."
tags: ["coffee", "data", "supply-chain"]
pillar: "market-intelligence"
draft: false
format: "market-brief"
edition: 1
---

## This week

The first fixture has a [canonical reader](/blog/market-brief-001).
`
}));

vi.mock('$lib/server/blog', () => ({
	getAllPosts: getAllPostsMock
}));

vi.mock('$lib/server/marketBriefReader', () => ({
	buildMarketBriefReaderExport: buildMarketBriefReaderExportMock,
	getRawMarketBriefSource: getRawMarketBriefSourceMock
}));

vi.mock('$lib/server/marketBriefEmail', () => {
	emailModuleInitializedMock();
	return {
		buildMarketBriefDeploymentManifest: buildMarketBriefDeploymentManifestMock,
		buildMarketBriefEmailProjection: buildMarketBriefEmailProjectionMock
	};
});

import { load } from './+page.server';

function loadPost(slug: string) {
	return load({
		params: { slug },
		url: new URL(`https://purveyors.io/blog/${slug}`)
	} as never);
}

describe('/blog/[slug] Market Brief metadata', () => {
	beforeEach(() => {
		getAllPostsMock.mockResolvedValue([marketBrief]);
		getRawMarketBriefSourceMock.mockImplementation((slug: string) =>
			slug === marketBrief.slug ? marketBriefSource : undefined
		);
		buildMarketBriefEmailProjectionMock.mockReturnValue({
			edition: 1,
			slug: marketBrief.slug,
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			rendererVersion: 'market-brief-email-v1',
			sha256: 'b'.repeat(64)
		});
		buildMarketBriefReaderExportMock.mockReturnValue({
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			markdown: '## This week\n\nThe first fixture.\n',
			sections: [
				{ id: 'this-week', title: 'This week', kind: 'take', html: '<p>The first fixture.</p>' }
			]
		});
		buildMarketBriefDeploymentManifestMock.mockImplementation(
			(_projection: unknown, environment: Record<string, string | undefined>) =>
				environment.VERCEL_ENV === 'production' &&
				/^[0-9a-f]{40}$/.test(environment.VERCEL_GIT_COMMIT_SHA ?? '')
					? {
							schemaVersion: 1,
							publication: 'market-brief',
							edition: 1,
							slug: marketBrief.slug,
							canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
							productionCommit: environment.VERCEL_GIT_COMMIT_SHA,
							rendererVersion: 'market-brief-email-v1',
							projectionSha256: 'b'.repeat(64)
						}
					: undefined
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

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
		expect(result.marketBriefDeployment).toBeUndefined();
		expect(result.marketBriefReader).toEqual({
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			markdown: '## This week\n\nThe first fixture.\n',
			sections: [
				{ id: 'this-week', title: 'This week', kind: 'take', html: '<p>The first fixture.</p>' }
			]
		});
		expect(getRawMarketBriefSourceMock).toHaveBeenCalledWith('market-brief-001');
		expect(buildMarketBriefReaderExportMock).toHaveBeenCalledWith(marketBrief, marketBriefSource);
		expect(emailModuleInitializedMock).not.toHaveBeenCalled();
		expect(buildMarketBriefEmailProjectionMock).not.toHaveBeenCalled();
		expect(buildMarketBriefDeploymentManifestMock).not.toHaveBeenCalled();
	});

	it('keeps Vercel preview readers outside the production email projection path', async () => {
		vi.stubEnv('VERCEL_ENV', 'preview');

		const result = await loadPost('market-brief-001');
		if (!result) throw new Error('Expected Market Brief preview reader data');

		expect(result.marketBriefReader).toBeDefined();
		expect(result.marketBriefDeployment).toBeUndefined();
		expect(buildMarketBriefReaderExportMock).toHaveBeenCalledWith(marketBrief, marketBriefSource);
		expect(emailModuleInitializedMock).not.toHaveBeenCalled();
		expect(buildMarketBriefEmailProjectionMock).not.toHaveBeenCalled();
		expect(buildMarketBriefDeploymentManifestMock).not.toHaveBeenCalled();
	});

	it('advertises the exact projection only from a Vercel production deployment', async () => {
		vi.stubEnv('VERCEL_ENV', 'production');
		vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));
		const result = await loadPost('market-brief-001');
		if (!result) throw new Error('Expected Market Brief reader data');

		expect(result.marketBriefDeployment).toMatchObject({
			schemaVersion: 1,
			publication: 'market-brief',
			edition: 1,
			slug: 'market-brief-001',
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			productionCommit: 'a'.repeat(40),
			rendererVersion: 'market-brief-email-v1',
			projectionSha256: 'b'.repeat(64)
		});
		expect(buildMarketBriefEmailProjectionMock).toHaveBeenCalledWith(
			marketBrief,
			marketBriefSource
		);
		expect(buildMarketBriefDeploymentManifestMock).toHaveBeenCalled();
		expect(emailModuleInitializedMock).toHaveBeenCalledOnce();
	});

	it('keeps ordinary essays outside the projection and deployed-manifest path', async () => {
		getAllPostsMock.mockResolvedValueOnce([
			{
				...marketBrief,
				slug: 'ordinary-essay',
				format: 'essay',
				edition: undefined
			}
		]);
		vi.stubEnv('VERCEL_ENV', 'production');
		vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));

		const result = await loadPost('ordinary-essay');
		if (!result) throw new Error('Expected essay reader data');

		expect(result.marketBriefDeployment).toBeUndefined();
		expect(result.marketBriefReader).toBeUndefined();
		expect(getRawMarketBriefSourceMock).not.toHaveBeenCalled();
		expect(buildMarketBriefEmailProjectionMock).not.toHaveBeenCalled();
		expect(buildMarketBriefReaderExportMock).not.toHaveBeenCalled();
		expect(buildMarketBriefDeploymentManifestMock).not.toHaveBeenCalled();
	});

	it('fails closed when a Market Brief loses its canonical source', async () => {
		getRawMarketBriefSourceMock.mockReturnValueOnce(undefined);

		await expect(loadPost('market-brief-001')).rejects.toMatchObject({
			status: 500,
			body: { message: 'Market Brief source not found: market-brief-001' }
		});
	});

	it('keeps unknown edition slugs closed', async () => {
		await expect(loadPost('market-brief-002')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Post not found: market-brief-002' }
		});
	});
});
