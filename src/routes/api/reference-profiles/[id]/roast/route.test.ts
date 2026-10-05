import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));
vi.mock('$lib/server/parchmentClient', () => parchmentMocks);

import { POST } from './+server';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const REVISION = 'aaaaaaaa-1111-4000-8000-000000000001';

function event(
	body: unknown,
	{
		role = 'member' as 'viewer' | 'member' | null,
		key = 'idem-1' as string | null,
		id = KEEPER
	} = {}
) {
	const request = new Request(`https://app.test/api/reference-profiles/${id}/roast`, {
		method: 'POST',
		headers: {
			Origin: 'https://app.test',
			'Content-Type': 'application/json',
			...(key ? { 'Idempotency-Key': key } : {})
		},
		body: JSON.stringify(body)
	});
	return {
		request,
		params: { id },
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: role ? cookieSessionPrincipal(role) : { isAuthenticated: false } }
	};
}

describe('POST /api/reference-profiles/[id]/roast', () => {
	beforeEach(() => vi.clearAllMocks());

	it('records the reference as a roast of the chosen coffee, from the file Parchment holds', async () => {
		const importFromReference = vi.fn().mockResolvedValue({
			data: {
				data: {
					roast: { roast_id: 4542, coffee_name: 'Ethiopia Guji Natural', batch_name: 'x' },
					import: {},
					reference: { profileId: KEEPER, revisionId: REVISION, linked: true }
				}
			},
			response: { status: 201 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: { importFromReference }
		});

		const response = await POST(
			event({ coffeeId: 101, revisionId: REVISION, fileContent: 'ignored' }) as never
		);

		expect(response.status).toBe(201);
		expect(importFromReference).toHaveBeenCalledWith(
			{ referenceProfileId: KEEPER, referenceRevisionId: REVISION, coffeeId: 101 },
			{ idempotencyKey: 'idem-1' }
		);
		expect(await response.json()).toEqual({
			data: { roastId: 4542, coffeeName: 'Ethiopia Guji Natural' }
		});
	});

	it('requires an Idempotency-Key, so a retry cannot record the roast twice', async () => {
		const response = await POST(event({ coffeeId: 101, revisionId: REVISION }, { key: null }) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Idempotency-Key is required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		[{ revisionId: REVISION }, 'Choose the coffee this roast was of'],
		[{ coffeeId: '101', revisionId: REVISION }, 'Choose the coffee this roast was of'],
		[{ coffeeId: 0, revisionId: REVISION }, 'Choose the coffee this roast was of'],
		[{ coffeeId: 101 }, 'Invalid saved reference'],
		[{ coffeeId: 101, revisionId: 'latest' }, 'Invalid saved reference']
	])('rejects %j', async (body, error) => {
		const response = await POST(event(body) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('passes on Parchment’s refusal of a reference that is not an uploaded file', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				importFromReference: vi.fn().mockResolvedValue({
					error: {
						error: {
							code: 'reference_not_importable',
							message: 'Only an uploaded Artisan reference can be recorded as a roast'
						}
					},
					response: { status: 400 }
				})
			}
		});

		const response = await POST(event({ coffeeId: 101, revisionId: REVISION }) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Only an uploaded Artisan reference can be recorded as a roast'
		});
	});

	it.each([
		['viewer', 403],
		[null, 401]
	] as const)('refuses a %s before Parchment is asked', async (role, status) => {
		const response = await POST(event({ coffeeId: 101, revisionId: REVISION }, { role }) as never);

		expect(response.status).toBe(status);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});
