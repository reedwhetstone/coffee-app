import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({ createParchmentServerClient: vi.fn() }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { POST } from './+server';

function event(body: unknown) {
	const request = new Request('https://app.test/api/reference-profiles/compare', {
		method: 'POST',
		headers: { Origin: 'https://app.test', 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return {
		request,
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: cookieSessionPrincipal('member') }
	};
}

describe('/api/reference-profiles/compare', () => {
	beforeEach(() => vi.clearAllMocks());

	it('resolves mutable selections to immutable identities before comparing', async () => {
		const compare = vi.fn().mockResolvedValue({
			data: { data: { alignment: 'charge', targetUnit: 'F', series: [], milestones: [] } },
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				chartData: vi.fn().mockResolvedValue({
					data: { data: { metadata: { revision: 'roast-revision-9' } } }
				})
			},
			referenceProfiles: {
				get: vi.fn().mockResolvedValue({
					data: { data: { currentRevisionId: 'reference-revision-2' } }
				}),
				compare
			}
		});

		const response = await POST(
			event({
				left: { kind: 'executed_roast', id: '9' },
				right: { kind: 'reference_profile', id: 'profile-2' },
				targetUnit: 'F'
			}) as never
		);

		expect(response.status).toBe(200);
		expect(compare).toHaveBeenCalledWith({
			left: { type: 'executed_roast', roastId: 9, roastRevision: 'roast-revision-9' },
			right: { type: 'reference_revision', revisionId: 'reference-revision-2' },
			alignment: 'charge',
			targetUnit: 'F',
			targetPoints: 400
		});
	});
});
