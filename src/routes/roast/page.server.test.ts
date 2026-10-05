import { describe, expect, it, vi } from 'vitest';
import type { RequestPrincipal } from '$lib/server/principal';
import { load } from './+page.server';

const signedIn = (role: 'viewer' | 'member', ppiAccess = false) =>
	({
		isAuthenticated: true,
		authKind: 'session',
		source: 'cookie-session',
		session: { access_token: 'cookie-token' },
		user: { id: `${role}-user` },
		appRoles: [role],
		primaryAppRole: role,
		ppiAccess
	}) as unknown as RequestPrincipal;

const signedOut = {
	isAuthenticated: false,
	authKind: 'anonymous',
	source: 'anonymous',
	session: null,
	user: null,
	appRoles: [],
	primaryAppRole: null,
	ppiAccess: false
} as unknown as RequestPrincipal;

const page = { data: [{ roast_id: 4531 }], totals: { roasts: 1, batches: 1, average_loss_percent: null } };

function run(principal: RequestPrincipal, query = '') {
	const fetch = vi.fn(async () => Response.json(page));
	const url = new URL(`https://app.test/roast${query}`);
	// SvelteKit runs `untrack` so that reading the address does not make the load depend on it.
	const untrack = vi.fn(<T>(read: () => T) => read());
	const result = load({
		fetch,
		locals: { principal },
		url,
		untrack
	} as unknown as Parameters<typeof load>[0]) as {
		roastsLocked: boolean;
		initialRoastsKey?: string;
		initialRoasts?: Promise<unknown> | null;
	};
	return { fetch, result, untrack };
}

const requested = (fetch: ReturnType<typeof run>['fetch']) =>
	new URL(String((fetch.mock.calls as unknown[][])[0][0]), 'https://app.test').searchParams;

describe('roast page server load', () => {
	it.each([
		{ account: 'a viewer', principal: signedIn('viewer') },
		{ account: 'a Parchment Intelligence-only account', principal: signedIn('viewer', true) },
		{ account: 'a signed-out visitor', principal: signedOut }
	])('makes no request and returns no roast data for $account', ({ principal }) => {
		for (const query of ['', '?roast=4531', '?profileId=4531', '?modal=new&beanId=7', '?q=guji']) {
			const { fetch, result } = run(principal, query);

			expect(result).toEqual({ roastsLocked: true });
			expect(fetch).not.toHaveBeenCalled();
		}
	});

	it('loads the first page of roasts for a member, not every roast', async () => {
		const { fetch, result } = run(signedIn('member'));

		expect(result.roastsLocked).toBe(false);
		expect(await result.initialRoasts).toEqual({ data: page, error: null });
		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith('/api/roast-profiles?limit=50&offset=0');
		expect(result.initialRoastsKey).toBe('/roast');
	});

	it('asks for the first page with every filter in the address', async () => {
		const batch = 'aaaaaaaa-0000-4000-8000-000000000001';
		const { fetch, result } = run(
			signedIn('member'),
			`?coffee=101&batch=${batch}&from=2026-09-01&to=2026-09-30&q=guji&market=wholesale&roast=4531`
		);

		expect(Object.fromEntries(requested(fetch))).toEqual({
			coffee_id: '101',
			batch_id: batch,
			date_start: '2026-09-01',
			date_end: '2026-09-30',
			q: 'guji',
			is_wholesale: 'true',
			limit: '50',
			offset: '0'
		});
		// The key names the filters the first page is for, and leaves the open roast out.
		expect(result.initialRoastsKey).toBe(
			`/roast?coffee=101&batch=${batch}&from=2026-09-01&to=2026-09-30&q=guji&market=wholesale`
		);
	});

	it('leaves a date preset to the browser, which knows the member’s calendar day', () => {
		const { fetch, result } = run(signedIn('member'), '?range=7d&coffee=101');

		expect(fetch).not.toHaveBeenCalled();
		expect(result.initialRoasts).toBeNull();
		expect(result.initialRoastsKey).toBe('/roast?coffee=101&range=7d');
	});

	it('reads the address without tracking it, so a filter change does not run the load again', () => {
		const { untrack } = run(signedIn('member'), '?q=guji');

		expect(untrack).toHaveBeenCalledOnce();
	});
});
