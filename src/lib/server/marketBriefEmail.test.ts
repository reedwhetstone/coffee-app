import { describe, expect, it } from 'vitest';
import { marked } from 'marked';

import type { BlogPost } from '$lib/types/blog.types';
import { getAllPosts } from './blog';
import {
	buildMarketBriefDeploymentManifest,
	buildMarketBriefEmailProjection,
	buildMarketBriefReaderExport,
	MARKET_BRIEF_EMAIL_RENDERER_VERSION,
	RESEND_UNSUBSCRIBE_PLACEHOLDER
} from './marketBriefEmail';
import { getRawMarketBriefSource } from './marketBriefReader';

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
	it('brands an explicitly opted-in edition without requiring a market read or completed experiment', () => {
		const fieldnotes = { ...marketBrief, newsletter: 'fieldnotes' as const };
		const ideaSource =
			source.slice(0, source.indexOf('---', 3) + 3) +
			'\n\n## A new coffee possibility\n\nCould small models help us explore catalog availability? [Start here](https://example.com/model).\n';
		const projection = buildMarketBriefEmailProjection(fieldnotes, ideaSource);
		expect(projection.subject).toBe('Fieldnotes 001 · Coffee finds a firmer floor');
		expect(projection.html).toContain('Purveyors Fieldnotes · Edition 001');
		expect(projection.text).toContain('Unsubscribe from Fieldnotes:');
		expect(projection.html).not.toContain('Research Spotlight');
		expect(projection.html).not.toContain('Market snapshot');
		expect(buildMarketBriefReaderExport(fieldnotes, ideaSource).sections).toEqual([
			expect.objectContaining({ title: 'A new coffee possibility', kind: 'take' })
		]);
	});

	it('projects every published Market Brief from its canonical source', async () => {
		const publishedBriefs = (await getAllPosts()).filter(
			(post) => post.format === 'market-brief' && !post.draft
		);

		expect(publishedBriefs.length).toBeGreaterThan(0);
		for (const post of publishedBriefs) {
			const canonicalSource = getRawMarketBriefSource(post.slug);
			expect(canonicalSource, `Missing canonical source for ${post.slug}`).toBeDefined();
			expect(() => buildMarketBriefEmailProjection(post, canonicalSource!)).not.toThrow();
		}
	});

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
		expect(first.sha256).toBe('4cbe2ae7622630e01e30f077779f7d4ed1b58c79af54c97bda18175e6e20e5d8');
		expect(first.html).toContain('href="https://www.purveyors.io/analytics"');
		expect(first.html).toContain('src="https://images.example.com/warehouse.jpg"');
		expect(first.html).toContain('style="color:#9a4d00;text-decoration:underline;"');
		expect(first.html.match(new RegExp(RESEND_UNSUBSCRIBE_PLACEHOLDER, 'g'))).toHaveLength(1);
		expect(first.html).not.toMatch(/<script|onerror=|javascript:/i);
		expect(first.text).toContain('The throughline');
		expect(first.text).toContain('https://www.purveyors.io/blog/market-brief-001');
		expect(first.text).toContain(RESEND_UNSUBSCRIBE_PLACEHOLDER);
	});

	it('includes frozen snapshot and coffee facts in both email formats without Markdown duplicates', () => {
		const post: BlogPost = {
			...marketBrief,
			marketSnapshot: {
				asOf: '2026-09-06',
				scope: 'Green catalog',
				movementPercent: -0.25,
				movementLabel: 'Weekly matched movement',
				listings: 120,
				matchedListings: 90,
				suppliers: 6,
				totalSignals: 12,
				belowBenchmark: 7,
				scoreOutliers: 3,
				priceDrops: 2,
				priceStatsUrl: '/analytics',
				signalsUrl: '/catalog?signals=true'
			},
			coffeeHighlights: [
				{
					catalogId: 42,
					name: 'Kenya selection',
					supplier: 'Example supplier',
					supplierUrl: 'https://example.com/coffee',
					catalogUrl: '/catalog/42',
					origin: 'Kenya',
					region: 'Nyeri',
					process: 'Washed',
					variety: 'SL28',
					pricePerLb: 8.5,
					priceContext: 'One-pound tier',
					stockedDate: '2026-09-01',
					rationale: 'A useful comparison for the weekly basket.'
				}
			]
		};
		const projection = buildMarketBriefEmailProjection(
			post,
			source + '\n## Sources\n\nEvidence list.'
		);
		for (const value of [
			'Market snapshot',
			'Green catalog',
			'-0.25%',
			'120 listings',
			'90 matched listings',
			'6 suppliers',
			'12 signals',
			'7 below benchmark',
			'3 score outliers',
			'2 price drops',
			'Coffee highlights',
			'Kenya selection',
			'Example supplier',
			'Nyeri',
			'Washed',
			'SL28',
			'$8.50/lb',
			'One-pound tier',
			'Stocked 2026-09-01',
			'A useful comparison for the weekly basket.',
			'https://www.purveyors.io/catalog/42',
			'https://example.com/coffee'
		]) {
			expect(projection.html).toContain(value);
			expect(projection.text).toContain(value);
		}
		expect(projection.text.indexOf('Kenya selection')).toBeLessThan(
			projection.text.indexOf('Sources')
		);
		expect(projection.sha256).not.toBe(buildMarketBriefEmailProjection(marketBrief, source).sha256);
		expect(
			buildMarketBriefEmailProjection(post, source + '\n## Sources\n\nEvidence list.')
		).toEqual(projection);
		const legacy = buildMarketBriefEmailProjection(
			post,
			source + '\n## Coffee highlights\n\nSelection context.\n## Sources\n\nEvidence list.'
		);
		expect(legacy.text.match(/Coffee highlights/g)).toHaveLength(1);
		expect(legacy.text).toContain('Selection context.');
	});

	it('escapes structured prose as literal text and rejects unsafe structured links', () => {
		const coffee = {
			catalogId: 42,
			name: '<img src=x onerror=alert(1)> & **coffee**',
			supplier: 'A & B',
			supplierUrl: 'https://example.com/?a=1&b=2',
			catalogUrl: '/catalog/42',
			origin: 'Kenya',
			region: 'Nyeri',
			pricePerLb: 8.5,
			rationale: '[click](javascript:alert(1)) {value}'
		};
		const projection = buildMarketBriefEmailProjection(
			{ ...marketBrief, coffeeHighlights: [coffee] },
			source
		);
		expect(projection.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; **coffee**');
		expect(projection.html).not.toContain('<img src=x');
		expect(projection.html).not.toContain('href="javascript:');
		expect(projection.html).toContain('href="https://example.com/?a=1&amp;b=2"');
		expect(projection.text).toContain(coffee.name);
		expect(projection.text).toContain(coffee.rationale);
		expect(projection.text).toContain('Available when selected');
		const reader = buildMarketBriefReaderExport(
			{ ...marketBrief, coffeeHighlights: [coffee] },
			source
		);
		const portableHtml = marked.parse(reader.markdown) as string;
		expect(portableHtml).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; **coffee**');
		expect(portableHtml).not.toContain('<img src=x');
		expect(portableHtml).not.toContain('href="javascript:');
		expect(portableHtml).toContain('[click](javascript:alert(1)) {value}');
		expect(portableHtml).toContain('<h2>Coffee highlights</h2>');

		for (const field of ['catalogUrl', 'supplierUrl']) {
			expect(() =>
				buildMarketBriefEmailProjection(
					{ ...marketBrief, coffeeHighlights: [{ ...coffee, [field]: 'javascript:alert(1)' }] },
					source
				)
			).toThrow('unsupported protocol');
		}
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
	it('rejects duplicate spotlights consistently instead of silently omitting research on the web', () => {
		const duplicate = `${source}\n## Research  Spotlight\n\n### Storage\n\nFirst topic.\n\n## research\u00a0spotlight\n\n### Fermentation\n\nSecond topic.`;
		for (const project of [buildMarketBriefReaderExport, buildMarketBriefEmailProjection]) {
			expect(() => project(marketBrief, duplicate)).toThrow('at most one Research Spotlight');
		}
	});

	it('preserves a standalone research topic and citations across web, email and Markdown', () => {
		const researchSource = `${source}
## Research Spotlight

### How storage affects aroma

A [storage study](https://example.com/study) compares two conditions.

The comparison does not establish the same result for every origin. See [this section](#research-spotlight).

## Coffee highlights

A separate coffee selection.
`;
		const reader = buildMarketBriefReaderExport(marketBrief, researchSource);
		const spotlight = reader.sections.find((section) => section.kind === 'research-spotlight');
		expect(spotlight).toMatchObject({ id: 'research-spotlight', title: 'Research Spotlight' });
		expect(spotlight?.html).toContain('<h3>How storage affects aroma</h3>');
		expect(spotlight?.html).toContain('https://example.com/study');
		expect(spotlight?.html).not.toContain('A separate coffee selection');
		expect(reader.sections.filter((section) => section.kind === 'take')).toHaveLength(1);
		expect(reader.markdown).toContain('## Research Spotlight\n\n### How storage affects aroma');
		expect(reader.markdown).toContain(`${reader.canonicalUrl}#research-spotlight`);
		const email = buildMarketBriefEmailProjection(marketBrief, researchSource);
		expect(email.html).toContain('>Research Spotlight</h2>');
		expect(email.html).toContain('>How storage affects aroma</h3>');
		expect(email.html).toContain('href="https://example.com/study"');
		expect(email.html).toContain(`href="${reader.canonicalUrl}#research-spotlight"`);
		expect(email.text).toContain('Research Spotlight\n\nHow storage affects aroma');
		expect(email.text).toContain('storage study (https://example.com/study)');
	});

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
			{
				id: 'the-throughline',
				title: 'The throughline',
				kind: 'take',
				html: expect.stringContaining('Purveyors context')
			},
			{
				id: 'the-throughline-1',
				title: 'The throughline',
				kind: 'take',
				html: expect.stringContaining('second section')
			}
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
