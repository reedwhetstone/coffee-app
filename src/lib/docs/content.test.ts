import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';

describe('catalog docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents the broad public query contract and API-key header distinction', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain(
			'same public query surface as viewer sessions and API-key callers'
		);
		expect(serializedPage).toContain('100 rows');
		expect(serializedPage).toContain('15-row pagination fallback');
		expect(serializedPage).toContain('No X-RateLimit-* headers');
	});

	it('keeps the canonical example on price_per_lb', () => {
		const example = page?.sections.find((section) => section.title === 'Request and response')
			?.codeBlocks?.[0]?.code;

		expect(example).toContain('"price_per_lb": 7.5');
		expect(example).not.toContain('"cost_lb": 7.5');
	});

	it('scopes wholesale controls to privileged member or admin sessions', () => {
		const querySection = page?.sections.find((section) => section.title === 'Query parameters');
		expect(querySection?.body?.join(' ')).toContain(
			'Privileged member and admin sessions may additionally use showWholesale and wholesaleOnly'
		);
	});
});
