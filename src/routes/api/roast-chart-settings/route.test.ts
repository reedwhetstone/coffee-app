import { beforeEach, describe, expect, it, vi } from 'vitest';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { GET } from './+server';

function makeEvent(options: { authenticated?: boolean; roastId?: string } = {}) {
	const authenticated = options.authenticated ?? true;
	const roastId = options.roastId ?? '42';

	return {
		url: new URL(`https://app.test/api/roast-chart-settings?roastId=${roastId}`),
		request: new Request(`https://app.test/api/roast-chart-settings?roastId=${roastId}`),
		fetch: vi.fn(),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({
				session: authenticated ? { access_token: 'session-token' } : null,
				user: authenticated ? { id: 'user-1' } : null
			})
		}
	};
}

describe('/api/roast-chart-settings GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('maps owner-scoped Parchment detail fields to the legacy settings envelope', async () => {
		const get = vi.fn().mockResolvedValue({
			data: {
				data: {
					chart_x_min: 0,
					chart_x_max: 900,
					chart_y_min: null,
					chart_y_max: 500,
					chart_z_min: -5,
					chart_z_max: 40
				}
			}
		});
		const event = makeEvent();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roasts: { get } });

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			settings: {
				xRange: [0, 900],
				yRange: [null, 500],
				zRange: [-5, 40]
			}
		});
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(get).toHaveBeenCalledWith('42');
	});

	it('preserves the legacy null settings response when Parchment fails', async () => {
		const get = vi.fn().mockResolvedValue({
			error: { error: { code: 'not_found', message: 'Roast not found' } }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roasts: { get } });

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ settings: null });
	});

	it('rejects unauthenticated callers before constructing a Parchment client', async () => {
		const response = await GET(makeEvent({ authenticated: false }) as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Authentication required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('preserves legacy roast id parsing and rejects values without a numeric prefix', async () => {
		const response = await GET(makeEvent({ roastId: 'not-a-number' }) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Valid roastId parameter required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});
