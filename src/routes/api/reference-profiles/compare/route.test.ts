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
		const chart = vi.fn().mockResolvedValue({
			data: {
				data: {
					chart: {
						chargeTimeMilliseconds: 10_000,
						events: [
							{ name: 'charge', category: 'milestone', timeMilliseconds: 10_000 },
							{ name: 'drop', category: 'milestone', timeMilliseconds: 610_000 }
						]
					}
				}
			}
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				chartData: vi.fn().mockResolvedValue({
					data: {
						data: {
							metadata: { revision: 'roast-revision-9', charge_time_ms: 30_000 },
							events: [
								{ name: 'Charge', category: 'milestone', time_milliseconds: 30_000 },
								{ name: 'FC_Start', category: 'milestone', time_milliseconds: 528_000 },
								{ name: 'fan', category: 'control', time_milliseconds: 60_000 },
								{ name: 'drop', category: 'milestone', time_milliseconds: 648_000 }
							]
						}
					}
				})
			},
			referenceProfiles: {
				get: vi.fn().mockResolvedValue({
					data: { data: { currentRevisionId: 'reference-revision-2' } }
				}),
				chart,
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
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			signal: expect.any(AbortSignal)
		});
		expect(compare).toHaveBeenCalledWith({
			left: { type: 'executed_roast', roastId: 9, roastRevision: 'roast-revision-9' },
			right: { type: 'reference_revision', revisionId: 'reference-revision-2' },
			alignment: 'charge',
			targetUnit: 'F',
			targetPoints: 400
		});
		// Each side's own milestones, timed from its charge, so the page can name one that
		// only the other side recorded.
		expect(chart).toHaveBeenCalledWith('profile-2', 'reference-revision-2');
		expect((await response.json()).sideMilestones).toEqual({
			left: [
				{ name: 'charge', milliseconds: 0 },
				{ name: 'fc_start', milliseconds: 498_000 },
				{ name: 'drop', milliseconds: 618_000 }
			],
			right: [
				{ name: 'charge', milliseconds: 0 },
				{ name: 'drop', milliseconds: 600_000 }
			]
		});
	});

	it("still compares when a saved reference's milestones cannot be read", async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: { chartData: vi.fn() },
			referenceProfiles: {
				get: vi.fn().mockResolvedValue({ data: { data: { currentRevisionId: 'revision-1' } } }),
				chart: vi.fn().mockRejectedValue(new Error('unavailable')),
				compare: vi.fn().mockResolvedValue({
					data: { data: { alignment: 'charge', targetUnit: 'F', series: [], milestones: [] } },
					response: { status: 200 }
				})
			}
		});

		const response = await POST(
			event({
				left: { kind: 'reference_profile', id: 'profile-1' },
				right: { kind: 'reference_profile', id: 'profile-2' }
			}) as never
		);

		expect(response.status).toBe(200);
		expect((await response.json()).sideMilestones).toEqual({ left: null, right: null });
	});

	it('rejects non-object JSON before touching the downstream client', async () => {
		const response = await POST(event(null) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid comparison request' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});
