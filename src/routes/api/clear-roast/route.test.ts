import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParchmentConfigError } from '$lib/server/parchmentClient';

const { mockClearArtisanImport, mockCreateParchmentServerClient } = vi.hoisted(() => {
	const mockClearArtisanImport = vi.fn();
	const mockCreateParchmentServerClient = vi.fn(async () => ({
		roasts: { clearArtisanImport: mockClearArtisanImport }
	}));

	return { mockClearArtisanImport, mockCreateParchmentServerClient };
});

vi.mock('$lib/server/parchmentClient', async () => {
	class MockParchmentConfigError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ParchmentConfigError';
		}
	}

	return {
		ParchmentConfigError: MockParchmentConfigError,
		createParchmentServerClient: mockCreateParchmentServerClient
	};
});

let DELETE: typeof import('./+server').DELETE;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ DELETE } = await import('./+server'));
});

function makeEvent(url = 'https://app.test/api/clear-roast?roast_id=42', session = true) {
	return {
		url: new URL(url),
		request: new Request(url, { method: 'DELETE' }),
		locals: {
			safeGetSession: vi.fn(async () =>
				session ? { session: { access_token: 'jwt' }, user: { id: 'user-1' } } : {}
			)
		}
	} as unknown as Parameters<NonNullable<typeof DELETE>>[0];
}

describe('/api/clear-roast', () => {
	it('clears Artisan import data through Parchment and preserves the legacy response shape', async () => {
		mockClearArtisanImport.mockResolvedValue({
			data: {
				data: {
					id: 42,
					deletedCounts: {
						artisan_import_log: 1,
						roast_events: 3,
						roast_temperatures: 120
					},
					batchName: 'Sunday roast'
				}
			},
			error: null,
			response: new Response(null, { status: 200 })
		});

		const response = await DELETE(makeEvent());

		expect(response.status).toBe(200);
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockClearArtisanImport).toHaveBeenCalledWith(42);
		expect(await response.json()).toEqual({
			success: true,
			message: 'Successfully cleared roast data. Deleted 124 total records.',
			deleted_counts: {
				artisan_import_log: 1,
				roast_events: 3,
				roast_temperatures: 120
			},
			batch_name: 'Sunday roast'
		});
	});

	it('rejects unauthenticated callers before proxying', async () => {
		const response = await DELETE(makeEvent('https://app.test/api/clear-roast?roast_id=42', false));

		expect(response.status).toBe(401);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockClearArtisanImport).not.toHaveBeenCalled();
	});

	it('validates the roast id before proxying', async () => {
		const response = await DELETE(makeEvent('https://app.test/api/clear-roast?roast_id=abc'));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid roast ID' });
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it('relays Parchment errors with their original status', async () => {
		mockClearArtisanImport.mockResolvedValue({
			data: undefined,
			error: { error: { message: 'Missing roast:write' } },
			response: new Response(null, { status: 403 })
		});

		const response = await DELETE(makeEvent());

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Missing roast:write' });
	});

	it('reports missing Parchment configuration as unavailable', async () => {
		mockCreateParchmentServerClient.mockRejectedValueOnce(
			new ParchmentConfigError('PARCHMENT_API_BASE_URL is not configured')
		);

		const response = await DELETE(makeEvent());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Clear roast is temporarily unavailable' });
	});
});
