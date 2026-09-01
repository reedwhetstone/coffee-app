import { describe, expect, it } from 'vitest';

import type { BlogPost } from '$lib/types/blog.types';
import {
	buildMarketBriefDeploymentManifest,
	buildMarketBriefEmailProjection,
	buildMarketBriefReaderExport,
	MARKET_BRIEF_EMAIL_RENDERER_VERSION,
	RESEND_UNSUBSCRIBE_PLACEHOLDER
} from './marketBriefEmail';

const marketBrief: BlogPost = {
	slug: 'market-brief-001',
	title: 'Coffee finds a firmer floor',
	date: '2026-08-17',
	description: 'A bounded weekly view of green-coffee supply and pricing.',
	tags: ['coffee', 'data', 'supply-chain'],
	pillar: 'market-intelligence',
	draft: false,
	format: 'market-brief',
	edition: 1
};

const source = `---
title: "Coffee finds a firmer floor"
date: "2026-08-17"
description: "A bounded weekly view of green-coffee supply and pricing."
tags: ["coffee", "data", "supply-chain"]
pillar: "market-intelligence"
draft: false
format: "market-brief"
edition: 1
---

## The throughline

The market moved **carefully**, with [Purveyors context](/analytics) and an
[external source](https://example.com/report?week=1).

- Supply stayed constrained.
- Buyers remained selective.

| Signal | Direction |
| --- | --- |
| Nearby offers | Firmer |

![A coffee warehouse](https://images.example.com/warehouse.jpg)
`;

describe('Market Brief email projection', () => {
	it('renders one deterministic sanitized HTML and text projection from the canonical source', () => {
		const first = buildMarketBriefEmailProjection(marketBrief, source);
		const second = buildMarketBriefEmailProjection(marketBrief, source);

		expect(second).toEqual(first);
		expect(first).toMatchObject({
			rendererVersion: MARKET_BRIEF_EMAIL_RENDERER_VERSION,
			edition: 1,
			slug: 'market-brief-001',
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			subject: 'Market Brief 001 · Coffee finds a firmer floor',
			previewText: 'A bounded weekly view of green-coffee supply and pricing.'
		});
		expect(first.sha256).toBe('30f0c20ba74dc7209e34655add97b7006409bbfd613b0734917be4c505e9871f');
		expect(first.html).toContain('href="https://www.purveyors.io/analytics"');
		expect(first.html).toContain('src="https://images.example.com/warehouse.jpg"');
		expect(first.html).toContain('style="color:#9a4d00;text-decoration:underline;"');
		expect(first.html.match(new RegExp(RESEND_UNSUBSCRIBE_PLACEHOLDER, 'g'))).toHaveLength(1);
		expect(first.html).not.toMatch(/<script|onerror=|javascript:/i);
		expect(first.text).toContain('The throughline');
		expect(first.text).toContain('https://www.purveyors.io/blog/market-brief-001');
		expect(first.text).toContain(RESEND_UNSUBSCRIBE_PLACEHOLDER);
	});

	it('changes the projection digest for content corrections without changing edition identity', () => {
		const original = buildMarketBriefEmailProjection(marketBrief, source);
		const corrected = buildMarketBriefEmailProjection(
			{ ...marketBrief, updated: '2026-08-18' },
			source.replace('Buyers remained selective.', 'Buyers became more selective.')
		);

		expect(corrected.sha256).not.toBe(original.sha256);
		expect(corrected.slug).toBe(original.slug);
		expect(corrected.canonicalUrl).toBe(original.canonicalUrl);
	});

	it.each([
		['raw HTML', source.replace('## The throughline', '<aside>Injected</aside>')],
		['Svelte expression', source.replace('## The throughline', '{dangerousValue}')],
		['multiline Svelte expression', source.replace('## The throughline', '{#if\nvisible}\n{/if}')],
		['Svelte directive', source.replace('## The throughline', '{#if visible}')],
		['task-list control', source.replace('- Supply stayed constrained.', '- [x] Send now')],
		[
			'unsafe link protocol',
			source.replace(
				'[external source](https://example.com/report?week=1)',
				'[bad](javascript:alert(1))'
			)
		],
		[
			'non-HTTPS image',
			source.replace(
				'https://images.example.com/warehouse.jpg',
				'http://images.example.com/warehouse.jpg'
			)
		]
	])('rejects %s instead of silently diverging from the web edition', (_label, invalidSource) => {
		expect(() => buildMarketBriefEmailProjection(marketBrief, invalidSource)).toThrow();
	});

	it('normalizes empty Markdown targets to the canonical reader URL', () => {
		const projection = buildMarketBriefEmailProjection(
			marketBrief,
			source.replace(
				'[external source](https://example.com/report?week=1)',
				'[empty link]() and ![]()'
			)
		);

		expect(projection.html).toContain('<a href="https://www.purveyors.io/blog/market-brief-001"');
		expect(projection.html).toMatch(
			/<img src="https:\/\/www\.purveyors\.io\/blog\/market-brief-001"[^>]*alt=""/i
		);
		expect(projection.html).not.toContain('href=""');
		expect(projection.html).not.toContain('src=""');
	});

	it('decodes entities in prose while preserving code-span text', () => {
		const projection = buildMarketBriefEmailProjection(
			marketBrief,
			source.replace(
				'The market moved **carefully**, with',
				'The market moved &amp; stayed &lt; target &mdash; and `code &amp;`, with'
			)
		);

		expect(projection.text).toContain('The market moved & stayed < target — and code &amp;, with');
		expect(projection.text).not.toContain('&amp; stayed');
		expect(projection.text).not.toContain('&lt; target');
		expect(projection.text).not.toContain('&mdash;');
	});

	it('preserves braces inside supported Markdown code', () => {
		const projection = buildMarketBriefEmailProjection(
			marketBrief,
			source.replace(
				'## The throughline',
				'## The throughline\n\nInline `{value}` and:\n\n```js\nconst record = { value: 1 };\n```'
			)
		);

		expect(projection.text).toContain('Inline {value} and:');
		expect(projection.text).toContain('const record = { value: 1 };');
		expect(projection.html).toContain('code');
	});

	it('rejects malformed source, non-Market Brief input, and oversized source', () => {
		expect(() => buildMarketBriefEmailProjection(marketBrief, '# Missing frontmatter')).toThrow(
			'closed YAML frontmatter'
		);
		expect(() =>
			buildMarketBriefEmailProjection(
				{ ...marketBrief, format: 'essay', edition: undefined },
				source
			)
		).toThrow('is not a Market Brief edition');
		expect(() =>
			buildMarketBriefEmailProjection(marketBrief, `${source}${'x'.repeat(256 * 1024)}`)
		).toThrow('source exceeds');
	});
});

describe('Market Wire reader export', () => {
	it('keeps a clean Markdown body and stable shareable section identities', () => {
		const reader = buildMarketBriefReaderExport(
			marketBrief,
			source.replace(
				'![A coffee warehouse](https://images.example.com/warehouse.jpg)',
				`![A coffee warehouse](https://images.example.com/warehouse.jpg)

## The throughline

A second section with the same title.

## Sources

1. [Example](https://example.com/report?week=1)`
			)
		);

		expect(reader.canonicalUrl).toBe('https://www.purveyors.io/blog/market-brief-001');
		expect(reader.markdown.startsWith('## The throughline')).toBe(true);
		expect(reader.markdown).not.toContain('title: "Coffee finds a firmer floor"');
		expect(reader.markdown.endsWith('\n')).toBe(true);
		expect(reader.sections).toEqual([
			{ id: 'the-throughline', title: 'The throughline' },
			{ id: 'the-throughline-1', title: 'The throughline' }
		]);
	});

	it('resolves relative Markdown links, images, and definitions for portable readers', () => {
		const reader = buildMarketBriefReaderExport(
			marketBrief,
			source
				.replace('[Purveyors context](/analytics)', '[Purveyors context](/analytics "Market data")')
				.replace(
					'![A coffee warehouse](https://images.example.com/warehouse.jpg)',
					'![A coffee warehouse](/images/warehouse.jpg)'
				)
				.replace(
					'[external source](https://example.com/report?week=1)',
					'[external source][report]'
				)
				.concat('\n[report]: /research/market-report "Research report"\n')
		);

		expect(reader.markdown).toContain(
			'[Purveyors context](<https://www.purveyors.io/analytics> "Market data")'
		);
		expect(reader.markdown).toContain(
			'![A coffee warehouse](<https://www.purveyors.io/images/warehouse.jpg>)'
		);
		expect(reader.markdown).toContain(
			'[report]: <https://www.purveyors.io/research/market-report> "Research report"'
		);
		expect(reader.markdown).not.toContain('](/analytics');
		expect(reader.markdown).not.toContain('](/images/warehouse.jpg)');
		expect(reader.markdown).not.toContain('[report]: /research/market-report');
	});

	it('shares the strict Market Brief source boundary with the email projection', () => {
		expect(() => buildMarketBriefReaderExport(marketBrief, '# Missing frontmatter')).toThrow(
			'closed YAML frontmatter'
		);
		expect(() =>
			buildMarketBriefReaderExport({ ...marketBrief, format: 'essay', edition: undefined }, source)
		).toThrow('is not a Market Brief edition');
	});
});

describe('Market Brief deployed identity', () => {
	it('emits a manifest only for an exact Vercel production commit', () => {
		const projection = buildMarketBriefEmailProjection(marketBrief, source);
		const commit = 'a'.repeat(40);

		expect(
			buildMarketBriefDeploymentManifest(projection, {
				VERCEL_ENV: 'production',
				VERCEL_GIT_COMMIT_SHA: commit
			})
		).toEqual({
			schemaVersion: 1,
			publication: 'market-brief',
			edition: 1,
			slug: 'market-brief-001',
			canonicalUrl: 'https://www.purveyors.io/blog/market-brief-001',
			productionCommit: commit,
			rendererVersion: MARKET_BRIEF_EMAIL_RENDERER_VERSION,
			projectionSha256: projection.sha256
		});

		expect(
			buildMarketBriefDeploymentManifest(projection, {
				VERCEL_ENV: 'preview',
				VERCEL_GIT_COMMIT_SHA: commit
			})
		).toBeUndefined();
		expect(
			buildMarketBriefDeploymentManifest(projection, {
				VERCEL_ENV: 'production',
				VERCEL_GIT_COMMIT_SHA: 'not-a-commit'
			})
		).toBeUndefined();
		expect(buildMarketBriefDeploymentManifest(projection, {})).toBeUndefined();
	});

	it('keeps projection integrity separate from the deployed edition version', () => {
		const projection = buildMarketBriefEmailProjection(marketBrief, source);
		const first = buildMarketBriefDeploymentManifest(projection, {
			VERCEL_ENV: 'production',
			VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40)
		});
		const second = buildMarketBriefDeploymentManifest(projection, {
			VERCEL_ENV: 'production',
			VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40)
		});

		expect(first?.projectionSha256).toBe(second?.projectionSha256);
		expect(first?.productionCommit).not.toBe(second?.productionCommit);
	});
});
