import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	access: vi.fn(),
	client: vi.fn(),
	inventory: vi.fn(),
	share: vi.fn()
}));
vi.mock('$lib/server/auth', () => ({ requireParchmentAccess: mocks.access }));
vi.mock('$lib/server/parchmentClient', () => ({ createParchmentServerClient: mocks.client }));
vi.mock('$lib/server/portfolioPage', () => ({
	fetchPortfolioPage: mocks.inventory,
	parsePortfolioQuery: () => ({ offset: 0, limit: 50 })
}));
vi.mock('$lib/server/parchmentShares', () => ({ redeemParchmentInventoryShareGrant: mocks.share }));
import { load } from './+page.server';
const event = (query = '') =>
	({
		url: new URL(`https://purveyors.io/beans${query}`),
		setHeaders: vi.fn()
	}) as unknown as Parameters<typeof load>[0];
beforeEach(() => {
	vi.clearAllMocks();
	mocks.access.mockResolvedValue({ memberAccess: true });
	mocks.client.mockResolvedValue({ id: 'client' });
	mocks.inventory.mockResolvedValue({ data: [{ id: 7 }] });
	mocks.share.mockResolvedValue([{ id: 8 }]);
});
describe('purchased portfolio server stream', () => {
	it('returns the shell before the owner read settles and streams complete purchased data', async () => {
		let resolve!: (value: unknown) => void;
		mocks.inventory.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const result = (await load(event())) as {
			purchases: Promise<{ data: unknown[]; error: string | null }>;
		};
		expect(result.purchases).toBeInstanceOf(Promise);
		await vi.waitFor(() => expect(mocks.inventory).toHaveBeenCalled());
		resolve({ data: [{ id: 7 }] });
		expect(await result.purchases).toEqual({ data: [{ id: 7 }], error: null });
		expect(mocks.inventory).toHaveBeenCalledWith({ id: 'client' }, { offset: 0, limit: 50 }, true);
	});
	it('keeps Intelligence-only roast restrictions', async () => {
		mocks.access.mockResolvedValue({ memberAccess: false });
		const result = (await load(event())) as { purchases: Promise<unknown> };
		await result.purchases;
		expect(mocks.inventory).toHaveBeenCalledWith({ id: 'client' }, { offset: 0, limit: 50 }, false);
	});
	it('redeems shares anonymously without reading owner inventory', async () => {
		const request = event('?share=grant');
		const result = (await load(request)) as { purchases: Promise<unknown> };
		expect(await result.purchases).toEqual({ data: [{ id: 8 }], error: null });
		expect(mocks.client).toHaveBeenCalledWith(request, { mode: 'anonymous' });
		expect(mocks.access).not.toHaveBeenCalled();
		expect(mocks.inventory).not.toHaveBeenCalled();
		expect(request.setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store' });
	});
	it('streams an honest retryable failure instead of an unhandled rejection', async () => {
		mocks.inventory.mockRejectedValueOnce(new Error('upstream failure'));
		const result = (await load(event())) as {
			purchases: Promise<{ data: unknown[]; error: string | null }>;
		};
		const purchases = await result.purchases;
		expect(purchases.data).toEqual([]);
		expect(purchases.error).toContain('Unable to load');
	});
});
