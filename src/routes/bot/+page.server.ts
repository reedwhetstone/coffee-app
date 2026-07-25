import type { PageServerLoad } from './$types';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;

	return {
		meta: buildPublicMeta({
			baseUrl,
			path: '/bot',
			title: 'PurveyorsBot - Crawler Identity and Operator Policy',
			description:
				'Technical identity, request policy, data use, and opt-out instructions for the Purveyors green-coffee catalog crawler.',
			keywords: [
				'PurveyorsBot',
				'Web Bot Auth',
				'crawler policy',
				'green coffee catalog',
				'crawler opt out'
			],
			ogTitle: 'PurveyorsBot Operator Information',
			ogDescription:
				'How PurveyorsBot identifies itself, fetches public storefront data, controls request rates, and handles opt-out requests.',
			twitterTitle: 'PurveyorsBot Operator Information',
			twitterDescription:
				'Crawler identity, request policy, data use, and opt-out instructions for website operators.'
		})
	};
};
