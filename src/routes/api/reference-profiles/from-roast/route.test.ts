import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({ createParchmentServerClient: vi.fn() }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { POST as keep } from './+server';
import { GET as candidates } from './candidates/+server';
import { POST as preview } from './preview/+server';

const roast = { roastId: 4531, roastRevision: '2026-10-01T12:00:00Z' };
const plan = {
	title: 'Wush Wush plan',
	changes: {
		temperatureAdjustments: [
			{ kind: 'bean_temperature', startMilliseconds: 30_000, endMilliseconds: 330_000, delta: 5 }
		]
	}
};
const noFile = {
	error: {
		code: 'roast_artisan_source_unavailable',
		message: 'This roast has no Artisan file on record',
		reason: 'artisan_file_not_retained'
	}
};

function event(request: Request, role: 'viewer' | 'member' = 'member', ppiAccess = false) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		fetch: vi.fn(),
		locals: { principal: { ...cookieSessionPrincipal(role), ppiAccess } }
	};
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
	new Request(`https://app.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

const calls = {
	candidates: (role: 'viewer' | 'member', ppiAccess = false) =>
		candidates(
			event(
				new Request('https://app.test/api/reference-profiles/from-roast/candidates'),
				role,
				ppiAccess
			) as never
		),
	preview: (role: 'viewer' | 'member', ppiAccess = false) =>
		preview(
			event(
				post('/api/reference-profiles/from-roast/preview', { ...roast, ...plan }),
				role,
				ppiAccess
			) as never
		),
	keep: (role: 'viewer' | 'member', ppiAccess = false) =>
		keep(
			event(
				post('/api/reference-profiles/from-roast', roast, { 'Idempotency-Key': 'key-1' }),
				role,
				ppiAccess
			) as never
		)
};

describe('/api/reference-profiles/from-roast', () => {
	beforeEach(() => vi.clearAllMocks());

	describe.each(Object.entries(calls))('%s', (_name, call) => {
		it.each([
			{ account: 'a viewer', ppiAccess: false },
			{ account: 'a Parchment Intelligence-only account', ppiAccess: true }
		])('refuses $account before Parchment is called', async ({ ppiAccess }) => {
			const response = await call('viewer', ppiAccess);

			expect(response.status).toBe(403);
			expect(await response.json()).toEqual({ error: 'Member role required' });
			expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		});
	});

	it('lists the roasts that can be planned from, with the count that cannot', async () => {
		const data = {
			data: { roasts: [], eligibleCount: 3, totalRoastCount: 58, ineligibleRoastCount: 55 }
		};
		const roastCandidates = vi.fn().mockResolvedValue({ data, response: { status: 200 } });
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { roastCandidates }
		});
		const request = new Request('https://app.test/api/reference-profiles/from-roast/candidates');
		const requestEvent = event(request);

		const response = await candidates(requestEvent as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(data);
		expect(roastCandidates).toHaveBeenCalledWith({ limit: 50 });
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(requestEvent, {
			mode: 'session',
			signal: request.signal
		});
	});

	it('previews through the session-scoped SDK without saving anything', async () => {
		const previewFromRoast = vi.fn().mockResolvedValue({
			data: { data: { parentRevisionId: 'revision-1', parentSaved: false } },
			response: { status: 200 }
		});
		const fromRoast = vi.fn();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { previewFromRoast, fromRoast }
		});

		const response = await calls.preview('member');

		expect(response.status).toBe(200);
		expect(previewFromRoast).toHaveBeenCalledWith({ ...plan, ...roast });
		expect(fromRoast).not.toHaveBeenCalled();
	});

	it.each([
		['no roast', plan],
		['a roast ID that is not a whole positive number', { ...plan, roastId: 0, roastRevision: 'r' }],
		['a roast ID sent as text', { ...plan, roastId: '4531', roastRevision: 'r' }],
		['no revision', { ...plan, roastId: 4531, roastRevision: ' ' }],
		['no change', { ...roast, title: 'Plan', changes: { temperatureAdjustments: [] } }],
		['no title', { ...roast, changes: plan.changes }]
	])('turns down a preview with %s before Parchment is called', async (_case, body) => {
		const response = await preview(
			event(post('/api/reference-profiles/from-roast/preview', body)) as never
		);

		expect(response.status).toBe(400);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('passes on why a roast cannot be planned from', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: {
				previewFromRoast: vi.fn().mockResolvedValue({ error: noFile, response: { status: 400 } }),
				fromRoast: vi.fn().mockResolvedValue({ error: noFile, response: { status: 400 } })
			}
		});
		const expected = {
			error: 'This roast has no Artisan file on record',
			code: 'roast_artisan_source_unavailable',
			reason: 'artisan_file_not_retained'
		};

		const previewed = await calls.preview('member');
		expect(previewed.status).toBe(400);
		expect(await previewed.json()).toEqual(expected);

		const kept = await calls.keep('member');
		expect(kept.status).toBe(400);
		expect(await kept.json()).toEqual(expected);
	});

	it('does not pass on a reason it does not know', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: {
				previewFromRoast: vi.fn().mockResolvedValue({
					error: { error: { code: 'conflict', message: 'The roast changed', reason: 'other' } },
					response: { status: 409 }
				})
			}
		});

		const response = await calls.preview('member');

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'The roast changed', code: 'conflict' });
	});

	it('keeps the roast’s Artisan file, never a chart snapshot, and needs an idempotency key', async () => {
		const fromRoast = vi.fn().mockResolvedValue({
			data: { data: { id: 'reference-1', currentRevisionId: 'revision-1' } },
			response: { status: 201 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { fromRoast }
		});

		const missingKey = await keep(
			event(post('/api/reference-profiles/from-roast', roast)) as never
		);
		expect(missingKey.status).toBe(400);
		expect(fromRoast).not.toHaveBeenCalled();

		const response = await keep(
			event(
				// The page names the reference; the basis is not the caller's to choose.
				post(
					'/api/reference-profiles/from-roast',
					{ ...roast, basis: 'chart_snapshot', title: '  Wush Wush, roasted Oct 1, 2026 ' },
					{ 'Idempotency-Key': 'key-1' }
				)
			) as never
		);

		expect(response.status).toBe(201);
		expect(fromRoast).toHaveBeenCalledWith(
			{ ...roast, basis: 'artisan_source', title: 'Wush Wush, roasted Oct 1, 2026' },
			'key-1'
		);
	});

	it('returns the reference already kept from that roast as a success', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: {
				fromRoast: vi.fn().mockResolvedValue({
					data: { data: { id: 'reference-1', currentRevisionId: 'revision-1' } },
					response: { status: 200 }
				})
			}
		});

		const response = await calls.keep('member');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: { id: 'reference-1', currentRevisionId: 'revision-1' }
		});
	});
});
