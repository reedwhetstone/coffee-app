import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	HOMEPAGE_MARKETING_APPLICATION_DESCRIPTION,
	HOMEPAGE_MARKETING_DESCRIPTION,
	HOMEPAGE_MARKETING_OG_DESCRIPTION,
	HOMEPAGE_MARKETING_ORGANIZATION_DESCRIPTION,
	HOMEPAGE_MARKETING_PREVIEW_QUERY,
	HOMEPAGE_MARKETING_SOCIAL_IMAGE,
	HOMEPAGE_MARKETING_TITLE,
	HOMEPAGE_MARKETING_TWITTER_DESCRIPTION,
	buildHomepageMarketingSearchUrlTemplate
} from '$lib/public-contracts/homepage';
import { resolvePublicPageSocialImage } from '$lib/seo/meta';
import { SchemaService } from '$lib/services/schemaService';

const mockSearchCatalog = vi.fn();

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: mockSearchCatalog
}));

let load: typeof import('./+page.server').load;

const catalogRows = [{ id: 1, name: 'Pink Bourbon' }];

type SchemaNode = {
	'@type'?: string;
	description?: string;
	potentialAction?: {
		target?: {
			urlTemplate?: string;
		};
	};
};

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
				...HOMEPAGE_MARKETING_PREVIEW_QUERY,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
		expect(mockSearchCatalog).toHaveBeenNthCalledWith(
			2,
			{ kind: 'public-client' },
			expect.objectContaining({
				...HOMEPAGE_MARKETING_PREVIEW_QUERY,
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
				...HOMEPAGE_MARKETING_PREVIEW_QUERY,
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
				schemaData?: { '@graph': SchemaNode[] };
			};
		};

		const expectedSocialImage = resolvePublicPageSocialImage({
			baseUrl: 'https://purveyors.test',
			preferredPath: HOMEPAGE_MARKETING_SOCIAL_IMAGE.preferredPath,
			alt: HOMEPAGE_MARKETING_SOCIAL_IMAGE.alt
		});
		const expectedSchema = new SchemaService({
			baseUrl: 'https://purveyors.test'
		}).generatePageSchema('homepage-marketing', 'https://purveyors.test') as {
			'@graph': SchemaNode[];
		};
		const homepageSchema = result.meta.schemaData as { '@graph': SchemaNode[] };
		const websiteSchema = homepageSchema['@graph'].find((node) => node['@type'] === 'WebSite');
		const organizationSchema = homepageSchema['@graph'].find(
			(node) => node['@type'] === 'Organization'
		);
		const appSchema = homepageSchema['@graph'].find(
			(node) => node['@type'] === 'SoftwareApplication'
		);

		expect(result.data).toEqual([]);
		expect(result.trainingData).toEqual([]);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Error loading homepage coffee preview:',
			expect.any(Error)
		);
		expect(result.meta).toMatchObject({
			title: HOMEPAGE_MARKETING_TITLE,
			description: HOMEPAGE_MARKETING_DESCRIPTION,
			canonical: 'https://purveyors.test/',
			ogTitle: HOMEPAGE_MARKETING_TITLE,
			ogDescription: HOMEPAGE_MARKETING_OG_DESCRIPTION,
			ogImage: expectedSocialImage.url,
			ogImageAlt: HOMEPAGE_MARKETING_SOCIAL_IMAGE.alt,
			twitterTitle: HOMEPAGE_MARKETING_TITLE,
			twitterDescription: HOMEPAGE_MARKETING_TWITTER_DESCRIPTION,
			twitterImage: expectedSocialImage.url,
			twitterImageAlt: HOMEPAGE_MARKETING_SOCIAL_IMAGE.alt
		});
		expect(homepageSchema).toEqual(expectedSchema);
		expect(websiteSchema?.potentialAction?.target?.urlTemplate).toBe(
			buildHomepageMarketingSearchUrlTemplate('https://purveyors.test')
		);
		expect(organizationSchema?.description).toBe(HOMEPAGE_MARKETING_ORGANIZATION_DESCRIPTION);
		expect(appSchema?.description).toBe(HOMEPAGE_MARKETING_APPLICATION_DESCRIPTION);

		consoleErrorSpy.mockRestore();
	});
});
