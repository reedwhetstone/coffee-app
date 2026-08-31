import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	createParchmentServerClient: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient
}));

import { loadMarketReadPreference } from './marketWireSubscription';

const preference = {
	publication: 'market_read',
	status: 'subscribed',
	subscribed: true,
	consentSource: 'signup',
	consentedAt: '2026-08-31T01:00:00.000Z',
	unsubscribedAt: null,
	createdAt: '2026-08-31T01:00:00.000Z',
	updatedAt: '2026-08-31T01:00:00.000Z'
};

describe('loadMarketReadPreference', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			emailSubscriptions: { get: mocks.get }
		});
	});

	it('unwraps the SDK preference envelope for account-owned page data', async () => {
		mocks.get.mockResolvedValue({ data: { data: preference } });
		const event = { request: new Request('https://app.test/account') } as never;

		await expect(loadMarketReadPreference(event)).resolves.toEqual({
			preference,
			error: null
		});
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
	});

	it('returns a closed preference state when Parchment is unavailable', async () => {
		mocks.get.mockResolvedValue({
			error: { error: { code: 'storage_unavailable', message: 'Try again later.' } }
		});

		await expect(loadMarketReadPreference({} as never)).resolves.toEqual({
			preference: null,
			error: 'Try again later.'
		});
	});
});
