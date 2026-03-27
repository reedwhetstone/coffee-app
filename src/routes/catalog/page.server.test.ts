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
		count: catalogRows.length,
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

function makeLoadInput(role: App.Locals['role'], session: App.Locals['session']) {
	return {
		locals: {
			supabase: { kind: 'session-client' },
			role,
			session
		},
		url: new URL('https://app.test/catalog')
	} as unknown as Parameters<typeof load>[0];
}

describe('/catalog page load', () => {
	it('keeps anonymous and viewer SSR previews on the public catalog visibility policy', async () => {
		const viewerSession = { access_token: 'cookie-token' } as App.Locals['session'];

		const result = (await load(makeLoadInput('viewer', viewerSession))) as {
			data: typeof catalogRows;
			trainingData: typeof catalogRows;
		};

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false,
				orderBy: 'arrival_date',
				orderDirection: 'desc',
				limit: 5
			})
		);
		expect(result.data).toEqual(catalogRows);
		expect(result.trainingData).toEqual(catalogRows);
	});

	it('lets member SSR previews use the internal catalog visibility policy', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];

		await load(makeLoadInput('member', memberSession));

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: false,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});
});
