import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolvePublicPageSocialImage } from '$lib/seo/meta';

const mockCatalogList = vi.fn();
const mockCreateParchmentServerClient = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let load: typeof import('./+page.server').load;

const catalogRows = [
	{
		id: 1,
		name: 'Pink Bourbon',
		source: 'Purveyor Coffee',
		continent: 'South America',
		country: 'Colombia',
		region: 'Huila',
		processing: 'Washed',
		cultivar_detail: 'Pink Bourbon',
		score_value: 88,
		price_per_lb: 7.25,
		price_tiers: [{ min_lbs: 1, price: 7.25 }],
		ai_description: 'A structured public preview lot.',
		ai_tasting_notes: null,
		arrival_date: '2026-03-18',
		stocked_date: '2026-03-20',
		stocked: true,
		public_coffee: true,
		wholesale: false
	}
];
const expectedPreviewQuery = {
	stocked: 'true',
	sort: 'arrival_date',
	order: 'desc',
	limit: 6
} as const;
const expectedHomepageMeta = {
	title: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
	description:
		'Browse normalized green coffee listings, recent arrivals, and the API-first coffee intelligence platform built for roasters, buyers, and developers.',
	ogDescription:
		'Explore recent arrivals, normalized sourcing data, and the API-first coffee platform built for roasters and developers.',
	twitterDescription:
		'Browse live green coffee data, compare recent arrivals, and explore the API-first coffee intelligence platform for roasters.',
	socialImage: {
		preferredPath: '/og/home.jpg',
		alt: 'Purveyors homepage social preview card'
	}
} as const;
const expectedHomepageSchema = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'Purveyors',
			description:
				'Coffee intelligence platform with a live green coffee catalog, normalized sourcing data, and an API-first workflow layer',
			url: 'https://purveyors.test',
			logo: {
				'@type': 'ImageObject',
				url: 'https://purveyors.test/purveyors_orange.svg'
			},
			contactPoint: {
				'@type': 'ContactPoint',
				email: 'support@purveyors.io',
				contactType: 'customer service'
			},
			sameAs: []
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'Purveyors',
			url: 'https://purveyors.test',
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: 'https://purveyors.test/catalog?name={search_term_string}'
				},
				'query-input': 'required name=search_term_string'
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Purveyors Coffee Platform',
			description:
				'Coffee intelligence platform with a live green coffee catalog, sourcing data, roast tracking, and operational workflows for roasters',
			url: 'https://purveyors.test',
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web Browser',
			offers: {
				'@type': 'Offer',
				price: '0.00',
				priceCurrency: 'USD',
				description: 'Free tier available with premium features'
			},
			creator: {
				'@type': 'Organization',
				name: 'Purveyors'
			}
		}
	]
} as const;

type HomepageSchemaNode = (typeof expectedHomepageSchema)['@graph'][number];

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockCatalogList.mockResolvedValue({
		data: catalogRows,
		pagination: {
			page: 1,
			limit: catalogRows.length,
			total: catalogRows.length,
			totalPages: 1,
			hasNext: false,
			hasPrev: false
		},
		meta: {}
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: {
			list: mockCatalogList
		}
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

describe('homepage public contract', () => {
	it('loads anonymous and signed-in previews through the public-demo Parchment catalog', async () => {
		const viewerSession = {
			user: {
				email: 'viewer@purveyors.test'
			}
		} as App.Locals['session'];
		const anonymousInput = makeLoadInput(null);
		const viewerInput = makeLoadInput(viewerSession, 'viewer');

		const anonymousResult = (await load(anonymousInput)) as { data: typeof catalogRows };
		const viewerResult = (await load(viewerInput)) as { data: typeof catalogRows };

		expect(mockCreateParchmentServerClient).toHaveBeenNthCalledWith(1, anonymousInput, {
			mode: 'public-demo'
		});
		expect(mockCreateParchmentServerClient).toHaveBeenNthCalledWith(2, viewerInput, {
			mode: 'public-demo'
		});
		expect(mockCatalogList).toHaveBeenNthCalledWith(1, expectedPreviewQuery);
		expect(mockCatalogList).toHaveBeenNthCalledWith(2, expectedPreviewQuery);
		expect(anonymousResult.data).toMatchObject(catalogRows);
		expect(viewerResult.data).toMatchObject(catalogRows);
		expect(anonymousResult.data[0]).toMatchObject({
			price_tiers: [{ min_lbs: 1, price: 7.25 }],
			wholesale: false,
			purveyor_score_factors: {}
		});
	});

	it('does not broaden homepage preview data for privileged member sessions', async () => {
		const memberInput = makeLoadInput(
			{
				user: {
					email: 'member@purveyors.test'
				}
			} as App.Locals['session'],
			'member'
		);

		await load(memberInput);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(memberInput, {
			mode: 'public-demo'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(expectedPreviewQuery);
	});

	it('keeps market-first metadata and schema aligned even if preview loading fails', async () => {
		mockCatalogList.mockRejectedValueOnce(new Error('catalog offline'));
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = (await load(makeLoadInput(null))) as {
			data: unknown[];
			trainingData: unknown[];
			meta: Record<string, unknown> & {
				schemaData?: typeof expectedHomepageSchema;
			};
		};

		const expectedSocialImage = resolvePublicPageSocialImage({
			baseUrl: 'https://purveyors.test',
			preferredPath: expectedHomepageMeta.socialImage.preferredPath,
			alt: expectedHomepageMeta.socialImage.alt
		});
		const homepageSchema = result.meta.schemaData as typeof expectedHomepageSchema;
		const websiteSchema = homepageSchema['@graph'].find(
			(node): node is Extract<HomepageSchemaNode, { '@type': 'WebSite' }> =>
				node['@type'] === 'WebSite'
		);
		const organizationSchema = homepageSchema['@graph'].find(
			(node): node is Extract<HomepageSchemaNode, { '@type': 'Organization' }> =>
				node['@type'] === 'Organization'
		);
		const appSchema = homepageSchema['@graph'].find(
			(node): node is Extract<HomepageSchemaNode, { '@type': 'SoftwareApplication' }> =>
				node['@type'] === 'SoftwareApplication'
		);

		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Error loading homepage coffee preview:',
			expect.any(Error)
		);
		expect(result.meta).toMatchObject({
			title: expectedHomepageMeta.title,
			description: expectedHomepageMeta.description,
			canonical: 'https://purveyors.test/',
			ogTitle: expectedHomepageMeta.title,
			ogDescription: expectedHomepageMeta.ogDescription,
			ogImage: expectedSocialImage.url,
			ogImageAlt: expectedHomepageMeta.socialImage.alt,
			twitterTitle: expectedHomepageMeta.title,
			twitterDescription: expectedHomepageMeta.twitterDescription,
			twitterImage: expectedSocialImage.url,
			twitterImageAlt: expectedHomepageMeta.socialImage.alt
		});
		expect(homepageSchema).toEqual(expectedHomepageSchema);
		expect(websiteSchema?.potentialAction?.target?.urlTemplate).toBe(
			'https://purveyors.test/catalog?name={search_term_string}'
		);
		expect(organizationSchema?.description).toBe(
			'Coffee intelligence platform with a live green coffee catalog, normalized sourcing data, and an API-first workflow layer'
		);
		expect(appSchema?.description).toBe(
			'Coffee intelligence platform with a live green coffee catalog, sourcing data, roast tracking, and operational workflows for roasters'
		);

		consoleErrorSpy.mockRestore();
	});
});
