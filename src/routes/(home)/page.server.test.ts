import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchCatalog = vi.fn();
const mockBuildPublicMeta = vi.fn();
const mockResolvePublicPageSocialImage = vi.fn();
const mockGeneratePageSchema = vi.fn();
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

const catalogRows = [{ id: 1, name: 'Pink Bourbon' }];

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockSearchCatalog.mockResolvedValue({
		data: catalogRows,
		count: catalogRows.length,
		filtersApplied: {}
	});
	mockBuildPublicMeta.mockImplementation((value) => value);
	mockResolvePublicPageSocialImage.mockReturnValue('/og/home.jpg');
	mockGeneratePageSchema.mockReturnValue({ '@graph': [] });
	mockCreateSchemaService.mockReturnValue({
		generatePageSchema: mockGeneratePageSchema
	});

	({ load } = await import('./+page.server'));
});

function makeLoadInput(session: App.Locals['session'], role: App.Locals['role'] = 'viewer') {
	return {
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({ session, role }),
			session,
			role,
			supabase: { kind: 'public-client' }
		},
		url: new URL('https://purveyors.test/')
	} as unknown as Parameters<typeof load>[0];
}

describe('homepage marketing load', () => {
	it('loads recent stocked coffees and builds market-first metadata', async () => {
		const result = (await load(makeLoadInput(null))) as {
			data: typeof catalogRows;
			trainingData: typeof catalogRows;
			meta: Record<string, unknown>;
		};

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'public-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false,
				orderBy: 'arrival_date',
				orderDirection: 'desc',
				limit: 6
			})
		);
		expect(mockGeneratePageSchema).toHaveBeenCalledWith(
			'homepage-marketing',
			'https://purveyors.test'
		);
		expect(mockBuildPublicMeta).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
				description:
					'Browse normalized green coffee listings, recent arrivals, and the API-first coffee intelligence platform built for roasters, buyers, and developers.',
				ogTitle: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
				twitterTitle: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence'
			})
		);
		expect(result.data).toEqual(catalogRows);
		expect(result.trainingData).toEqual(catalogRows);
	});

	it('keeps metadata available even if the catalog preview query fails', async () => {
		mockSearchCatalog.mockRejectedValueOnce(new Error('catalog offline'));

		const result = (await load(makeLoadInput(null))) as {
			data: unknown[];
			trainingData: unknown[];
			meta: Record<string, unknown>;
		};

		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(result.meta).toMatchObject({
			title: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence'
		});
	});

	it('does not apply public-only restrictions for signed-in members', async () => {
		const memberSession = {
			user: {
				email: 'member@purveyors.test'
			}
		} as App.Locals['session'];

		await load(makeLoadInput(memberSession, 'member'));

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'public-client' },
			expect.objectContaining({
				publicOnly: false,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});
});
