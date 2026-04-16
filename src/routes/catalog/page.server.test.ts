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

vi.mock('$lib/seo/meta', () => ({
	buildPublicMeta: mockBuildPublicMeta,
	resolvePublicPageSocialImage: mockResolvePublicPageSocialImage
}));

vi.mock('$lib/services/schemaService', () => ({
	createSchemaService: mockCreateSchemaService
}));

let load: typeof import('./+page.server').load;

const catalogRows = [{ id: 1, name: 'Alpha' }];

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
			data: typeof catalogRows;
			trainingData: typeof catalogRows;
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
				limit: 15,
				offset: 0,
				orderBy: undefined,
				orderDirection: undefined
			})
		);
		expect(result.data).toEqual(catalogRows);
		expect(result.trainingData).toEqual(catalogRows);
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
				wholesaleOnly: false
			})
		);
	});
});
