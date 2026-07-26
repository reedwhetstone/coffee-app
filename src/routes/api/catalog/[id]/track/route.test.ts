import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireParchmentAccess, mockCreateParchmentServerClient, mockTrack, mockUntrack } =
	vi.hoisted(() => ({
		mockRequireParchmentAccess: vi.fn(),
		mockCreateParchmentServerClient: vi.fn(),
		mockTrack: vi.fn(),
		mockUntrack: vi.fn()
	}));

vi.mock('$lib/server/auth', () => {
	class MockAuthError extends Error {
		constructor(
			message: string,
			public status: number
		) {
			super(message);
		}
	}
	return {
		AuthError: MockAuthError,
		requireParchmentAccess: mockRequireParchmentAccess
	};
});

vi.mock('$lib/server/parchmentClient', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/parchmentClient')>()),
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let PUT: typeof import('./+server').PUT;

function makeEvent(id: string, body: unknown): Parameters<typeof PUT>[0] {
	const url = `https://app.test/api/catalog/${id}/track`;
	return {
		params: { id },
		request: new Request(url, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		}),
		locals: {}
	} as unknown as Parameters<typeof PUT>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockRequireParchmentAccess.mockResolvedValue({ user: { id: 'user-1' } });
	mockCreateParchmentServerClient.mockResolvedValue({
		portfolio: { trackedLots: { track: mockTrack, untrack: mockUntrack } }
	});
	({ PUT } = await import('./+server'));
});

describe('PUT /api/catalog/[id]/track', () => {
	it('sends explicit tracked state through the request-bound Parchment client', async () => {
		mockTrack.mockResolvedValue({
			data: {
				data: {
					catalogId: 42,
					tracked: true,
					trackedAt: '2026-07-26T12:00:00Z',
					priceAtTracking: 7.1
				}
			},
			response: new Response(null, { status: 200 })
		});

		const response = await PUT(makeEvent('42', { tracked: true }));

		expect(response.status).toBe(200);
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockTrack).toHaveBeenCalledWith(42);
		expect(mockUntrack).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ catalogId: 42, tracked: true });
	});

	it('untracks idempotently when the requested state is false', async () => {
		mockUntrack.mockResolvedValue({
			data: {
				data: {
					catalogId: 42,
					tracked: false,
					trackedAt: null,
					priceAtTracking: null
				}
			},
			response: new Response(null, { status: 200 })
		});

		const response = await PUT(makeEvent('42', { tracked: false }));

		expect(response.status).toBe(200);
		expect(mockUntrack).toHaveBeenCalledWith(42);
		expect(mockTrack).not.toHaveBeenCalled();
	});

	it.each([
		['abc', { tracked: true }],
		['0', { tracked: true }],
		['2147483648', { tracked: true }]
	])('rejects invalid catalog id %s', async (id, body) => {
		const response = await PUT(makeEvent(id, body));
		expect(response.status).toBe(400);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([{}, { tracked: 'yes' }, { tracked: null }])(
		'rejects invalid desired-state payloads',
		async (body) => {
			const response = await PUT(makeEvent('42', body));
			expect(response.status).toBe(400);
			expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		}
	);

	it('relays the Parchment status and structured error body', async () => {
		mockTrack.mockResolvedValue({
			error: { error: { code: 'portfolio_write_disabled', message: 'Writes are not enabled' } },
			response: new Response(null, { status: 503 })
		});

		const response = await PUT(makeEvent('42', { tracked: true }));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: { code: 'portfolio_write_disabled', message: 'Writes are not enabled' }
		});
	});
});
