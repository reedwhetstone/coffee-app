import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';
import type { RequestPrincipal } from '$lib/server/principal';

/**
 * Roast logging is part of Mallard Studio, and every roast route checks that itself. This
 * calls each route and method as each kind of account. A request that is let through goes
 * on to ask Parchment, which here records the call and then fails, so "allowed" reads as
 * "Parchment was asked" and "refused" as the exact status with Parchment never asked.
 */

const parchment = vi.hoisted(() => ({ createParchmentServerClient: vi.fn() }));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchment.createParchmentServerClient,
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

import * as artisanImport from '../../routes/api/artisan-import/+server';
import * as clearRoast from '../../routes/api/clear-roast/+server';
import * as roastBatches from '../../routes/api/roast-batches/+server';
import * as roastBatch from '../../routes/api/roast-batches/[id]/+server';
import * as roastChartData from '../../routes/api/roast-chart-data/+server';
import * as roastChartSettings from '../../routes/api/roast-chart-settings/+server';
import * as roastProfiles from '../../routes/api/roast-profiles/+server';
import * as roastArtisanFile from '../../routes/api/roast-profiles/[id]/artisan-file/+server';

type Handler = (event: never) => Response | Promise<Response>;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RouteCase {
	name: string;
	method: Method;
	path: string;
	handler: Handler;
	params?: Record<string, string>;
	body?: unknown;
	form?: () => FormData;
}

const BATCH_ID = '22222222-2222-4222-8222-222222222222';

function artisanForm(): FormData {
	const form = new FormData();
	form.set('file', new File(['{"timex":[0,30]}'], 'roast.alog', { type: 'application/json' }));
	form.set('roastId', '42');
	return form;
}

const ROUTES: RouteCase[] = [
	{
		name: 'list roasts',
		method: 'GET',
		path: '/api/roast-profiles',
		handler: roastProfiles.GET as Handler
	},
	{
		name: "list one coffee's roasts",
		method: 'GET',
		path: '/api/roast-profiles?coffee_id=7',
		handler: roastProfiles.GET as Handler
	},
	{
		name: 'create a roast',
		method: 'POST',
		path: '/api/roast-profiles',
		handler: roastProfiles.POST as Handler,
		body: { coffee_id: 7, batch_name: 'Batch' }
	},
	{
		name: 'update a roast',
		method: 'PUT',
		path: '/api/roast-profiles?id=42',
		handler: roastProfiles.PUT as Handler,
		body: { roast_notes: 'Notes' }
	},
	{
		name: 'delete a roast',
		method: 'DELETE',
		path: '/api/roast-profiles?id=42',
		handler: roastProfiles.DELETE as Handler
	},
	{
		name: "download a roast's Artisan file",
		method: 'GET',
		path: '/api/roast-profiles/42/artisan-file',
		handler: roastArtisanFile.GET as Handler,
		params: { id: '42' }
	},
	{
		name: 'roast chart data',
		method: 'GET',
		path: '/api/roast-chart-data?roastId=42',
		handler: roastChartData.GET as Handler
	},
	{
		name: 'roast chart settings',
		method: 'GET',
		path: '/api/roast-chart-settings?roastId=42',
		handler: roastChartSettings.GET as Handler
	},
	{
		name: 'import an Artisan file',
		method: 'POST',
		path: '/api/artisan-import',
		handler: artisanImport.POST as Handler,
		form: artisanForm
	},
	{
		name: "clear a roast's imported data",
		method: 'DELETE',
		path: '/api/clear-roast?roast_id=42',
		handler: clearRoast.DELETE as Handler
	},
	{
		name: 'list roast batches',
		method: 'GET',
		path: '/api/roast-batches',
		handler: roastBatches.GET as Handler
	},
	{
		name: 'delete a roast batch',
		method: 'DELETE',
		path: `/api/roast-batches/${BATCH_ID}`,
		handler: roastBatch.DELETE as Handler,
		params: { id: BATCH_ID }
	}
];

const ACCOUNTS = {
	signedOut: () => anonymousPrincipal(),
	viewer: () => cookieSessionPrincipal('viewer'),
	intelligenceOnly: () => cookieSessionPrincipal('viewer', { ppiAccess: true }),
	member: () => cookieSessionPrincipal('member'),
	memberWithIntelligence: () => cookieSessionPrincipal('member', { ppiAccess: true }),
	admin: () => cookieSessionPrincipal('admin')
} satisfies Record<string, () => RequestPrincipal>;

function call(route: RouteCase, principal: RequestPrincipal) {
	const url = new URL(`https://app.test${route.path}`);
	// A plain request stand-in: the test environment's Request drops the Origin header, and
	// a browser always sends it on a write.
	const headers = new Map<string, string>(route.method === 'GET' ? [] : [['origin', url.origin]]);
	if (route.body !== undefined) headers.set('content-type', 'application/json');
	const request = {
		method: route.method,
		url: url.href,
		headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
		signal: new AbortController().signal,
		json: async () => route.body,
		formData: async () => route.form?.() ?? new FormData()
	};
	return route.handler({
		request,
		url,
		params: route.params ?? {},
		fetch: vi.fn(),
		locals: { principal }
	} as never);
}

async function refusedBody(response: Response): Promise<string> {
	return ((await response.json()) as { error: string }).error;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	parchment.createParchmentServerClient.mockRejectedValue(new Error('Parchment was asked'));
});

describe.each(ROUTES)('$method $path ($name)', (route) => {
	it('asks a signed-out visitor to sign in', async () => {
		const response = await call(route, ACCOUNTS.signedOut());

		expect(response.status).toBe(401);
		expect(parchment.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		['a free account', ACCOUNTS.viewer],
		['an account with Parchment Intelligence and no Mallard Studio', ACCOUNTS.intelligenceOnly]
	])('refuses %s without asking Parchment', async (_label, account) => {
		const response = await call(route, account());

		expect(response.status).toBe(403);
		expect(await refusedBody(response)).toMatch(/Mallard Studio|Member role required/);
		expect(parchment.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		['a member', ACCOUNTS.member],
		['a member who also has Parchment Intelligence', ACCOUNTS.memberWithIntelligence],
		['an admin', ACCOUNTS.admin]
	])('lets %s through to Parchment', async (_label, account) => {
		const response = await call(route, account());

		expect([401, 403]).not.toContain(response.status);
		expect(parchment.createParchmentServerClient).toHaveBeenCalledTimes(1);
	});
});

describe('roast writes from another site', () => {
	it.each(ROUTES.filter((route) => route.method !== 'GET'))(
		'$method $path stays blocked for a member',
		async (route) => {
			const url = new URL(`https://app.test${route.path}`);
			const headers = new Map<string, string>([['origin', 'https://other.test']]);
			const response = await route.handler({
				request: {
					method: route.method,
					url: url.href,
					headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
					signal: new AbortController().signal,
					json: async () => route.body,
					formData: async () => route.form?.() ?? new FormData()
				},
				url,
				params: route.params ?? {},
				fetch: vi.fn(),
				locals: { principal: ACCOUNTS.member() }
			} as never);

			expect(response.status).toBe(403);
			expect(await refusedBody(response)).toBe('Cross-site session mutation blocked');
			expect(parchment.createParchmentServerClient).not.toHaveBeenCalled();
		}
	);
});
