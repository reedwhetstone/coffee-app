export interface BlogPost {
	slug: string;
	title: string;
	date: string;
	description: string;
	tags: string[];
	pillar: string;
	draft: boolean;
	author?: string;
	readingTime?: number;
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
