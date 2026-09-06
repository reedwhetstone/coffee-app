import { NEWSLETTER } from '$lib/newsletter';
import type { PageServerLoad } from './$types';

import type { MarketWireArchiveItem } from '$lib/marketWire';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { getAllPosts } from '$lib/server/blog';
import { loadMarketReadPreference } from '$lib/server/marketWireSubscription';
import { isCookieSessionPrincipal } from '$lib/server/principal';

export const load: PageServerLoad = async (event) => {
	const baseUrl = `${event.url.protocol}//${event.url.host}`;
	const principal = event.locals.principal;
	const isSignedIn = isCookieSessionPrincipal(principal);
	const [posts, preferenceState] = await Promise.all([
		getAllPosts(),
		isSignedIn
			? loadMarketReadPreference(event)
			: Promise.resolve({ preference: null, error: null })
	]);
	const latestEditions: MarketWireArchiveItem[] = posts
		.filter(
			(post) => post.format === 'market-brief' && !post.draft && typeof post.edition === 'number'
		)
		.sort((left, right) => right.edition! - left.edition!)
		.slice(0, 3)
		.map((post) => ({
			slug: post.slug,
			title: post.title,
			description: post.description,
			date: post.date,
			edition: post.edition!
		}));

	return {
		isSignedIn,
		email: isSignedIn ? (principal.user.email ?? '') : '',
		marketReadPreference: preferenceState.preference,
		marketReadError: preferenceState.error,
		latestEditions,
		meta: buildPublicMeta({
			baseUrl,
			path: NEWSLETTER.path,
			title: `${NEWSLETTER.name} — Coffee & Technology`,
			description: NEWSLETTER.description,
			keywords: [
				'green coffee market newsletter',
				'coffee and AI',
				'home roasting',
				'coffee technology'
			],
			image: resolvePublicPageSocialImage({
				baseUrl,
				alt: NEWSLETTER.descriptor
			}),
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'WebPage',
				name: NEWSLETTER.name,
				description: NEWSLETTER.description,
				url: `${baseUrl}${NEWSLETTER.path}`,
				isPartOf: { '@type': 'WebSite', name: 'Purveyors', url: baseUrl }
			}
		})
	};
};
