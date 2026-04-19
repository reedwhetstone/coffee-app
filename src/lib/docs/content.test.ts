import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';

describe('catalog docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents anonymous teaser limits and API-key header distinctions', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain('Anonymous access is intentionally teaser-only');
		expect(serializedPage).toContain('Public-only catalog data. No X-RateLimit-* headers.');
		expect(serializedPage).toContain(
			'Canonical integration path for developers, sync jobs, and agents.'
		);
	});

	it('keeps the example anchored on canonical price_per_lb naming', () => {
		const example = page?.sections.find((section) => section.title === 'Request and response')
			?.codeBlocks?.[0]?.code;

		expect(example).toContain('"price_per_lb": 7.5');
	});

	it('scopes wider catalog visibility to the documented session modes', () => {
		const querySection = page?.sections.find((section) => section.title === 'Query parameters');
		const accessSection = page?.sections.find(
			(section) => section.title === 'Access mode comparison'
		);

		expect(querySection?.body?.join(' ')).toContain(
			'Privileged member and admin sessions may additionally use showWholesale and wholesaleOnly'
		);
		expect(JSON.stringify(accessSection)).toContain(
			'Viewer sessions stay public-only and keep the same public query surface.'
		);
	});
});
