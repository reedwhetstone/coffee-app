import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';

describe('api docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents API-plan public capability parity without changing the website boundary', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain(
			'Website Viewer sessions and the public demo stay on the basic query surface.'
		);
		expect(serializedPage).toContain(
			'Customer API keys across Green, Origin, and Enterprise may use the full public-data query surface'
		);
		expect(serializedPage).toContain(
			'canonical listing path uses the 100-row default listing contract.'
		);
		expect(serializedPage).toContain(
			'Publishable retail and wholesale catalog rows with the public field projection. The demo credential never reaches the browser.'
		);
		expect(serializedPage).toContain(
			'Its /api/catalog BFF injects a 1000-row default when page and limit are omitted for legacy unpaged consumers; the /catalog UI explicitly requests a 15-row page.'
		);
		expect(serializedPage).toContain(
			'Green evaluates the same public-data capabilities at lower request and collection volume.'
		);
		expect(serializedPage).toContain('200 requests per account per UTC calendar month');
		expect(serializedPage).toContain('up to 25 items per collection response');
		expect(serializedPage).toContain(
			'Aggregates such as facets and statistics are not item collections'
		);
	});

	it('documents account quota headers, UTC resets, and the 429 envelope', () => {
		const errors = getDocsPage('api', 'errors');
		const serializedErrors = JSON.stringify(errors);

		expect(serializedErrors).toContain(
			'Every customer-managed key on the account draws from that one allowance'
		);
		expect(serializedErrors).toContain(
			'X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset'
		);
		expect(serializedErrors).toContain('00:00 UTC on the first day of the next month');
		expect(serializedErrors).toContain('X-RateLimit-Blocked-By');
		expect(serializedErrors).toContain('rate_limit_exceeded');
		expect(serializedErrors).not.toContain('"error":"Rate limit exceeded"');
	});

	it('documents /v1/price-index without overclaiming unsupported premium surfaces', () => {
		const overview = getDocsPage('api', 'overview');
		const analytics = getDocsPage('api', 'analytics');
		const serializedDocs = `${JSON.stringify(overview)} ${JSON.stringify(analytics)}`;

		expect(serializedDocs).toContain('GET /v1/price-index');
		expect(serializedDocs).toContain('aggregate price_index_snapshots data');
		expect(serializedDocs).toContain('not raw supplier-level rows');
		expect(serializedDocs).toContain(
			'Public website catalog pages use a server-only PARCHMENT_PUBLIC_DEMO_API_KEY through the coffee-app BFF.'
		);
		expect(serializedDocs).toContain(
			'Anonymous Market Index teaser slices stay in session mode and call their deliberately anonymous upstream routes without the demo key.'
		);
		expect(serializedDocs).not.toContain(
			'Public website catalog and analytics pages use a server-only PARCHMENT_PUBLIC_DEMO_API_KEY'
		);
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

	it('states one consistent inventory session and share-token contract', () => {
		const inventory = getDocsPage('api', 'inventory');
		const serializedInventory = JSON.stringify(inventory);

		expect(serializedInventory).toContain(
			'Authenticated reads and writes require Parchment Intelligence or Mallard Studio access'
		);
		expect(serializedInventory).toContain(
			'Missing sessions return 401; authenticated accounts without either entitlement return 403.'
		);
		expect(serializedInventory).toContain(
			'If a supplied share token is invalid or expired, GET /api/beans returns an empty data array and does not fall back to the current session.'
		);
		expect(serializedInventory).not.toContain(
			'no session and no valid share token returns an empty data array'
		);
	});
});
