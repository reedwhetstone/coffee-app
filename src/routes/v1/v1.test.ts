import { describe, expect, it } from 'vitest';

import { GET } from './+server';

describe('/v1 discovery route', () => {
	it('publishes the catalog auth matrix and legacy alias metadata', async () => {
		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.auth).toEqual({
			anonymous: true,
			session: true,
			apiKey: true
		});
		expect(body.resources.catalog).toMatchObject({
			href: '/v1/catalog',
			status: 'live',
			auth: {
				anonymous: true,
				session: true,
				apiKey: true
			},
			legacyAliases: ['/api/catalog', '/api/catalog-api']
		});
		expect(body.resources.catalog.legacyRoutes).toContainEqual(
			expect.objectContaining({
				href: '/api/catalog-api',
				status: 'deprecated',
				deprecated: true,
				publicOnly: true,
				auth: { apiKey: true },
				sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
			})
		);
	});
});
