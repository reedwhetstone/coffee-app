import { describe, expect, it, vi } from 'vitest';
import type { SourcingBriefResource } from '$lib/server/parchmentProcurement';
import type { TrackedLotSummary } from '$lib/server/trackedLots';

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
	_buildTrackedLotContext,
	_createMarketToolParchmentClient,
	_buildSystemPrompt,
	_fetchAgentCatalogRowsForSearch,
	_filterAgentCatalogRowsForUnsupportedFilters,
	_loadSourcingIntelligenceSeeds
} from './+server';

function trackedLotSummary(overrides: Partial<TrackedLotSummary> = {}): TrackedLotSummary {
	return {
		catalogId: 7,
		trackedAt: '2026-08-01T12:00:00Z',
		priceAtTracking: 6.5,
		name: 'Contract label',
		source: 'Contract source',
		country: 'Contract country',
		region: 'Guji',
		processing: 'Natural',
		stocked: false,
		wholesale: false,
		unstockedDate: '2026-08-20',
		currentPrice: 7.25,
		priceDelta: 0.75,
		...overrides
	};
}

describe('chat system prompt entitlement context', () => {
	it('identifies Cherry AI as a system and selects the synthesis role for combined access', () => {
		const prompt = _buildSystemPrompt({ type: 'general' }, 'Member User', {
			ppiAccess: true,
			memberAccess: true
		});

		expect(prompt).toContain("Cherry AI is Purveyors' coffee-native AI system");
		expect(prompt).toContain('Cherry AI is a system, not a persona');
		expect(prompt).toContain('Cherry Synthesis Agent');
		expect(prompt).toContain('agent name describes an execution role, not a character');
		expect(prompt).toContain('Do not say "I am Cherry"');
		expect(prompt).toMatch(
			/Parchment Intelligence supplies catalog, market, and sourcing\s+evidence/
		);
		expect(prompt).toContain('The Parchment API supplies the underlying data contracts');
		expect(prompt).toMatch(
			/Mallard Studio supplies the user's inventory, roast, tasting, sales, and margin context/
		);
		expect(prompt).toContain('the Ethiopian in your evidence workspace');
		expect(prompt).not.toMatch(
			/action card on the canvas|clear canvas|existing canvas|updates the canvas|render on the canvas|the canvas currently shows|older canvas results/i
		);
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

		expect(prompt).toContain('Cherry Green Agent');
		expect(prompt).not.toContain('Cherry Roast Agent');
		expect(prompt).not.toContain('Cherry Synthesis Agent');
		expect(prompt).toContain('You have access to Parchment Intelligence tools');
		expect(prompt).toContain('coffee_catalog_search');
		expect(prompt).toContain('green_coffee_inventory');
		expect(prompt).toContain('advanced bean matching is unavailable in the current access tier');
		expect(prompt).not.toContain('3. find_similar_beans');
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
		expect(prompt).toContain('Mallard Studio-only roast, tasting, and sales tools are unavailable');
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

		expect(prompt).toContain('Cherry Roast Agent');
		expect(prompt).not.toContain('Cherry Green Agent');
		expect(prompt).not.toContain('Cherry Synthesis Agent');
		expect(prompt).toContain('You have access to these tools');
		expect(prompt).toContain('roast_profiles');
		expect(prompt).toContain('record_sale');
		expect(prompt).toContain('catalog_rank');
		expect(prompt).not.toContain('price_index_read');
		expect(prompt).not.toContain('market_signals');
		expect(prompt).not.toContain('market_stats');
		expect(prompt).not.toContain('market_metadata');
		expect(prompt).toContain('WORKSPACE FOCUS: Roasting');
	});

	it('attributes Mallard-only catalog evidence to the Parchment API', () => {
		const prompt = _buildSystemPrompt({ type: 'general' }, 'Member User', {
			ppiAccess: false,
			memberAccess: true
		});

		expect(prompt).toContain('The Parchment API supplies catalog data');
		expect(prompt).toContain('The Parchment API supplies the underlying data contracts');
		expect(prompt).not.toContain(
			'Parchment Intelligence supplies catalog, market, and sourcing evidence'
		);
	});

	it('adds PPI market guidance for users with both products', () => {
		const prompt = _buildSystemPrompt({ type: 'roasting' }, 'Bundle User', {
			ppiAccess: true,
			memberAccess: true
		});

		expect(prompt).toContain('roast_profiles');
		expect(prompt).toContain('PARCHMENT INTELLIGENCE MARKET TOOLS');
		expect(prompt).toContain('price_index_read');
		expect(prompt).toContain('market_signals');
		expect(prompt).toContain('market_stats');
		expect(prompt).toContain('market_metadata');
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

describe('chat sourcing intelligence enrichment', () => {
	it('preserves tracked lots when the sourcing-brief API fails', async () => {
		const summary = trackedLotSummary();
		const result = await _loadSourcingIntelligenceSeeds(
			() => Promise.resolve([summary]),
			() => Promise.reject(new Error('briefs unavailable'))
		);

		expect(result).toEqual({ trackedSummaries: [summary], briefRows: [] });
	});

	it('preserves sourcing briefs when tracked-lot loading fails', async () => {
		const brief = {
			id: 'brief-1',
			name: 'Ethiopia naturals',
			criteria: { version: 1 as const, country: 'Ethiopia' },
			cadence: 'manual' as const,
			isActive: true,
			lastRunAt: null,
			createdAt: '2026-07-01T00:00:00Z',
			updatedAt: '2026-07-01T00:00:00Z'
		} as unknown as SourcingBriefResource;
		const result = await _loadSourcingIntelligenceSeeds(
			() => Promise.reject(new Error('tracked lots unavailable')),
			() => Promise.resolve([brief])
		);

		expect(result).toEqual({ trackedSummaries: [], briefRows: [brief] });
	});

	it('uses the canonical tracked-lot summary without a second catalog lookup', () => {
		const summary = trackedLotSummary();
		const trackedLots = _buildTrackedLotContext([summary]);

		expect(trackedLots).toEqual([
			{
				id: 7,
				name: 'Contract label',
				country: 'Contract country',
				source: 'Contract source',
				trackedAt: '2026-08-01T12:00:00Z',
				priceAtTracking: 6.5,
				currentPrice: 7.25,
				priceDelta: 0.75,
				stocked: false,
				unstockedDate: '2026-08-20'
			}
		]);
	});

	it('falls back to the tracked catalog ID when the canonical summary has no label', () => {
		expect(_buildTrackedLotContext([trackedLotSummary({ name: '' })])[0]).toEqual({
			id: 7,
			name: 'Lot #7',
			country: 'Contract country',
			source: 'Contract source',
			trackedAt: '2026-08-01T12:00:00Z',
			priceAtTracking: 6.5,
			currentPrice: 7.25,
			priceDelta: 0.75,
			stocked: false,
			unstockedDate: '2026-08-20'
		});
	});

	it('injects canonical tracked change fields and prioritization guidance into the prompt', () => {
		const prompt = _buildSystemPrompt(
			undefined,
			'PPI User',
			{ ppiAccess: true, memberAccess: false },
			{
				trackedLots: [
					{
						id: 7,
						name: 'Hydrated lot',
						country: 'Ethiopia',
						source: 'Supplier',
						trackedAt: '2026-08-01T12:00:00Z',
						priceAtTracking: 6.5,
						currentPrice: 7.25,
						priceDelta: 0.75,
						stocked: false,
						unstockedDate: '2026-08-20'
					}
				],
				activeBriefs: []
			}
		);

		expect(prompt).toContain('trackedAt=2026-08-01T12:00:00Z');
		expect(prompt).toContain('priceAtTracking=6.5');
		expect(prompt).toContain('currentPrice=7.25');
		expect(prompt).toContain('priceDelta=0.75');
		expect(prompt).toContain('stocked=false');
		expect(prompt).toContain('unstockedDate=2026-08-20');
		expect(prompt).toContain('For price or availability change questions, use these fields first');
		expect(prompt).toContain('Do not infer historical changes from catalog searches');
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
			coffee_ids: [42]
		});

		expect(query).toMatchObject({
			origin: 'Ethiopia',
			processing: 'natural',
			variety: 'Gesha',
			pricePerLbMin: 5,
			pricePerLbMax: 9,
			limit: 12,
			stocked: 'all',
			name: 'Hambela',
			stockedDays: 30,
			supplier: 'Osito',
			coffeeIds: '42'
		});
		expect(query).not.toHaveProperty('source');
		expect(query).not.toHaveProperty('ids');
		expect(query).not.toHaveProperty('cultivar_detail');
		expect(query).not.toHaveProperty('stocked_days');
		expect(query).not.toHaveProperty('price_per_lb_min');
		expect(query).not.toHaveProperty('price_per_lb_max');
		expect(query).not.toHaveProperty('dryingMethod');
		expect(query).not.toHaveProperty('flavorKeywords');
		expect(query).not.toHaveProperty('drying_method');
		expect(query).not.toHaveProperty('flavor_keywords');
	});

	it('uses an exact comma-delimited five-ID query with unstocked visibility', async () => {
		const requestedIds = [101, 102, 103, 104, 105];
		const listCatalog = vi.fn().mockImplementation((query: { coffeeIds?: string }) => {
			if (query.coffeeIds !== requestedIds.join(',')) {
				return Promise.resolve({ data: { data: [{ id: 999 }] } });
			}
			return Promise.resolve({
				data: { data: [...requestedIds.map((id) => ({ id })), { id: 999 }] }
			});
		});

		const rows = await _fetchAgentCatalogRowsForSearch(listCatalog, {
			coffee_ids: requestedIds
		});

		expect(listCatalog).toHaveBeenCalledWith({
			coffeeIds: '101,102,103,104,105',
			stocked: 'all',
			limit: 5
		});
		expect(rows.map((row) => row.id)).toEqual(requestedIds);
	});

	it.each<[number[]]>([[[]], [[0, -1, 1.5]]])(
		'returns no rows without querying the catalog for an invalid explicit ID filter: %j',
		async (coffeeIds) => {
			const listCatalog = vi.fn();

			await expect(
				_fetchAgentCatalogRowsForSearch(listCatalog, { coffee_ids: coffeeIds })
			).resolves.toEqual([]);
			expect(listCatalog).not.toHaveBeenCalled();
		}
	);

	it('sizes ID re-fetches to the requested ID count when no limit is supplied', () => {
		const query = _buildAgentCatalogListQuery({
			coffee_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
		});

		expect(query).toMatchObject({
			coffeeIds: '1,2,3,4,5,6,7,8,9,10,11,12',
			stocked: 'all',
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
