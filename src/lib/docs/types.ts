// Shared docs data shapes. Kept separate so client components can import types
// without pulling docs content into the browser bundle.

export type DocsSectionKey = 'api' | 'catalog' | 'cli' | 'agents';

export interface DocsCodeBlock {
	label?: string;
	language?: string;
	code: string;
}

export interface DocsTable {
	headers: string[];
	rows: string[][];
}

export interface DocsCallout {
	tone: 'note' | 'warning' | 'success';
	title: string;
	body: string;
}

export interface DocsContentSection {
	title: string;
	body?: string[];
	bullets?: string[];
	codeBlocks?: DocsCodeBlock[];
	table?: DocsTable;
	callout?: DocsCallout;
}

export interface DocsLink {
	href: string;
	label: string;
	description: string;
}

export interface DocsPage {
	section: DocsSectionKey;
	slug: string;
	title: string;
	summary: string;
	eyebrow: string;
	intro: string[];
	sections: DocsContentSection[];
	related: DocsLink[];
	/** Show the copyable agent setup prompt below the page header. */
	agentSetupPrompt?: boolean;
}

export interface DocsNavItem {
	slug: string;
	title: string;
	summary: string;
}

export interface DocsNavSection {
	key: DocsSectionKey;
	title: string;
	description: string;
	basePath: string;
	items: DocsNavItem[];
}
