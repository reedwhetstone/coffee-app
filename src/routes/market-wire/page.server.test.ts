import { describe, expect, it, vi } from 'vitest';

import type { MarketWireArchiveItem } from '$lib/marketWire';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const { getAllPosts, loadMarketReadPreference } = vi.hoisted(() => ({
	getAllPosts: vi.fn(),
	loadMarketReadPreference: vi.fn()
}));

vi.mock('$lib/server/blog', () => ({ getAllPosts }));
vi.mock('$lib/server/marketWireSubscription', () => ({ loadMarketReadPreference }));

import { load } from './+page.server';

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

function makeEvent(signedIn: boolean) {
	return {
		url: new URL('https://purveyors.io/market-wire'),
		locals: {
			principal: signedIn
				? cookieSessionPrincipal('viewer', {
						user: { id: 'user-1', email: 'reader@example.com' } as never
					})
				: anonymousPrincipal()
		},
		request: new Request('https://purveyors.io/market-wire'),
		fetch: vi.fn()
	} as never;
}

describe('/market-wire page load', () => {
	it('keeps the landing public and does not call the session contract anonymously', async () => {
		getAllPosts.mockResolvedValue([]);

		const result = await load(makeEvent(false));
		if (!result) throw new Error('Expected Market Wire page data');

		expect(result.isSignedIn).toBe(false);
		expect(result.marketReadPreference).toBeNull();
		expect(loadMarketReadPreference).not.toHaveBeenCalled();
		expect(result.meta.canonical).toBe('https://purveyors.io/market-wire');
	});

	it('loads the account preference and latest published editions for signed-in readers', async () => {
		getAllPosts.mockResolvedValue([
			{
				slug: 'market-brief-002',
				title: 'Edition Two',
				description: 'Second.',
				date: '2026-08-30',
				draft: false,
				format: 'market-brief',
				edition: 2,
				tags: [],
				pillar: 'market-intelligence'
			},
			{
				slug: 'draft-market-brief',
				title: 'Draft',
				description: 'Hidden.',
				date: '2026-08-31',
				draft: true,
				format: 'market-brief',
				edition: 3,
				tags: [],
				pillar: 'market-intelligence'
			}
		]);
		loadMarketReadPreference.mockResolvedValue({ preference, error: null });
		const event = makeEvent(true);

		const result = await load(event);
		if (!result) throw new Error('Expected Market Wire page data');

		expect(loadMarketReadPreference).toHaveBeenCalledWith(event);
		expect(result.email).toBe('reader@example.com');
		expect(result.marketReadPreference).toEqual(preference);
		expect(result.latestEditions.map((edition: MarketWireArchiveItem) => edition.edition)).toEqual([
			2
		]);
	});
});
