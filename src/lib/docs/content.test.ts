import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';

describe('api docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents the basic public catalog query surface and paid discovery boundary', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain(
			'Viewer-session, public/demo-key, and API Green requests share the basic public query surface.'
		);
		expect(serializedPage).toContain(
			'Importer, elevation, appearance, and structured process filters are gated to member/admin sessions and paid API tiers.'
		);
		expect(serializedPage).toContain(
			'canonical listing path uses the 100-row default listing contract.'
		);
		expect(serializedPage).toContain(
			'Publishable retail and wholesale catalog rows with the public field projection. The demo credential never reaches the browser.'
		);
		expect(serializedPage).toContain(
			'Canonical integration path for developers, sync jobs, and agents. API Green is for evaluation; API Origin and Enterprise unlock premium search leverage.'
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

	it('documents wholesale-inclusive discovery and the privileged wholesale-only scope', () => {
		const querySection = page?.sections.find((section) => section.title === 'Query parameters');
		const accessSection = page?.sections.find(
			(section) => section.title === 'Access mode comparison'
		);

		expect(querySection?.body?.join(' ')).toContain(
			'All callers include wholesale rows by default.'
		);
		expect(JSON.stringify(accessSection)).toContain(
			'All sessions include wholesale rows by default. Member/admin sessions unlock premium discovery filters, richer fields, and wholesaleOnly.'
		);
	});

	it('does not advertise the retired coffee-app roast classifier adapter', () => {
		const overview = getDocsPage('api', 'overview');
		const roastProfiles = getDocsPage('api', 'roast-profiles');
		const analytics = getDocsPage('api', 'analytics');
		const serializedDocs = `${JSON.stringify(overview)} ${JSON.stringify(roastProfiles)} ${JSON.stringify(analytics)}`;

		expect(serializedDocs).not.toContain('/api/ai/classify-roast');
	});
});
