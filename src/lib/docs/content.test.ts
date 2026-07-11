import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';

describe('api docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents the basic public catalog query surface and paid process facet boundary', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain(
			'Anonymous, viewer-session, and API Green requests share the basic public catalog query surface.'
		);
		expect(serializedPage).toContain(
			'Structured process facet filters are gated to member/admin sessions and paid API tiers.'
		);
		expect(serializedPage).toContain(
			'Defaults to 100 rows when page and limit are omitted; page without limit falls back to 15.'
		);
		expect(serializedPage).toContain('Public-only catalog data. No X-RateLimit-* headers.');
		expect(serializedPage).toContain(
			'Canonical integration path for developers, sync jobs, and agents. API Green is for evaluation; API Origin and Enterprise unlock process search leverage.'
		);
	});

	it('documents /v1/price-index without overclaiming unsupported premium surfaces', () => {
		const overview = getDocsPage('api', 'overview');
		const analytics = getDocsPage('api', 'analytics');
		const serializedDocs = `${JSON.stringify(overview)} ${JSON.stringify(analytics)}`;

		expect(serializedDocs).toContain('GET /v1/price-index');
		expect(serializedDocs).toContain('aggregate price_index_snapshots data');
		expect(serializedDocs).toContain('not raw supplier-level rows');
		expect(serializedDocs).toContain(
			'Do not document CSV, alerts, watchlists, webhooks, or supplier-level raw rows as supported.'
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
			'Viewer sessions stay public-only. Member/admin sessions unlock process facets and may also unlock showWholesale and wholesaleOnly.'
		);
	});
});
