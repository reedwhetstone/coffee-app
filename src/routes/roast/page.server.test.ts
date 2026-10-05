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

function run(principal: RequestPrincipal, query = '') {
	const fetch = vi.fn(async () => Response.json({ data: [{ roast_id: 4531 }] }));
	const result = load({
		fetch,
		locals: { principal },
		url: new URL(`https://app.test/roast${query}`)
	} as unknown as Parameters<typeof load>[0]) as {
		roastsLocked: boolean;
		initialRoasts?: Promise<unknown>;
	};
	return { fetch, result };
}

describe('roast page server load', () => {
	it.each([
		{ account: 'a viewer', principal: signedIn('viewer') },
		{ account: 'a Parchment Intelligence-only account', principal: signedIn('viewer', true) },
		{ account: 'a signed-out visitor', principal: signedOut }
	])('makes no request and returns no roast data for $account', ({ principal }) => {
		for (const query of ['', '?roast=4531', '?profileId=4531', '?modal=new&beanId=7']) {
			const { fetch, result } = run(principal, query);

			expect(result).toEqual({ roastsLocked: true });
			expect(fetch).not.toHaveBeenCalled();
		}
	});

	it('loads the roast list for a member', async () => {
		const { fetch, result } = run(signedIn('member'));

		expect(result.roastsLocked).toBe(false);
		expect(await result.initialRoasts).toEqual({
			data: { data: [{ roast_id: 4531 }] },
			error: null
		});
		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith('/api/roast-profiles');
	});
});
