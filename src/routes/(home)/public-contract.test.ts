import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolvePublicPageSocialImage } from '$lib/seo/meta';

const mockSearchCatalog = vi.fn();

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: mockSearchCatalog
}));

let load: typeof import('./+page.server').load;

const catalogRows = [{ id: 1, name: 'Pink Bourbon' }];
const expectedPreviewQuery = {
	stockedOnly: true,
	orderBy: 'arrival_date',
	orderDirection: 'desc',
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

	mockSearchCatalog.mockResolvedValue({
		data: catalogRows,
		count: catalogRows.length,
		filtersApplied: {}
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
	it('keeps anonymous and viewer preview requests on the public visibility contract', async () => {
		const viewerSession = {
			user: {
				email: 'viewer@purveyors.test'
			}
		} as App.Locals['session'];

		await load(makeLoadInput(null));
		await load(makeLoadInput(viewerSession, 'viewer'));

		expect(mockSearchCatalog).toHaveBeenNthCalledWith(
			1,
			{ kind: 'public-client' },
			expect.objectContaining({
				...expectedPreviewQuery,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
		expect(mockSearchCatalog).toHaveBeenNthCalledWith(
			2,
			{ kind: 'public-client' },
			expect.objectContaining({
				...expectedPreviewQuery,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});

	it('only relaxes homepage preview visibility for privileged member sessions', async () => {
		const memberSession = {
			user: {
				email: 'member@purveyors.test'
			}
		} as App.Locals['session'];

		await load(makeLoadInput(memberSession, 'member'));

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'public-client' },
			expect.objectContaining({
				...expectedPreviewQuery,
				publicOnly: false,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});

	it('keeps market-first metadata and schema aligned even if preview loading fails', async () => {
		mockSearchCatalog.mockRejectedValueOnce(new Error('catalog offline'));
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
