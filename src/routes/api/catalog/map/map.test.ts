import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockCatalogMap = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockResolveCatalogCredentialMode = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient,
	resolveCatalogCredentialMode: mockResolveCatalogCredentialMode
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal
}));

let GET: typeof import('./+server').GET;

const mapBody = {
	data: [
		{
			type: 'cluster',
			id: 'cluster:1',
			longitude: -70,
			latitude: 5,
			bounds: { west: -80, south: -10, east: -60, north: 20, crossesAntimeridian: false },
			placement_count: 4,
			unique_coffee_count: 3,
			catalog_ids: [1, 2, 3]
		}
	],
	elevation_profile: null,
	meta: {
		resource: 'catalog-map',
		namespace: '/v1/catalog/map',
		version: 'v1',
		auth: { kind: 'api-key', role: null, apiPlan: 'viewer' },
		access: {
			publicOnly: true,
			showWholesale: false,
			wholesaleOnly: false,
			rowLimit: 15,
			limited: true,
			totalAvailable: 20,
			fineGrainedPlaces: false,
			viewportSearch: false,
			elevationProfile: false
		},
		effective: { zoom: 2, lens: 'catalog', place_id: null, bbox: null },
		totals: {
			unique_coffee_count: 15,
			placed_unique_coffee_count: 14,
			unplaced_unique_coffee_count: 1,
			placement_count: 16,
			mappable_placement_count: 16,
			viewport_placed_unique_coffee_count: 14,
			viewport_placement_count: 16
		},
		freshness: {
			generatedAt: '2026-09-01T12:00:00.000Z',
			cacheStatus: 'public',
			ttlSeconds: 60
		}
	}
};

function makeEvent(url: string, init?: RequestInit) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		fetch: vi.fn(),
		locals: { principal: { isAuthenticated: false } }
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
	mockResolveCatalogCredentialMode.mockReturnValue('public-demo');
	mockCatalogMap.mockResolvedValue({
		data: mapBody,
		response: new Response(null, {
			status: 200,
			headers: { 'X-RateLimit-Remaining': '98' }
		})
	});
	mockCreateParchmentServerClient.mockResolvedValue({ catalog: { map: mockCatalogMap } });

	({ GET } = await import('./+server'));
});

describe('/api/catalog/map route', () => {
	it('uses the public-demo credential lane and forwards canonical map/filter params', async () => {
		await GET(
			makeEvent(
				'https://app.test/api/catalog/map?country=Ethiopia&country=Kenya&elevation_min_masl=1200&elevation_max_masl=1900&bbox=170,-20,-170,20&zoom=4&lens=elevation&view=map&map_units=ft&page=3'
			)
		);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'public-demo',
			preferHandling: 'lenient'
		});
		expect(mockCatalogMap).toHaveBeenCalledWith({
			country: ['Ethiopia', 'Kenya'],
			elevationMinMasl: '1200',
			elevationMaxMasl: '1900',
			bbox: '170,-20,-170,20',
			zoom: '4',
			lens: 'elevation'
		});
	});

	it('relays the canonical body and bounded upstream headers unchanged', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog/map?zoom=2'));

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog/map');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('98');
		expect(await response.json()).toEqual(mapBody);
	});

	it('uses the session credential lane for a signed-in browser caller', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: true, authKind: 'session' });
		mockResolveCatalogCredentialMode.mockReturnValue('session');
		const event = makeEvent('https://app.test/api/catalog/map?zoom=5');
		event.locals.principal = { isAuthenticated: true } as never;

		const response = await GET(event);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'lenient'
		});
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});

	it('rejects Authorization headers before any credential or upstream work', async () => {
		const response = await GET(
			makeEvent('https://app.test/api/catalog/map', {
				headers: { Authorization: 'Bearer must-not-enter-browser-bff' }
			})
		);

		expect(response.status).toBe(401);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			error: {
				code: 'session_required',
				message: 'Authorization headers are not accepted by the catalog map browser route.'
			}
		});
		expect(mockResolvePrincipal).not.toHaveBeenCalled();
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it('allows only anonymous demo responses into the shared short cache', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog/map?zoom=2'));

		expect(response.headers.get('Cache-Control')).toBe(
			'public, s-maxage=60, stale-while-revalidate=300'
		);
		expect(response.headers.get('Vary') ?? '').toContain('Cookie');
		expect(response.headers.get('Vary') ?? '').toContain('Authorization');
	});

	it('relays structured upstream denials and never caches them', async () => {
		const body = {
			error: {
				code: 'entitlement_required',
				message: 'Elevation requires Parchment Intelligence.'
			}
		};
		mockCatalogMap.mockResolvedValue({
			error: body,
			response: new Response(null, { status: 403 })
		});

		const response = await GET(makeEvent('https://app.test/api/catalog/map?lens=elevation'));

		expect(response.status).toBe(403);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.json()).toEqual(body);
	});

	it('surfaces missing Parchment configuration as a structured no-store failure', async () => {
		const error = new Error('PARCHMENT_API_BASE_URL is not configured.');
		error.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(error);

		const response = await GET(makeEvent('https://app.test/api/catalog/map'));

		expect(response.status).toBe(503);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured.'
		});
	});
});
