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
			path: '/market-wire',
			title: 'Purveyors Market Brief — Weekly Green Coffee Intelligence',
			description:
				'A concise weekly read on green coffee pricing, availability, and market movement, with source-linked evidence from Purveyors.',
			keywords: [
				'green coffee market newsletter',
				'coffee pricing intelligence',
				'green coffee availability',
				'coffee procurement'
			],
			image: resolvePublicPageSocialImage({
				baseUrl,
				alt: 'Purveyors Market Brief weekly green coffee intelligence'
			}),
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'WebPage',
				name: 'Purveyors Market Brief',
				description:
					'A weekly, evidence-linked read on green coffee pricing, availability, and market movement.',
				url: `${baseUrl}/market-wire`,
				isPartOf: { '@type': 'WebSite', name: 'Purveyors', url: baseUrl }
			}
		})
	};
};
