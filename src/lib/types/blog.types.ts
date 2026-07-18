export interface BlogPost {
	slug: string;
	title: string;
	date: string;
	description: string;
	tags: BlogTag[];
	pillar: string;
	draft: boolean;
	author?: string;
	readingTime?: number;
}

export const BLOG_TAGS = [
	'ai',
	'agents',
	'coffee',
	'data',
	'engineering',
	'enterprise',
	'product',
	'strategy',
	'supply-chain'
] as const;

export type BlogTag = (typeof BLOG_TAGS)[number];

export const BLOG_TAG_ALIASES = {
	agentic: 'agents',
	agility: 'strategy',
	'ai-agents': 'agents',
	architecture: 'engineering',
	benchmarks: 'engineering',
	coding: 'engineering',
	context: 'engineering',
	'context-engineering': 'engineering',
	'data-pipeline': 'data',
	'decision-making': 'strategy',
	'fair-use': 'data',
	infrastructure: 'engineering',
	'market-intelligence': 'data',
	memory: 'agents',
	microsoft: 'enterprise',
	moats: 'strategy',
	operations: 'engineering',
	organizations: 'product',
	pricing: 'strategy',
	purveyors: 'product'
} as const satisfies Readonly<Record<string, BlogTag>>;

export function isBlogTag(value: string): value is BlogTag {
	return BLOG_TAGS.includes(value as BlogTag);
}

export function getCanonicalBlogTag(value: string): BlogTag | undefined {
	return (BLOG_TAG_ALIASES as Readonly<Record<string, BlogTag>>)[value];
}

export function validateBlogPostTags(
	slug: string,
	tags: readonly string[]
): asserts tags is BlogTag[] {
	const invalidTags = tags.filter((tag) => !isBlogTag(tag));
	if (invalidTags.length > 0) {
		throw new Error(`Blog post ${slug} uses non-canonical tags: ${invalidTags.join(', ')}`);
	}
}

export interface BlogPostModule {
	metadata: BlogPost;
	default: typeof import('svelte').SvelteComponent;
}

export const PILLARS = {
	'ai-first-product': {
		label: 'AI-First Product',
		description: 'GenUI, canvas architecture, and building conversation-driven software'
	},
	'coffee-data-pipeline': {
		label: 'Coffee Data Pipeline',
		description: 'Scraping, normalizing, and enriching green coffee data'
	},
	'market-intelligence': {
		label: 'Market Intelligence',
		description: 'Green coffee market analysis, pricing trends, and sourcing insights'
	},
	'api-architecture': {
		label: 'API Architecture',
		description: 'API-first design, agent-ready interfaces, and the B2CC thesis'
	},
	'agentic-stack': {
		label: 'Agentic Stack',
		description: 'OpenClaw, second brain, and AI-assisted development'
	},
	'supply-chain': {
		label: 'Supply Chain',
		description: 'Coffee industry, supply chain technology, and market structure'
	}
} as const;

export type PillarKey = keyof typeof PILLARS;
