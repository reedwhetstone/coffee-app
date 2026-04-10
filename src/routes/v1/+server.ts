import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		product: 'Parchment Platform',
		namespace: '/v1',
		version: 'v1',
		auth: {
			anonymous: true,
			session: true,
			apiKey: true
		},
		resources: {
			catalog: {
				href: '/v1/catalog',
				status: 'live',
				auth: {
					anonymous: true,
					session: true,
					apiKey: true
				},
				access: {
					anonymous: 'public-only',
					session: 'viewer public-only; member/admin may unlock privileged visibility',
					apiKey: 'public-only; plan-limited'
				},
				legacyAliases: ['/api/catalog', '/api/catalog-api'],
				legacyRoutes: [
					{
						href: '/api/catalog',
						status: 'internal-compatibility',
						auth: {
							anonymous: true,
							session: true,
							apiKey: true
						}
					},
					{
						href: '/api/catalog-api',
						status: 'deprecated',
						deprecated: true,
						publicOnly: true,
						auth: {
							apiKey: true
						},
						sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
					}
				]
			}
		}
	});
};
