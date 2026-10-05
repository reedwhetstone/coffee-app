import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('$lib/server/parchmentClient', () => ({ createParchmentServerClient: mocks.create }));

import { GET as candidates } from './candidates/+server';
import { POST as preview } from './preview/+server';
import { POST as fromRoast } from './+server';
import { GET as chart } from './chart/[id]/+server';
import { GET as profile } from '../[id]/+server';

function event(path: string, method = 'GET', body?: unknown, role: 'viewer' | 'member' = 'member') {
	const request = new Request(`https://app.test${path}`, {
		method,
		headers:
			method === 'POST'
				? { 'Content-Type': 'application/json', 'Idempotency-Key': 'plan-key' }
				: {},
		body: body ? JSON.stringify(body) : undefined
	});
	return {
		request,
		url: new URL(request.url),
		params: { id: '4531' },
		locals: { principal: cookieSessionPrincipal(role) }
	};
}
const input = {
	title: 'Next-batch plan',
	changes: {
		temperatureAdjustments: [
			{ kind: 'bean_temperature', startMilliseconds: 0, endMilliseconds: 300000, delta: 5 }
		]
	}
};

describe('from-roast planning BFF', () => {
	beforeEach(() => vi.clearAllMocks());
	it.each([
		[
			'candidates',
			() =>
				candidates(
					event(
						'/api/reference-profiles/from-roast/candidates',
						'GET',
						undefined,
						'viewer'
					) as never
				)
		],
		[
			'preview',
			() =>
				preview(
					event(
						'/api/reference-profiles/from-roast/preview',
						'POST',
						{ ...input, roastId: 4531, roastRevision: 'rev' },
						'viewer'
					) as never
				)
		],
		[
			'save reference',
			() =>
				fromRoast(
					event(
						'/api/reference-profiles/from-roast',
						'POST',
						{ roastId: 4531, roastRevision: 'rev' },
						'viewer'
					) as never
				)
		],
		[
			'roast chart',
			() =>
				chart(
					event(
						'/api/reference-profiles/from-roast/chart/4531',
						'GET',
						undefined,
						'viewer'
					) as never
				)
		],
		[
			'saved plan',
			() => profile(event('/api/reference-profiles/4531', 'GET', undefined, 'viewer') as never)
		]
	])('requires member role for %s', async (_label, run) => {
		const result = await run();
		expect(result.status).toBe(403);
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('calls the SDK candidate and read-only preview methods', async () => {
		const roastCandidates = vi
			.fn()
			.mockResolvedValue({ data: { data: { roasts: [], ineligibleRoastCount: 6 } } });
		const previewFromRoast = vi
			.fn()
			.mockResolvedValue({ data: { data: { title: 'Next-batch plan' } } });
		mocks.create.mockResolvedValue({ referenceProfiles: { roastCandidates, previewFromRoast } });
		expect(
			(await candidates(event('/api/reference-profiles/from-roast/candidates') as never)).status
		).toBe(200);
		expect(roastCandidates).toHaveBeenCalledWith({ limit: 100 });
		const result = await preview(
			event('/api/reference-profiles/from-roast/preview', 'POST', {
				...input,
				roastId: 4531,
				roastRevision: 'rev'
			}) as never
		);
		expect(result.status).toBe(200);
		expect(previewFromRoast).toHaveBeenCalledWith({
			...input,
			roastId: 4531,
			roastRevision: 'rev'
		});
	});

	it('uses artisan_source and preserves the no-file reason', async () => {
		const saved = vi
			.fn()
			.mockResolvedValueOnce({
				error: {
					error: {
						code: 'roast_artisan_source_unavailable',
						message: 'No file',
						reason: 'artisan_file_not_retained'
					}
				},
				response: { status: 400 }
			})
			.mockResolvedValueOnce({ data: { data: { id: 'reference-id' } }, response: { status: 201 } });
		mocks.create.mockResolvedValue({ referenceProfiles: { fromRoast: saved } });
		const request = () =>
			event('/api/reference-profiles/from-roast', 'POST', {
				roastId: 4531,
				roastRevision: 'rev'
			}) as never;
		const failed = await fromRoast(request());
		expect(await failed.json()).toMatchObject({
			code: 'roast_artisan_source_unavailable',
			reason: 'artisan_file_not_retained'
		});
		const success = await fromRoast(request());
		expect(success.status).toBe(201);
		expect(saved).toHaveBeenCalledWith(
			{ roastId: 4531, roastRevision: 'rev', basis: 'artisan_source' },
			'plan-key'
		);
	});
});
