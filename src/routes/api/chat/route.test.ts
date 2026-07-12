import { describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn()
}));

vi.mock('$env/static/private', () => ({ OPENROUTER_API_KEY: 'test-key' }));
vi.mock('$lib/server/auth', () => ({
	AuthError: class AuthError extends Error {},
	requireChatAccess: vi.fn()
}));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: (...args: unknown[]) => mockCreateParchmentServerClient(...args)
}));
vi.mock('$lib/services/tools', () => ({ createChatTools: vi.fn() }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn() }));
vi.mock('ai', () => ({
	convertToModelMessages: vi.fn(),
	streamText: vi.fn(),
	stepCountIs: vi.fn()
}));

import {
	_buildAgentCatalogListQuery,
	_createMarketToolParchmentClient,
	_buildSystemPrompt,
	_fetchAgentCatalogRowsForSearch,
	_filterAgentCatalogRowsForUnsupportedFilters
} from './+server';

describe('chat system prompt entitlement context', () => {
	it('positions Parchment as evidence-led supply-chain intelligence with Mallard as context', () => {
		const prompt = _buildSystemPrompt({ type: 'general' }, 'Member User', {
			ppiAccess: true,
			memberAccess: true
		});

		expect(prompt).toContain('green coffee supply-chain intelligence assistant');
		expect(prompt).toContain('the Ethiopian in your evidence workspace');
		expect(prompt).not.toContain('the Ethiopian on your canvas');
		expect(prompt).toContain('source, compare, track, benchmark, and decide');
		expect(prompt).toMatch(/name material\s+uncertainty or missing coverage/);
		expect(prompt).toContain(
			"Mallard Studio is the user's optional roasting and operating context layer"
		);
		expect(prompt).not.toContain('expert coffee consultant');
	});

	it('only advertises Parchment tools for Parchment Intelligence-only users', () => {
		const prompt = _buildSystemPrompt({ type: 'roasting' }, 'PPI User', {
			ppiAccess: true,
			memberAccess: false
		});

		expect(prompt).toContain('You have access to Parchment Intelligence tools');
		expect(prompt).toContain('coffee_catalog_search');
		expect(prompt).toContain('green_coffee_inventory');
		expect(prompt).toContain('find_similar_beans');
		expect(prompt).toContain('catalog_facets');
		expect(prompt).toContain('supplier_list');
		expect(prompt).toContain('catalog_rank');
		expect(prompt).toContain('price_index_read');
		expect(prompt).toContain('market_signals');
		expect(prompt).toContain('market_stats');
		expect(prompt).toContain('market_metadata');
		expect(prompt).toContain(
			'use market_signals when available before falling back to catalog_rank'
		);
		expect(prompt).toContain('After calling coffee_catalog_search, catalog_rank, market_signals');
		expect(prompt).toContain('For market_signals, use the returned catalogId');
		expect(prompt).toContain('add_bean_to_inventory');
		expect(prompt).toContain('Mallard-only roast, tasting, and sales tools are unavailable');
		expect(prompt).not.toContain('You have access to these tools');
		expect(prompt).not.toContain('roast_profiles');
		expect(prompt).not.toContain('record_sale');
		expect(prompt).not.toContain('WORKSPACE FOCUS: Roasting');
	});

	it('keeps Mallard-only tool and workspace guidance for members', () => {
		const prompt = _buildSystemPrompt({ type: 'roasting' }, 'Member User', {
			ppiAccess: false,
			memberAccess: true
		});

		expect(prompt).toContain('You have access to these tools');
		expect(prompt).toContain('roast_profiles');
		expect(prompt).toContain('record_sale');
		expect(prompt).toContain('catalog_rank');
		expect(prompt).toContain('price_index_read');
		expect(prompt).toContain('market_signals');
		expect(prompt).toContain('market_stats');
		expect(prompt).toContain('market_metadata');
		expect(prompt).toContain('WORKSPACE FOCUS: Roasting');
	});
});

describe('chat market tool Parchment client', () => {
	it('preserves strict upstream handling for gated market tools', async () => {
		const client = { market: {}, priceIndex: {} };
		mockCreateParchmentServerClient.mockResolvedValueOnce(client);
		const event = { request: new Request('https://purveyors.io/api/chat') };

		await expect(_createMarketToolParchmentClient(event as never)).resolves.toBe(client);
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, {
			preferHandling: 'inherit'
		});
	});
});

describe('chat catalog Parchment query mapping', () => {
	it('uses canonical catalog query parameter names for agent catalog search', () => {
		const query = _buildAgentCatalogListQuery({
			origin: 'Ethiopia',
			process: 'natural',
			variety: 'Gesha',
			price_range: [5, 9],
			flavor_keywords: ['berry', 'jasmine'],
			limit: 12,
			stocked_only: false,
			name: 'Hambela',
			stocked_days: 30,
			drying_method: 'raised bed',
			supplier: 'Osito',
			coffee_ids: [42, 0]
		});

		expect(query).toMatchObject({
			origin: 'Ethiopia',
			processing: 'natural',
			cultivar_detail: 'Gesha',
			price_per_lb_min: 5,
			price_per_lb_max: 9,
			limit: 12,
			stocked: 'all',
			name: 'Hambela',
			stocked_days: 30,
			source: 'Osito',
			ids: [42]
		});
		expect(query).not.toHaveProperty('supplier');
		expect(query).not.toHaveProperty('stockedDays');
		expect(query).not.toHaveProperty('dryingMethod');
		expect(query).not.toHaveProperty('flavorKeywords');
		expect(query).not.toHaveProperty('coffeeIds');
		expect(query).not.toHaveProperty('pricePerLbMin');
		expect(query).not.toHaveProperty('pricePerLbMax');
		expect(query).not.toHaveProperty('drying_method');
		expect(query).not.toHaveProperty('flavor_keywords');
	});

	it('sizes ID re-fetches to the requested ID count when no limit is supplied', () => {
		const query = _buildAgentCatalogListQuery({
			coffee_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
		});

		expect(query).toMatchObject({
			ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
			limit: 12
		});
	});

	it('caps ID re-fetches at the catalog tool maximum', () => {
		const query = _buildAgentCatalogListQuery({
			coffee_ids: Array.from({ length: 20 }, (_, index) => index + 1)
		});

		expect(query.limit).toBe(15);
	});

	it('post-filters catalog rows for fields unsupported by the Parchment list API', () => {
		const rows = [
			{
				id: 1,
				name: 'Raised Bed Berry',
				processing: 'Natural',
				drying_method: 'Raised beds',
				description_short: 'Berry and jasmine cup'
			},
			{
				id: 2,
				name: 'Patio Berry',
				processing: 'Natural',
				drying_method: 'Patio',
				description_short: 'Berry cup'
			},
			{
				id: 3,
				name: 'Raised Bed Citrus',
				processing: 'Washed on raised beds',
				drying_method: null,
				description_short: 'Citrus cup'
			}
		];

		const filtered = _filterAgentCatalogRowsForUnsupportedFilters(rows, {
			drying_method: 'raised bed',
			flavor_keywords: ['berry']
		});

		expect(filtered.map((row) => row.id)).toEqual([1]);
	});

	it('paginates before post-filtering fields unsupported by the Parchment list API', async () => {
		const listCatalog = vi
			.fn()
			.mockResolvedValueOnce({
				data: {
					data: [
						{
							id: 1,
							processing: 'Natural',
							drying_method: 'Patio',
							description_short: 'Citrus cup'
						}
					],
					pagination: { page: 1, totalPages: 2, hasNext: true }
				}
			})
			.mockResolvedValueOnce({
				data: {
					data: [
						{
							id: 2,
							processing: 'Washed on raised beds',
							drying_method: null,
							description_short: 'Berry cup'
						}
					],
					pagination: { page: 2, totalPages: 2, hasNext: false }
				}
			});

		const rows = await _fetchAgentCatalogRowsForSearch(listCatalog, {
			drying_method: 'raised bed',
			flavor_keywords: ['berry'],
			limit: 1
		});

		expect(rows.map((row) => row.id)).toEqual([2]);
		expect(listCatalog).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ page: 1, limit: 1000 })
		);
		expect(listCatalog).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ page: 2, limit: 1000 })
		);
	});
});

describe('chat system prompt page context', () => {
	it('injects the current view summary and entity IDs', () => {
		const prompt = _buildSystemPrompt(
			undefined,
			'PPI User',
			{ ppiAccess: true, memberAccess: false },
			undefined,
			{
				surface: 'catalog',
				summary: 'Green coffee catalog filtered by country: Ethiopia — 12 coffees in view.',
				entities: [{ type: 'coffee', id: 42, label: 'Hambela Natural — Sweet Maria' }]
			}
		);

		expect(prompt).toContain("USER'S CURRENT VIEW (catalog page):");
		expect(prompt).toContain('filtered by country: Ethiopia');
		expect(prompt).toContain('coffee "Hambela Natural — Sweet Maria" (ID 42)');
		expect(prompt).toContain('descriptive context only');
	});

	it('omits the view block when no page context is provided', () => {
		const prompt = _buildSystemPrompt(undefined, 'PPI User', {
			ppiAccess: true,
			memberAccess: false
		});

		expect(prompt).not.toContain("USER'S CURRENT VIEW");
	});
});

describe('chat system prompt user memory', () => {
	it('injects the persistent memory document when present', () => {
		const prompt = _buildSystemPrompt(
			undefined,
			'PPI User',
			{ ppiAccess: true, memberAccess: false },
			undefined,
			undefined,
			'## Preferences\n- Prefers washed Ethiopians under $8/lb'
		);

		expect(prompt).toContain('PERSISTENT USER MEMORY');
		expect(prompt).toContain('Prefers washed Ethiopians under $8/lb');
	});

	it('omits the memory block when empty', () => {
		const prompt = _buildSystemPrompt(
			undefined,
			'PPI User',
			{ ppiAccess: true, memberAccess: false },
			undefined,
			undefined,
			'   '
		);

		expect(prompt).not.toContain('PERSISTENT USER MEMORY');
	});
});
