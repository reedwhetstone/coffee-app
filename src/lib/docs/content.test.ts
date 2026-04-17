import { describe, expect, it } from 'vitest';

import {
	ANONYMOUS_ALLOWED_FILTER_PARAM_LIST,
	ANONYMOUS_API_PAGE_LIMIT,
	DEFAULT_API_PAGE_LIMIT
} from '$lib/catalog/publicCatalogContract';
import { getDocsPage } from '$lib/docs/content';

describe('catalog docs contract', () => {
	const page = getDocsPage('api', 'catalog');

	it('documents the anonymous teaser contract with shared constants', () => {
		expect(page).toBeDefined();

		const serializedPage = JSON.stringify(page);
		expect(serializedPage).toContain(`up to ${ANONYMOUS_API_PAGE_LIMIT} rows`);
		expect(serializedPage).toContain(ANONYMOUS_ALLOWED_FILTER_PARAM_LIST);
		expect(serializedPage).toContain(`${DEFAULT_API_PAGE_LIMIT}-row default listing contract`);
	});

	it('keeps the canonical example on price_per_lb', () => {
		const example = page?.sections.find((section) => section.title === 'Request and response')
			?.codeBlocks?.[0]?.code;

		expect(example).toContain('"price_per_lb": 7.5');
		expect(example).not.toContain('"cost_lb": 7.5');
	});

	it('explicitly scopes the broader query table away from anonymous callers', () => {
		const querySection = page?.sections.find((section) => section.title === 'Query parameters');
		expect(querySection?.body?.join(' ')).toContain(
			'Anonymous callers do not get the full table below.'
		);
	});
});
