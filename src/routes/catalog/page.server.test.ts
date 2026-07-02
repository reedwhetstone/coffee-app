import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockCatalogList = vi.fn();
const mockCatalogOriginPriceStats = vi.fn();
const mockBuildPublicMeta = vi.fn();
const mockResolvePublicPageSocialImage = vi.fn();
const mockGenerateOrganizationSchema = vi.fn();
const mockGenerateCoffeeCollectionSchema = vi.fn();
const mockGenerateSchemaGraph = vi.fn();
const mockCreateSchemaService = vi.fn();
const mockGetTrackedLotIds = vi.fn();
const mockGetBriefMatchSummaries = vi.fn();

class MockCatalogSchemaUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CatalogSchemaUnavailableError';
	}
}

vi.mock('$lib/server/parchmentClient', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/parchmentClient')>()),
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/catalog/catalogResourceItem', () => ({
	toCatalogResourceItem: (item: Record<string, unknown>) => ({
		...item,
		process: {
			base_method: item.processing_base_method ?? null,
			fermentation_type: item.fermentation_type ?? null,
			additives: item.process_additives ?? null,
			additive_detail: item.process_additive_detail ?? null,
			fermentation_duration_hours: item.fermentation_duration_hours ?? null,
			drying_method: item.drying_method ?? null,
			notes: item.processing_notes ?? null,
			disclosure_level: item.processing_disclosure_level ?? null,
			confidence: item.processing_confidence ?? null,
			evidence_available: Boolean(item.processing_evidence_available)
		}
	})
}));

vi.mock('$lib/seo/meta', () => ({
	buildPublicMeta: mockBuildPublicMeta,
	resolvePublicPageSocialImage: mockResolvePublicPageSocialImage
}));

vi.mock('$lib/services/schemaService', () => ({
	createSchemaService: mockCreateSchemaService
}));

vi.mock('$lib/server/trackedLots', () => ({
	getTrackedLotIds: mockGetTrackedLotIds
}));

vi.mock('$lib/server/briefMatchSummary', () => ({
	getBriefMatchSummaries: mockGetBriefMatchSummaries
}));

let load: typeof import('./+page.server').load;

const catalogRows = [
	{
		id: 1,
		name: 'Alpha',
		processing_base_method: 'washed',
		fermentation_type: 'anaerobic',
		process_additives: ['none'],
		process_additive_detail: null,
		fermentation_duration_hours: 48,
		drying_method: 'raised_bed',
		processing_notes: 'Slow fermentation',
		processing_disclosure_level: 'high_detail',
		processing_confidence: 0.85,
		processing_evidence_available: true
	}
];

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockCatalogList.mockResolvedValue({
		data: {
			data: catalogRows,
			pagination: {
				page: 1,
				limit: 15,
				total: 42,
				totalPages: 3,
				hasNext: true,
				hasPrev: false
			}
		}
	});
	mockCatalogOriginPriceStats.mockResolvedValue({
		data: { originPriceStats: [] },
		error: null
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: {
			list: mockCatalogList,
			originPriceStats: mockCatalogOriginPriceStats
		}
	});
	mockBuildPublicMeta.mockImplementation((value) => value);
	mockResolvePublicPageSocialImage.mockReturnValue('/og/catalog.jpg');
	mockGenerateOrganizationSchema.mockReturnValue({ '@type': 'Organization' });
	mockGenerateCoffeeCollectionSchema.mockReturnValue({ '@type': 'ItemList' });
	mockGenerateSchemaGraph.mockReturnValue({ '@graph': [] });
	mockCreateSchemaService.mockReturnValue({
		generateOrganizationSchema: mockGenerateOrganizationSchema,
		generateCoffeeCollectionSchema: mockGenerateCoffeeCollectionSchema,
		generateSchemaGraph: mockGenerateSchemaGraph
	});
	mockGetTrackedLotIds.mockResolvedValue([]);
	mockGetBriefMatchSummaries.mockResolvedValue([]);

	({ load } = await import('./+page.server'));
});

function makeMockSupabase(pricingRows: Array<Record<string, unknown>> = []) {
	const queryChain = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue({ data: pricingRows, error: null })
	};
	return {
		kind: 'session-client',
		from: vi.fn().mockReturnValue(queryChain),
		queryChain
	};
}

function makeLoadInput(
	role: App.Locals['role'],
	session: App.Locals['session'],
	url = 'https://app.test/catalog',
	pricingRows: Array<Record<string, unknown>> = []
) {
	return {
		locals: {
			supabase: makeMockSupabase(pricingRows),
			role,
			session
		},
		url: new URL(url),
		request: new Request(url),
		fetch: vi.fn()
	} as unknown as Parameters<typeof load>[0];
}

function makeLoadInputWithPrincipal(
	role: App.Locals['role'],
	session: App.Locals['session'],
	principal: { isAuthenticated: true; userId: string; ppiAccess: boolean },
	url = 'https://app.test/catalog'
) {
	return {
		locals: {
			supabase: makeMockSupabase(),
			role,
			session,
			principal
		},
		url: new URL(url),
		request: new Request(url),
		fetch: vi.fn()
	} as unknown as Parameters<typeof load>[0];
}

describe('/catalog page load', () => {
	it('uses public-demo for anonymous catalog reads and session mode for viewer sessions', async () => {
		const viewerSession = { access_token: 'cookie-token' } as App.Locals['session'];

		const result = (await load(makeLoadInput('viewer', null))) as {
			data: Array<Record<string, unknown>>;
			trainingData: Array<Record<string, unknown>>;
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
				hasNext: boolean;
				hasPrev: boolean;
			};
			initialCatalogState: {
				showWholesale: boolean;
				sortField: string | null;
				sortDirection: 'asc' | 'desc' | null;
			};
		};
		await load(makeLoadInput('viewer', viewerSession));

		expect(mockCreateParchmentServerClient).toHaveBeenNthCalledWith(1, expect.anything(), {
			mode: 'public-demo'
		});
		expect(mockCreateParchmentServerClient).toHaveBeenNthCalledWith(2, expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				stocked: 'true',
				showWholesale: 'false',
				wholesaleOnly: 'false',
				page: 1,
				limit: 15
			})
		);
		expect(result.data[0]).toMatchObject({
			id: 1,
			name: 'Alpha',
			process: {
				base_method: 'washed',
				fermentation_type: 'anaerobic',
				additives: ['none'],
				disclosure_level: 'high_detail',
				confidence: 0.85,
				evidence_available: true
			}
		});
		expect(result.trainingData).toEqual(result.data);
		expect(result.initialCatalogState).toMatchObject({
			showWholesale: false,
			sortField: null,
			sortDirection: null
		});
		expect(result.pagination).toEqual({
			page: 1,
			limit: 15,
			total: 42,
			totalPages: 3,
			hasNext: true,
			hasPrev: false
		});
	});

	it('hydrates filtered catalog URLs from query params on first load', async () => {
		await load(
			makeLoadInput(
				'viewer',
				null,
				'https://app.test/catalog?country=Ethiopia&processing=Washed&cultivar_detail=Gesha&name=guji&score_value_min=86&score_value_max=90&price_per_lb_min=7.25&price_per_lb_max=8.5&arrival_date=2026-03-01&stocked_date=2026-04-01&page=2&sortField=score_value&sortDirection=asc'
			)
		);

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({
				country: 'Ethiopia',
				processing: 'Washed',
				cultivar_detail: 'Gesha',
				name: 'guji',
				score_value_min: 86,
				score_value_max: 90,
				price_per_lb_min: 7.25,
				price_per_lb_max: 8.5,
				arrival_date: '2026-03-01',
				stocked_date: '2026-04-01',
				page: 2,
				limit: 15,
				sortField: 'score_value',
				sortDirection: 'asc'
			})
		);
	});

	it('hydrates catalog coffee deep links even when the target is outside current filters or unstocked', async () => {
		mockCatalogList
			.mockResolvedValueOnce({
				data: {
					data: catalogRows,
					pagination: { total: 42 }
				}
			})
			.mockResolvedValueOnce({
				data: {
					data: [
						{
							id: 99,
							name: 'Deep Link Coffee',
							country: 'Colombia',
							public_coffee: true,
							wholesale: false,
							stocked: false
						}
					],
					pagination: { total: 1 }
				}
			});

		const result = (await load(
			makeLoadInput('viewer', null, 'https://app.test/catalog?coffee=99&country=Ethiopia&page=2')
		)) as { data: Array<{ id: number; name: string }>; pagination: { total: number } };

		expect(mockCatalogList).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				country: 'Ethiopia',
				stocked: 'true',
				showWholesale: 'false',
				wholesaleOnly: 'false',
				page: 2,
				limit: 15
			})
		);
		expect(mockCatalogList).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				ids: [99],
				stocked: 'all',
				showWholesale: 'false',
				wholesaleOnly: 'false',
				page: 1,
				limit: 1
			})
		);
		expect(mockCatalogList.mock.calls[1][0]).not.toMatchObject({ country: 'Ethiopia' });
		expect(result.data.map((coffee) => coffee.id)).toEqual([99, 1]);
		expect(result.pagination.total).toBe(42);
	});

	it('does not refetch a catalog coffee deep link that is already in the rendered result set', async () => {
		const result = (await load(
			makeLoadInput('viewer', null, 'https://app.test/catalog?coffee=1')
		)) as {
			data: Array<{ id: number }>;
		};

		expect(mockCatalogList).toHaveBeenCalledTimes(1);
		expect(result.data.map((coffee) => coffee.id)).toEqual([1]);
	});

	it('strips anonymous process transparency query params before catalog search', async () => {
		const result = (await load(
			makeLoadInput(
				'viewer',
				null,
				'https://app.test/catalog?processing_base_method=natural&fermentation_type=anaerobic&process_additive=fruit&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8'
			)
		)) as {
			initialCatalogState: { filters: Record<string, unknown> };
			catalogAccess: { canUseProcessFacets: boolean };
			catalogAccessNotice: { status: number; deniedParams: string[] } | null;
		};

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.not.objectContaining({
				processing_base_method: 'natural',
				fermentation_type: 'anaerobic',
				process_additive: 'fruit',
				has_additives: 'true',
				processing_disclosure_level: 'high_detail',
				processing_confidence_min: 0.8
			})
		);
		expect(result.initialCatalogState.filters).not.toHaveProperty('processing_base_method');
		expect(result.catalogAccess.canUseProcessFacets).toBe(false);
		expect(result.catalogAccessNotice).toMatchObject({
			status: 401,
			deniedParams: [
				'processing_base_method',
				'fermentation_type',
				'process_additive',
				'has_additives',
				'processing_disclosure_level',
				'processing_confidence_min'
			]
		});
	});

	it('does not show an entitlement notice for empty anonymous process transparency params', async () => {
		const result = (await load(
			makeLoadInput(
				'viewer',
				null,
				'https://app.test/catalog?processing_base_method=&fermentation_type=&process_additive=&has_additives=&processing_disclosure_level=&processing_confidence_min='
			)
		)) as {
			initialCatalogState: { filters: Record<string, unknown> };
			catalogAccessNotice: { status: number; deniedParams: string[] } | null;
		};

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.not.objectContaining({
				processing_base_method: expect.anything(),
				fermentation_type: expect.anything(),
				process_additive: expect.anything(),
				has_additives: expect.anything(),
				processing_disclosure_level: expect.anything(),
				processing_confidence_min: expect.anything()
			})
		);
		expect(result.initialCatalogState.filters).not.toHaveProperty('processing_base_method');
		expect(result.catalogAccessNotice).toBeNull();
	});

	it('strips viewer process transparency query params before catalog search', async () => {
		const viewerSession = { access_token: 'cookie-token' } as App.Locals['session'];

		const result = (await load(
			makeLoadInput(
				'viewer',
				viewerSession,
				'https://app.test/catalog?processing_base_method=natural'
			)
		)) as {
			initialCatalogState: { filters: Record<string, unknown> };
			catalogAccessNotice: { status: number; deniedParams: string[] } | null;
		};

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.not.objectContaining({ processing_base_method: 'natural' })
		);
		expect(result.initialCatalogState.filters).not.toHaveProperty('processing_base_method');
		expect(result.catalogAccessNotice).toMatchObject({
			status: 403,
			deniedParams: ['processing_base_method']
		});
	});

	it('lets member and admin SSR previews pass process transparency query params to catalog search', async () => {
		for (const role of ['member', 'admin'] as const) {
			vi.clearAllMocks();
			mockCatalogList.mockResolvedValue({
				data: {
					data: catalogRows,
					pagination: { total: 42 }
				}
			});
			mockCreateParchmentServerClient.mockResolvedValue({
				catalog: {
					list: mockCatalogList,
					originPriceStats: vi
						.fn()
						.mockResolvedValue({ data: { originPriceStats: [] }, error: null })
				}
			});
			const session = { access_token: 'cookie-token' } as App.Locals['session'];

			const result = (await load(
				makeLoadInput(
					role,
					session,
					'https://app.test/catalog?processing_base_method=natural&fermentation_type=anaerobic&process_additive=fruit&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8'
				)
			)) as { catalogAccess: { canUseProcessFacets: boolean }; catalogAccessNotice: null };

			expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
				mode: 'session'
			});
			expect(mockCatalogList).toHaveBeenCalledWith(
				expect.objectContaining({
					processing_base_method: 'natural',
					fermentation_type: 'anaerobic',
					process_additive: 'fruit',
					has_additives: 'true',
					processing_disclosure_level: 'high_detail',
					processing_confidence_min: 0.8
				})
			);
			expect(result.catalogAccess.canUseProcessFacets).toBe(true);
			expect(result.catalogAccessNotice).toBeNull();
		}
	});

	it('returns a controlled catalog schema unavailable response instead of throwing SSR 500', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		mockCatalogList.mockRejectedValue(
			new MockCatalogSchemaUnavailableError('Structured process filters are unavailable.')
		);

		const result = (await load(
			makeLoadInput(
				'member',
				memberSession,
				'https://app.test/catalog?processing_base_method=natural'
			)
		)) as {
			data: Array<Record<string, unknown>>;
			trainingData: Array<Record<string, unknown>>;
			catalogSchemaUnavailable: { message: string } | null;
			pagination: { total: number; totalPages: number };
		};

		expect(result.catalogSchemaUnavailable).toEqual({
			message: 'Structured process filters are unavailable.'
		});
		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(result.pagination).toMatchObject({ total: 0, totalPages: 0 });
	});

	it('routes the SDK 503 schema-unavailable error body into the controlled fallback', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		// openapi-fetch resolves non-2xx responses as `{ error: <body> }` rather than
		// rejecting, so the load must translate the parsed 503 body, not just catch throws.
		// Parchment's real 503 envelope is `{ error: { code, message } }` (see
		// parchment-api app.ts), not a flat `{ error: string }`.
		mockCatalogList.mockResolvedValue({
			error: {
				error: {
					code: 'schema_unavailable',
					message: 'Structured process filters are unavailable.'
				}
			}
		});

		const result = (await load(
			makeLoadInput(
				'member',
				memberSession,
				'https://app.test/catalog?processing_base_method=natural'
			)
		)) as {
			data: Array<Record<string, unknown>>;
			trainingData: Array<Record<string, unknown>>;
			catalogSchemaUnavailable: { message: string } | null;
			pagination: { total: number; totalPages: number };
		};

		expect(result.catalogSchemaUnavailable).toEqual({
			message: 'Structured process filters are unavailable.'
		});
		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(result.pagination).toMatchObject({ total: 0, totalPages: 0 });
	});

	it('routes the legacy flat schema-unavailable error body into the controlled fallback', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		// Backward-compatibility: earlier/flat `{ error: 'Catalog schema unavailable' }`
		// bodies must still resolve to the controlled fallback.
		mockCatalogList.mockResolvedValue({
			error: {
				error: 'Catalog schema unavailable',
				message: 'Structured process filters are unavailable.'
			}
		});

		const result = (await load(
			makeLoadInput(
				'member',
				memberSession,
				'https://app.test/catalog?processing_base_method=natural'
			)
		)) as {
			data: Array<Record<string, unknown>>;
			trainingData: Array<Record<string, unknown>>;
			catalogSchemaUnavailable: { message: string } | null;
			pagination: { total: number; totalPages: number };
		};

		expect(result.catalogSchemaUnavailable).toEqual({
			message: 'Structured process filters are unavailable.'
		});
		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(result.pagination).toMatchObject({ total: 0, totalPages: 0 });
	});

	it('keeps the catalog page renderable when Parchment configuration is unavailable', async () => {
		const error = new Error('PARCHMENT_API_BASE_URL is not configured.');
		error.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(error);

		const result = (await load(makeLoadInput('viewer', null))) as {
			data: Array<Record<string, unknown>>;
			trainingData: Array<Record<string, unknown>>;
			catalogSchemaUnavailable: { message: string } | null;
			pagination: { total: number; totalPages: number };
		};

		expect(result.catalogSchemaUnavailable).toEqual({
			message: 'PARCHMENT_API_BASE_URL is not configured.'
		});
		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(result.pagination).toMatchObject({ total: 0, totalPages: 0 });
	});

	it('lets member SSR previews use the internal catalog visibility policy', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];

		await load(
			makeLoadInput('member', memberSession, 'https://app.test/catalog?showWholesale=true')
		);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({
				stocked: 'true',
				showWholesale: 'true',
				wholesaleOnly: 'false'
			})
		);
	});

	it('sources member origin price stats from Parchment for the member-visible scope', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		mockCatalogOriginPriceStats.mockResolvedValue({
			data: {
				originPriceStats: [
					{
						origin: 'Colombia',
						median: 9,
						q1: 8,
						q3: 10,
						min: 8,
						max: 10,
						sample_size: 3,
						supplier_count: 3
					}
				]
			},
			error: null
		});

		const result = (await load(
			makeLoadInput('member', memberSession, 'https://app.test/catalog')
		)) as { originPriceStats: Array<{ origin: string; median: number; sample_size: number }> };

		// Member with no wholesale params → neither view flag is forwarded; Parchment
		// derives the scope (and publicOnly) from the forwarded credential.
		const statsQuery = mockCatalogOriginPriceStats.mock.calls[0][0];
		expect(statsQuery).not.toHaveProperty('showWholesale');
		expect(statsQuery).not.toHaveProperty('wholesaleOnly');
		expect(result.originPriceStats).toEqual([
			expect.objectContaining({ origin: 'Colombia', median: 9, sample_size: 3 })
		]);
	});

	it('forwards the wholesale view param to Parchment when wholesale rows are visible', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		mockCatalogOriginPriceStats.mockResolvedValue({
			data: {
				originPriceStats: [
					{
						origin: 'Honduras',
						median: 8,
						q1: 5,
						q3: 12,
						min: 4,
						max: 14,
						sample_size: 6,
						supplier_count: 6
					}
				]
			},
			error: null
		});

		const result = (await load(
			makeLoadInput('member', memberSession, 'https://app.test/catalog?showWholesale=true')
		)) as { originPriceStats: Array<{ origin: string; median: number; sample_size: number }> };

		expect(mockCatalogOriginPriceStats).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true' })
		);
		expect(mockCatalogOriginPriceStats.mock.calls[0][0]).not.toHaveProperty('wholesaleOnly');
		expect(result.originPriceStats).toEqual([
			expect.objectContaining({ origin: 'Honduras', median: 8, sample_size: 6 })
		]);
	});

	it('forwards wholesaleOnly to Parchment on member wholesale-only catalog loads', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];
		mockCatalogOriginPriceStats.mockResolvedValue({
			data: {
				originPriceStats: [
					{
						origin: 'Honduras',
						median: 5,
						q1: 4,
						q3: 6,
						min: 4,
						max: 6,
						sample_size: 3,
						supplier_count: 3
					}
				]
			},
			error: null
		});

		const result = (await load(
			makeLoadInput(
				'member',
				memberSession,
				'https://app.test/catalog?showWholesale=true&wholesaleOnly=true'
			)
		)) as { originPriceStats: Array<{ origin: string; median: number; sample_size: number }> };

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true', wholesaleOnly: 'true' })
		);
		expect(mockCatalogOriginPriceStats).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true', wholesaleOnly: 'true' })
		);
		expect(result.originPriceStats).toEqual([
			expect.objectContaining({ origin: 'Honduras', median: 5, sample_size: 3 })
		]);
	});
});

describe('/catalog tracked lots and brief matches', () => {
	it('returns empty trackedLotIds and briefMatchSummaries for unauthenticated load', async () => {
		const result = (await load(makeLoadInput('viewer', null))) as {
			trackedLotIds: number[];
			briefMatchSummaries: unknown[];
		};

		expect(result.trackedLotIds).toEqual([]);
		expect(result.briefMatchSummaries).toEqual([]);
		expect(mockGetTrackedLotIds).not.toHaveBeenCalled();
		expect(mockGetBriefMatchSummaries).not.toHaveBeenCalled();
	});

	it('fetches tracked lot IDs for a ppiAccess user', async () => {
		const session = { access_token: 'ppi-token' } as App.Locals['session'];
		const principal = { isAuthenticated: true as const, userId: 'ppi-user-1', ppiAccess: true };
		mockGetTrackedLotIds.mockResolvedValue([10, 42]);

		const result = (await load(makeLoadInputWithPrincipal('viewer', session, principal))) as {
			trackedLotIds: number[];
			briefMatchSummaries: unknown[];
		};

		expect(mockGetTrackedLotIds).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'session-client' }),
			'ppi-user-1'
		);
		expect(result.trackedLotIds).toEqual([10, 42]);
		// ppiAccess non-member: briefs not fetched
		expect(mockGetBriefMatchSummaries).not.toHaveBeenCalled();
		expect(result.briefMatchSummaries).toEqual([]);
	});

	it('fetches tracked lot IDs and brief match summaries for a member', async () => {
		const session = { access_token: 'member-token' } as App.Locals['session'];
		const principal = {
			isAuthenticated: true as const,
			userId: 'member-user-1',
			ppiAccess: false
		};
		mockGetTrackedLotIds.mockResolvedValue([7]);
		mockGetBriefMatchSummaries.mockResolvedValue([
			{ briefId: 'b1', briefName: 'Ethiopia brief', matchCount: 1, matchingIds: [1] }
		]);

		const result = (await load(makeLoadInputWithPrincipal('member', session, principal))) as {
			trackedLotIds: number[];
			briefMatchSummaries: Array<{ briefId: string; briefName: string }>;
		};

		expect(mockGetTrackedLotIds).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'session-client' }),
			'member-user-1'
		);
		expect(mockGetBriefMatchSummaries).toHaveBeenCalled();
		expect(result.trackedLotIds).toEqual([7]);
		expect(result.briefMatchSummaries).toHaveLength(1);
		expect(result.briefMatchSummaries[0].briefName).toBe('Ethiopia brief');
	});
});

describe('/catalog tracked-only watchlist view', () => {
	it('restricts results to tracked lots including delisted ones for entitled users', async () => {
		const session = { access_token: 'ppi-token' } as App.Locals['session'];
		const principal = { isAuthenticated: true as const, userId: 'ppi-user-1', ppiAccess: true };
		mockGetTrackedLotIds.mockResolvedValue([5, 9]);

		const result = (await load(
			makeLoadInputWithPrincipal(
				'viewer',
				session,
				principal,
				'https://app.test/catalog?tracked=only'
			)
		)) as { trackedOnly: boolean; trackedLotIds: number[] };

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({
				ids: [5, 9],
				stocked: 'all',
				showWholesale: 'true'
			})
		);
		expect(result.trackedOnly).toBe(true);
		expect(result.trackedLotIds).toEqual([5, 9]);
	});

	it('skips the catalog query entirely when the watchlist is empty', async () => {
		const session = { access_token: 'ppi-token' } as App.Locals['session'];
		const principal = { isAuthenticated: true as const, userId: 'ppi-user-1', ppiAccess: true };
		mockGetTrackedLotIds.mockResolvedValue([]);

		const result = (await load(
			makeLoadInputWithPrincipal(
				'viewer',
				session,
				principal,
				'https://app.test/catalog?tracked=only'
			)
		)) as { trackedOnly: boolean; data: unknown[] };

		expect(mockCatalogList).not.toHaveBeenCalled();
		expect(result.trackedOnly).toBe(true);
		expect(result.data).toEqual([]);
	});

	it('ignores the tracked-only param for users without sourcing access', async () => {
		const session = { access_token: 'viewer-token' } as App.Locals['session'];
		const principal = {
			isAuthenticated: true as const,
			userId: 'viewer-1',
			ppiAccess: false
		};

		const result = (await load(
			makeLoadInputWithPrincipal(
				'viewer',
				session,
				principal,
				'https://app.test/catalog?tracked=only'
			)
		)) as { trackedOnly: boolean };

		expect(result.trackedOnly).toBe(false);
		expect(mockCatalogList).toHaveBeenCalledWith(expect.objectContaining({ stocked: 'true' }));
	});
});
