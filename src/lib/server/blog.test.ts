import { describe, expect, it } from 'vitest';
import {
	BLOG_TAG_ALIASES,
	BLOG_TAGS,
	getCanonicalBlogTag,
	isBlogTag,
	validateBlogPostTags,
	type BlogTag
} from '$lib/types/blog.types';
import { getAllPosts, getPostsByTag } from './blog';

const LEGACY_TAG_MEMBERSHIP: Record<keyof typeof BLOG_TAG_ALIASES, string[]> = {
	agentic: [
		'benchmark-leaders-agentic-laggards',
		'building-a-coffee-data-pipeline',
		'building-product-philosophy-into-codebase',
		'enterprise-second-brains-are-not-knowledge-bases',
		'inference-is-in-the-name',
		'sycophancy-is-the-last-hard-problem',
		'two-weeks-with-ai-co-developer'
	],
	agility: ['which-moats-survive-ai-economy'],
	'ai-agents': ['when-more-context-makes-ai-worse'],
	architecture: ['when-more-context-makes-ai-worse'],
	benchmarks: ['benchmark-leaders-agentic-laggards'],
	coding: [
		'benchmark-leaders-agentic-laggards',
		'sycophancy-is-the-last-hard-problem',
		'two-weeks-with-ai-co-developer'
	],
	context: ['building-product-philosophy-into-codebase'],
	'context-engineering': ['when-more-context-makes-ai-worse'],
	'data-pipeline': ['building-a-coffee-data-pipeline', 'llm-fair-use-data-extraction'],
	'decision-making': ['what-should-an-organization-refuse-to-build'],
	'fair-use': ['llm-fair-use-data-extraction'],
	infrastructure: [
		'enterprise-second-brains-are-not-knowledge-bases',
		'inference-is-in-the-name',
		'sycophancy-is-the-last-hard-problem',
		'two-weeks-with-ai-co-developer',
		'why-does-enterprise-ai-cost-more'
	],
	'market-intelligence': [
		'co-fermentation-wrong-question',
		'who-profits-when-coffee-data-stays-scarce'
	],
	memory: ['when-more-context-makes-ai-worse'],
	microsoft: ['why-does-enterprise-ai-cost-more'],
	moats: ['ai-moats-arent-software', 'beyond-the-coffee-belt', 'which-moats-survive-ai-economy'],
	operations: ['inference-is-in-the-name'],
	organizations: ['what-should-an-organization-refuse-to-build'],
	pricing: ['ai-moats-arent-software'],
	purveyors: ['what-is-purveyors']
};

describe('blog tag taxonomy', () => {
	it('uses the canonical nine-tag set', () => {
		expect(BLOG_TAGS).toEqual([
			'ai',
			'agents',
			'coffee',
			'data',
			'engineering',
			'enterprise',
			'product',
			'strategy',
			'supply-chain'
		]);
	});

	it('keeps every published post within the canonical taxonomy', async () => {
		const posts = await getAllPosts();
		expect(posts).toHaveLength(17);
		for (const post of posts) {
			expect([3, 4]).toContain(post.tags.length);
			expect(post.tags.every(isBlogTag)).toBe(true);
		}
	});

	it('preserves legacy tag membership at each redirect destination', async () => {
		for (const [legacyTag, expectedSlugs] of Object.entries(LEGACY_TAG_MEMBERSHIP)) {
			const canonicalTag = getCanonicalBlogTag(legacyTag);
			expect(canonicalTag).toBeDefined();
			const canonicalSlugs = (await getPostsByTag(canonicalTag!)).map((post) => post.slug);
			expect(canonicalSlugs, `${legacyTag} -> ${canonicalTag}`).toEqual(
				expect.arrayContaining(expectedSlugs)
			);
		}
	});

	it('rejects non-canonical content metadata at runtime', () => {
		expect(() => validateBlogPostTags('bad-post', ['ai', 'one-off-tag'])).toThrow(
			'Blog post bad-post uses non-canonical tags: one-off-tag'
		);
		expect(() =>
			validateBlogPostTags('good-post', ['ai', 'agents'] satisfies BlogTag[])
		).not.toThrow();
	});
});
