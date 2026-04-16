export const HOMEPAGE_MARKETING_TITLE =
	'Purveyors - Live Green Coffee Catalog & Coffee Intelligence';

export const HOMEPAGE_MARKETING_DESCRIPTION =
	'Browse normalized green coffee listings, recent arrivals, and the API-first coffee intelligence platform built for roasters, buyers, and developers.';

export const HOMEPAGE_MARKETING_OG_DESCRIPTION =
	'Explore recent arrivals, normalized sourcing data, and the API-first coffee platform built for roasters and developers.';

export const HOMEPAGE_MARKETING_TWITTER_DESCRIPTION =
	'Browse live green coffee data, compare recent arrivals, and explore the API-first coffee intelligence platform for roasters.';

export const HOMEPAGE_MARKETING_KEYWORDS = [
	'green coffee catalog',
	'coffee intelligence',
	'coffee sourcing',
	'green coffee API',
	'coffee data platform',
	'coffee roaster software',
	'specialty coffee'
] as const;

export const HOMEPAGE_MARKETING_SOCIAL_IMAGE = {
	preferredPath: '/og/home.jpg',
	alt: 'Purveyors homepage social preview card'
} as const;

export const HOMEPAGE_MARKETING_PREVIEW_QUERY = {
	stockedOnly: true,
	orderBy: 'arrival_date',
	orderDirection: 'desc',
	limit: 6
} as const;

export const HOMEPAGE_MARKETING_SEARCH_PATH = '/catalog?name={search_term_string}';

export const HOMEPAGE_MARKETING_ORGANIZATION_DESCRIPTION =
	'Coffee intelligence platform with a live green coffee catalog, normalized sourcing data, and an API-first workflow layer';

export const HOMEPAGE_MARKETING_APPLICATION_DESCRIPTION =
	'Coffee intelligence platform with a live green coffee catalog, sourcing data, roast tracking, and operational workflows for roasters';

export function buildHomepageMarketingSearchUrlTemplate(baseUrl: string): string {
	const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
	return `${normalizedBaseUrl}${HOMEPAGE_MARKETING_SEARCH_PATH}`;
}
