import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOriginPriceStats = vi.fn();
const mockCreateParchmentServerClient = vi.fn(async () => ({
	catalog: { originPriceStats: mockOriginPriceStats }
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient,
	ParchmentConfigError: class ParchmentConfigError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ParchmentConfigError';
		}
	}
}));

let GET: typeof import('./+server').GET;

const parchmentStats = [
	{
		origin: 'Colombia',
		median: 6,
		q1: 5,
		q3: 7,
		min: 4,
		max: 8,
		sample_size: 12,
		supplier_count: 4
	}
];

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockOriginPriceStats.mockResolvedValue({
		data: { originPriceStats: parchmentStats },
		error: null
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { originPriceStats: mockOriginPriceStats }
	});
	({ GET } = await import('./+server'));
});

function makeEvent(
	url: string,
	locals: Partial<App.Locals> = {}
): Parameters<NonNullable<typeof GET>>[0] {
	return {
		url: new URL(url),
		locals: { session: null, role: null, ...locals }
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

const memberLocals = {
	session: { access_token: 'cookie-token' } as App.Locals['session'],
	role: 'member' as App.Locals['role']
};

describe('/api/catalog/origin-price-stats', () => {
	it('relays Parchment origin price stats and preserves the meta.access shape', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog/origin-price-stats'));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			originPriceStats: parchmentStats,
			meta: {
				access: { publicOnly: true, showWholesale: false, wholesaleOnly: false }
			}
		});
		// Anonymous caller: no wholesale flags forwarded; Parchment derives scope
		// (and publicOnly) from the forwarded credential.
		const query = mockOriginPriceStats.mock.calls[0][0];
		expect(query).not.toHaveProperty('showWholesale');
		expect(query).not.toHaveProperty('wholesaleOnly');
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
	});

	it('forwards the resolved wholesale view params for a privileged session', async () => {
		const response = await GET(
			makeEvent(
				'https://app.test/api/catalog/origin-price-stats?showWholesale=true&wholesaleOnly=true',
				memberLocals
			)
		);

		expect(response.status).toBe(200);
		expect(mockOriginPriceStats).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true', wholesaleOnly: 'true' })
		);
		expect(await response.json()).toMatchObject({
			meta: { access: { publicOnly: false, showWholesale: true, wholesaleOnly: true } }
		});
	});

	it('does not forward wholesale view params that a privileged caller did not request', async () => {
		await GET(
			makeEvent('https://app.test/api/catalog/origin-price-stats?showWholesale=true', memberLocals)
		);

		const query = mockOriginPriceStats.mock.calls[0][0];
		expect(query).toMatchObject({ showWholesale: 'true' });
		expect(query).not.toHaveProperty('wholesaleOnly');
	});

	it('does not grant wholesale scope to an unprivileged caller even when requested', async () => {
		const response = await GET(
			makeEvent(
				'https://app.test/api/catalog/origin-price-stats?showWholesale=true&wholesaleOnly=true'
			)
		);

		// Anonymous → resolveCatalogVisibility gates both flags off, so nothing is forwarded.
		const query = mockOriginPriceStats.mock.calls[0][0];
		expect(query).not.toHaveProperty('showWholesale');
		expect(query).not.toHaveProperty('wholesaleOnly');
		expect(await response.json()).toMatchObject({
			meta: { access: { publicOnly: true, showWholesale: false, wholesaleOnly: false } }
		});
	});

	it('maps an upstream Parchment error to a 500 JSON body', async () => {
		mockOriginPriceStats.mockResolvedValue({
			data: undefined,
			error: { error: 'boom', message: 'upstream failed' }
		});

		const response = await GET(makeEvent('https://app.test/api/catalog/origin-price-stats'));

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ error: 'Failed to fetch catalog data' });
	});

	it('maps a missing-configuration failure to a 503 JSON body', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured.');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/api/catalog/origin-price-stats'));

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({ error: 'Catalog schema unavailable' });
	});
});
