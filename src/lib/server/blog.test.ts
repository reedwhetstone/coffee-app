import { describe, expect, it } from 'vitest';
import {
	BLOG_TAG_ALIASES,
	BLOG_TAGS,
	getBlogPostPath,
	getMarketBriefSlug,
	getCanonicalBlogTag,
	isBlogTag,
	validateBlogPostTags,
	type BlogPost,
	type BlogPostFrontmatter,
	type BlogTag
} from '$lib/types/blog.types';
import {
	assertUniqueMarketBriefEditions,
	filterPostsByFormat,
	getAllPosts,
	normalizeBlogPost,
	getPostsByTag
} from './blog';

const ESSAY_FRONTMATTER: BlogPostFrontmatter = {
	title: 'An essay',
	date: '2026-08-17',
	description: 'A test essay.',
	tags: ['coffee', 'data', 'strategy'],
	pillar: 'market-intelligence',
	draft: false
};

const MARKET_BRIEF_FRONTMATTER: BlogPostFrontmatter = {
	...ESSAY_FRONTMATTER,
	title: 'Market Brief',
	format: 'market-brief',
	edition: 1
};

const MARKET_BRIEF_PRESENTATION = {
	marketSnapshot: {
		asOf: '2026-09-01',
		scope: 'US retail green coffee',
		movementPercent: -0.2,
		movementLabel: 'Quiet',
		listings: 593,
		matchedListings: 524,
		suppliers: 24,
		totalSignals: 124,
		belowBenchmark: 117,
		scoreOutliers: 7,
		priceDrops: 0,
		priceStatsUrl: 'https://api.purveyors.io/v1/price-index/stats',
		signalsUrl: 'https://api.purveyors.io/v1/market/signals?summary=true'
	},
	coffeeHighlights: [
		{
			catalogId: 9762,
			name: 'Kahondo Station Natural',
			supplier: 'Burman Coffee Traders',
			supplierUrl: 'https://burmancoffee.com/coffee/kahondo',
			catalogUrl: '/catalog?coffee=9762',
			origin: 'Congo',
			region: 'North Kivu',
			process: 'Natural',
			pricePerLb: 8.69,
			stockedDate: '2026-08-08',
			tastingNotes: {
				body: { tag: 'syrupy', color: '#b06a3b', score: 4 },
				flavor: { tag: 'dark berry', color: '#9d2f5e', score: 5 },
				acidity: { tag: 'soft citric', color: '#f4d03f', score: 4 },
				sweetness: { tag: 'milk chocolate', color: '#7a4a2b', score: 5 },
				fragrance_aroma: { tag: 'blackberry jam', color: '#7b2d8b', score: 5 }
			},
			rationale: 'A current coffee tied to the week’s origin-access story.'
		}
	]
} satisfies Pick<BlogPostFrontmatter, 'marketSnapshot' | 'coffeeHighlights'>;

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
		expect(posts.length).toBeGreaterThan(0);
		for (const post of posts) {
			expect([3, 4]).toContain(post.tags.length);
			expect(post.tags.every(isBlogTag)).toBe(true);
			if (post.format === 'market-brief') {
				expect(post.edition).toBeGreaterThan(0);
				expect(post.slug).toBe(getMarketBriefSlug(post.edition!));
			} else {
				expect(post.format).toBe('essay');
				expect(post.edition).toBeUndefined();
			}
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

describe('Market Brief publication metadata', () => {
	it('normalizes legacy essays without changing their canonical identity', () => {
		const post = normalizeBlogPost('an-essay', ESSAY_FRONTMATTER);

		expect(post).toMatchObject({ slug: 'an-essay', format: 'essay' });
		expect(post.edition).toBeUndefined();
		expect(getBlogPostPath(post.slug)).toBe('/blog/an-essay');
	});

	it('binds a positive edition to one zero-padded canonical slug', () => {
		const post = normalizeBlogPost('market-brief-001', MARKET_BRIEF_FRONTMATTER);

		expect(post).toMatchObject({
			slug: 'market-brief-001',
			format: 'market-brief',
			edition: 1
		});
		expect(getMarketBriefSlug(1)).toBe('market-brief-001');
		expect(getMarketBriefSlug(1000)).toBe('market-brief-1000');
		expect(getBlogPostPath(post.slug)).toBe('/blog/market-brief-001');
	});

	it('admits an internally consistent market snapshot and one to three catalog highlights', () => {
		const post = normalizeBlogPost('market-brief-001', {
			...MARKET_BRIEF_FRONTMATTER,
			...MARKET_BRIEF_PRESENTATION
		});

		expect(post.marketSnapshot?.matchedListings).toBe(524);
		expect(post.coffeeHighlights).toHaveLength(1);
	});

	it('rejects incomplete or inconsistent Market Brief presentation evidence', () => {
		expect(() =>
			normalizeBlogPost('market-brief-001', {
				...MARKET_BRIEF_FRONTMATTER,
				marketSnapshot: MARKET_BRIEF_PRESENTATION.marketSnapshot
			})
		).toThrow('must declare marketSnapshot and coffeeHighlights together');

		expect(() =>
			normalizeBlogPost('market-brief-001', {
				...MARKET_BRIEF_FRONTMATTER,
				...MARKET_BRIEF_PRESENTATION,
				marketSnapshot: {
					...MARKET_BRIEF_PRESENTATION.marketSnapshot,
					totalSignals: 125
				}
			})
		).toThrow('marketSnapshot is internally inconsistent');
	});

	it.each([
		['missing', undefined],
		['zero', 0],
		['negative', -1],
		['fractional', 1.5]
	])('rejects a %s Market Brief edition', (_label, edition) => {
		expect(() =>
			normalizeBlogPost('market-brief-001', { ...MARKET_BRIEF_FRONTMATTER, edition })
		).toThrow('requires a positive integer edition');
	});

	it('rejects mismatched slugs and pillars', () => {
		expect(() => normalizeBlogPost('market-brief-002', MARKET_BRIEF_FRONTMATTER)).toThrow(
			'must use slug market-brief-001'
		);
		expect(() =>
			normalizeBlogPost('market-brief-001', {
				...MARKET_BRIEF_FRONTMATTER,
				pillar: 'supply-chain'
			})
		).toThrow('must use the market-intelligence pillar');
	});

	it('reserves edition metadata and slugs for the Market Brief format', () => {
		expect(() => normalizeBlogPost('an-essay', { ...ESSAY_FRONTMATTER, edition: 1 })).toThrow(
			'cannot declare a Market Brief edition'
		);
		expect(() => normalizeBlogPost('market-brief-001', ESSAY_FRONTMATTER)).toThrow(
			'cannot use the reserved Market Brief slug prefix'
		);
	});

	it('validates correction dates without changing the edition identity', () => {
		const corrected = normalizeBlogPost('market-brief-001', {
			...MARKET_BRIEF_FRONTMATTER,
			updated: '2026-08-18'
		});
		expect(corrected.updated).toBe('2026-08-18');

		expect(() =>
			normalizeBlogPost('market-brief-001', {
				...MARKET_BRIEF_FRONTMATTER,
				updated: '2026-08-16'
			})
		).toThrow('uses an invalid updated date');
	});

	it('rejects duplicate editions and filters normalized posts by format', () => {
		const marketBrief = normalizeBlogPost('market-brief-001', MARKET_BRIEF_FRONTMATTER);
		const essay = normalizeBlogPost('an-essay', ESSAY_FRONTMATTER);
		const posts = [marketBrief, essay] satisfies BlogPost[];

		expect(filterPostsByFormat(posts, 'market-brief')).toEqual([marketBrief]);
		expect(filterPostsByFormat(posts, 'essay')).toEqual([essay]);
		expect(() => assertUniqueMarketBriefEditions([marketBrief, { ...marketBrief }])).toThrow(
			'Duplicate Market Brief edition: 1'
		);
	});
});
