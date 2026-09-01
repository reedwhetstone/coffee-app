import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class MockParchmentConfigError extends Error {}
	class MockParchmentShareError extends Error {
		constructor(
			public status: number,
			public body: unknown,
			message = 'Parchment share request failed'
		) {
			super(message);
		}
	}

	return {
		isCookieSessionPrincipal: vi.fn(),
		createParchmentServerClient: vi.fn(),
		createParchmentInventoryShareGrant: vi.fn(),
		ParchmentConfigError: MockParchmentConfigError,
		ParchmentShareError: MockParchmentShareError
	};
});

vi.mock('$lib/server/principal', () => ({
	isCookieSessionPrincipal: mocks.isCookieSessionPrincipal
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

vi.mock('$lib/server/parchmentShares', () => ({
	createParchmentInventoryShareGrant: mocks.createParchmentInventoryShareGrant,
	ParchmentShareError: mocks.ParchmentShareError
}));

import { POST } from './+server';

const TOKEN = 'a'.repeat(64);
const CLIENT = { kind: 'parchment-client' };

function makeEvent(body: BodyInit = JSON.stringify({ resourceId: 'all' })) {
	return {
		request: new Request('https://app.test/api/share', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		}),
		locals: {
			principal: { source: 'cookie-session' }
		}
	};
}

describe('POST /api/share', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isCookieSessionPrincipal.mockReturnValue(true);
		mocks.createParchmentServerClient.mockResolvedValue(CLIENT);
		mocks.createParchmentInventoryShareGrant.mockResolvedValue({
			id: '00000000-0000-4000-8000-000000000001',
			token: TOKEN,
			scope: { type: 'all' },
			expiresAt: '2026-09-07T12:00:00.000Z'
		});
	});

	it('creates an all-inventory grant through the session SDK', async () => {
		const event = makeEvent();
		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mocks.createParchmentInventoryShareGrant).toHaveBeenCalledWith(
			CLIENT,
			expect.objectContaining({
				operationId: expect.stringMatching(
					/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
				),
				scope: { type: 'all' },
				expiresInDays: 7
			})
		);
		expect(await response.json()).toEqual({
			shareUrl: `https://app.test/beans?share=${TOKEN}`
		});
	});

	it('maps one numeric resource and the legacy day-string input', async () => {
		const response = await POST(
			makeEvent(JSON.stringify({ resourceId: '42', expiresIn: '14d' })) as never
		);

		expect(response.status).toBe(200);
		expect(mocks.createParchmentInventoryShareGrant).toHaveBeenCalledWith(
			CLIENT,
			expect.objectContaining({
				scope: { type: 'inventory', inventoryId: 42 },
				expiresInDays: 14
			})
		);
	});

	it('rejects anonymous and API-key principals before creating a client', async () => {
		mocks.isCookieSessionPrincipal.mockReturnValue(false);

		const response = await POST(makeEvent() as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		JSON.stringify({ resourceId: 0 }),
		JSON.stringify({ resourceId: 'all', expiresIn: '0d' }),
		JSON.stringify({ resourceId: 'all', expiresIn: '31d' }),
		'{'
	])('rejects invalid transport input without calling Parchment', async (body) => {
		const response = await POST(makeEvent(body) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid share request' });
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('preserves the legacy not-found response for a non-owned inventory row', async () => {
		mocks.createParchmentInventoryShareGrant.mockRejectedValue(
			new mocks.ParchmentShareError(404, {}, 'Not found')
		);

		const response = await POST(makeEvent(JSON.stringify({ resourceId: 42 })) as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Bean not found or unauthorized' });
	});

	it('returns a non-cacheable service error when Parchment is unconfigured', async () => {
		mocks.createParchmentServerClient.mockRejectedValue(
			new mocks.ParchmentConfigError('missing base URL')
		);

		const response = await POST(makeEvent() as never);

		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ error: 'Share links are temporarily unavailable' });
	});
});
