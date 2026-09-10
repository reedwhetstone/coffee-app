import { beforeEach, expect, it, vi } from 'vitest';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';
const { loadInsights } = vi.hoisted(() => ({ loadInsights: vi.fn() }));
vi.mock('$lib/server/marketIndex', () => ({ loadMarketIndexInsights: loadInsights }));
import type { RequestPrincipal } from '$lib/server/principal';
import { GET } from './+server';
function event(query: string, principal: RequestPrincipal = anonymousPrincipal()) {
	return {
		url: new URL(`https://example.com/api/analytics/insights?${query}`),
		locals: { principal }
	} as never;
}
beforeEach(() => {
	vi.clearAllMocks();
	loadInsights.mockResolvedValue({ valueSignals: [] });
});
it('rejects invalid scopes before doing upstream work', async () => {
	await expect(GET(event('market=private'))).rejects.toMatchObject({ status: 400 });
	expect(loadInsights).not.toHaveBeenCalled();
});
it('does not grant anonymous callers wholesale insights', async () => {
	await expect(GET(event('market=wholesale'))).rejects.toMatchObject({ status: 403 });
	expect(loadInsights).not.toHaveBeenCalled();
});
it('loads the selected entitled scope without repeating metadata and forbids shared caching', async () => {
	const request = event(
		'market=wholesale&window=30d',
		cookieSessionPrincipal('member', { ppiAccess: true })
	);
	const response = await GET(request);
	expect(response.headers.get('cache-control')).toBe('private, no-store');
	expect(loadInsights).toHaveBeenCalledWith(request, {
		isParchmentIntelligence: true,
		scope: { market: 'wholesale', window: '30d' },
		includeMetadata: false
	});
});
