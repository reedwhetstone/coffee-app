import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		product: 'Parchment',
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
			},
			proofCoverage: {
				href: '/v1/catalog/proof-coverage',
				status: 'live',
				auth: {
					anonymous: true,
					session: true,
					apiKey: true
				},
				access: {
					anonymous: 'aggregate public proof coverage only; no row-level proof search leverage',
					session: 'same visible catalog scope as /v1/catalog',
					apiKey: 'plan-limited visible catalog scope with X-RateLimit-* headers'
				},
				source: {
					resource: '/v1/catalog',
					aggregateOnly: true,
					rawEvidenceIncluded: false
				}
			},
			priceIndex: {
				href: '/v1/price-index',
				status: 'live',
				auth: {
					apiKey: true,
					anonymous: false,
					session: false
				},
				access: {
					apiKey: 'requires Parchment Intelligence access; aggregate snapshots only'
				},
				source: {
					table: 'price_index_snapshots',
					aggregateOnly: true
				}
			},
			procurementBriefs: {
				href: '/v1/procurement/briefs',
				status: 'live',
				auth: {
					anonymous: false,
					session: true,
					apiKey: true
				},
				access: {
					session: 'requires member or admin role',
					apiKey: 'requires member or enterprise API plan'
				},
				capabilities: ['create', 'list', 'get', 'manualMatches'],
				matchRoute: '/v1/procurement/briefs/:id/matches'
			}
		}
	});
};
