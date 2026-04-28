import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchCatalog = vi.fn();
const mockBuildPublicMeta = vi.fn();
const mockResolvePublicPageSocialImage = vi.fn();
const mockGenerateOrganizationSchema = vi.fn();
const mockGenerateCoffeeCollectionSchema = vi.fn();
const mockGenerateSchemaGraph = vi.fn();
const mockCreateSchemaService = vi.fn();

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: mockSearchCatalog
}));

vi.mock('$lib/server/catalogResource', () => ({
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

	mockSearchCatalog.mockResolvedValue({
		data: catalogRows,
		count: 42,
		filtersApplied: {}
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

	({ load } = await import('./+page.server'));
});

function makeLoadInput(
	role: App.Locals['role'],
	session: App.Locals['session'],
	url = 'https://app.test/catalog'
) {
	return {
		locals: {
			supabase: { kind: 'session-client' },
			role,
			session
		},
		url: new URL(url)
	} as unknown as Parameters<typeof load>[0];
}

describe('/catalog page load', () => {
	it('keeps anonymous and viewer SSR previews on the public catalog visibility policy', async () => {
		const viewerSession = { access_token: 'cookie-token' } as App.Locals['session'];

		const result = (await load(makeLoadInput('viewer', viewerSession))) as {
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

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false,
				fields: 'resource',
				limit: 15,
				offset: 0,
				orderBy: undefined,
				orderDirection: undefined
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
				'https://app.test/catalog?country=Ethiopia&processing=Washed&name=guji&page=2&sortField=score_value&sortDirection=asc'
			)
		);

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				country: 'Ethiopia',
				processing: 'Washed',
				name: 'guji',
				limit: 15,
				offset: 15,
				orderBy: 'score_value',
				orderDirection: 'asc'
			})
		);
	});

	it('passes canonical process transparency query params to catalog search', async () => {
		await load(
			makeLoadInput(
				'viewer',
				null,
				'https://app.test/catalog?processing_base_method=natural&fermentation_type=anaerobic&process_additive=fruit&processing_disclosure_level=high_detail&processing_confidence_min=0.8'
			)
		);

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				processingBaseMethod: 'natural',
				fermentationType: 'anaerobic',
				processAdditive: 'fruit',
				processingDisclosureLevel: 'high_detail',
				processingConfidenceMin: 0.8,
				fields: 'resource'
			})
		);
	});

	it('lets member SSR previews use the internal catalog visibility policy', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];

		await load(
			makeLoadInput('member', memberSession, 'https://app.test/catalog?showWholesale=true')
		);

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: false,
				showWholesale: true,
				wholesaleOnly: false,
				fields: 'resource'
			})
		);
	});
});
