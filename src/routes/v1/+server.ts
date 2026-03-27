import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		product: 'Parchment Platform',
		namespace: '/v1',
		version: 'v1',
		auth: {
			session: true,
			apiKey: true
		},
		resources: {
			catalog: {
				href: '/v1/catalog',
				status: 'live',
				legacyAliases: ['/api/catalog', '/api/catalog-api']
			}
		}
	});
};
