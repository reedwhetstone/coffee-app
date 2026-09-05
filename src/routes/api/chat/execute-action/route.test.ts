import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	anonymousPrincipal,
	apiKeyPrincipal,
	cookieSessionPrincipal
} from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		execute: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { POST } from './+server';

const requestBody = {
	executionId: 'message-1:tool-1',
	actionType: 'add_bean_to_inventory',
	fields: {
		catalog_id: 123,
		purchased_qty_lbs: 10,
		cost_per_lb: 4.25,
		purchase_date: '2026-06-07',
		source_filter: 'Burman',
		_bean_sources: { 'Burman: Ethiopia': '123' }
	}
} as const;

const otherActionBodies = [
	{
		executionId: 'message-2:tool-2',
		actionType: 'update_bean',
		fields: { bean_id: 42, notes: null, stocked: 'false' }
	},
	{
		executionId: 'message-3:tool-3',
		actionType: 'create_roast_session',
		fields: { coffee_id: 42, coffee_name: 'Ethiopia', batch_name: 'Batch 1', oz_in: 16 }
	},
	{
		executionId: 'message-4:tool-4',
		actionType: 'update_roast_notes',
		fields: { roast_id: 77, roast_notes: null, roast_targets: 'City+' }
	},
	{
		executionId: 'message-5:tool-5',
		actionType: 'record_sale',
		fields: {
			green_coffee_inv_id: 42,
			batch_name: 'Batch 1',
			oz_sold: 12,
			price: 18,
			buyer: 'Test Buyer'
		}
	}
] as const;

function makeEvent(
	body: BodyInit = JSON.stringify(requestBody),
	options: {
		origin?: string;
		contentType?: string;
		principal?: unknown;
		authorization?: string;
	} = {}
) {
	const origin = options.origin ?? 'https://app.test';
	const request = new Request('https://app.test/api/chat/execute-action', {
		method: 'POST',
		body
	});
	request.headers.set('origin', origin);
	request.headers.set('content-type', options.contentType ?? 'application/json');
	if (options.authorization) request.headers.set('authorization', options.authorization);

	return {
		request,
		url: new URL('https://app.test/api/chat/execute-action'),
		locals: { principal: options.principal ?? cookieSessionPrincipal('viewer') },
		fetch: vi.fn()
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/chat/execute-action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			confirmedActions: { execute: mocks.execute }
		});
		mocks.execute.mockResolvedValue({
			data: {
				data: {
					success: true,
					id: 42,
					message: 'Bean added to inventory',
					replayed: false
				}
			},
			response: new Response(null, { status: 200 })
		});
	});

	it('forwards the exact confirmed payload once through the session SDK', async () => {
		const event = makeEvent();
		const response = await POST(event);

		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.execute).toHaveBeenCalledOnce();
		expect(mocks.execute).toHaveBeenCalledWith(requestBody);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			success: true,
			id: 42,
			message: 'Bean added to inventory',
			replayed: false
		});
	});

	it.each(otherActionBodies)(
		'forwards the $actionType proposal without translating its payload',
		async (body) => {
			await POST(makeEvent(JSON.stringify(body)));

			expect(mocks.execute).toHaveBeenCalledOnce();
			expect(mocks.execute).toHaveBeenCalledWith(body);
		}
	);

	it('preserves Parchment replay results without another route-level write', async () => {
		mocks.execute
			.mockResolvedValueOnce({
				data: {
					data: { success: true, id: 42, message: 'Bean added to inventory', replayed: false }
				},
				response: new Response(null, { status: 200 })
			})
			.mockResolvedValueOnce({
				data: {
					data: { success: true, id: 42, message: 'Bean added to inventory', replayed: true }
				},
				response: new Response(null, { status: 200 })
			});

		await POST(makeEvent());
		const response = await POST(makeEvent());

		expect(mocks.execute).toHaveBeenCalledTimes(2);
		expect(mocks.execute).toHaveBeenNthCalledWith(1, requestBody);
		expect(mocks.execute).toHaveBeenNthCalledWith(2, requestBody);
		expect(await response.json()).toEqual({
			success: true,
			id: 42,
			message: 'Bean added to inventory',
			replayed: true
		});
	});

	it('preserves payload-conflict status and the legacy browser error shape', async () => {
		mocks.execute.mockResolvedValue({
			error: {
				error: {
					code: 'execution_payload_conflict',
					message: 'Execution ID conflicts with a different action payload'
				}
			},
			response: new Response(null, { status: 409 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Execution ID conflicts with a different action payload'
		});
	});

	it('preserves Parchment entitlement denials and the legacy browser error shape', async () => {
		mocks.execute.mockResolvedValue({
			error: {
				error: {
					code: 'confirmed_action_forbidden',
					message: 'Confirmed action execution requires an active member account'
				}
			},
			response: new Response(null, { status: 403 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Confirmed action execution requires an active member account'
		});
	});

	it.each([
		['anonymous', { principal: anonymousPrincipal() }, 401],
		['API key', { principal: apiKeyPrincipal() }, 401],
		['Authorization header', { authorization: 'Bearer external-token' }, 401],
		['cross-site origin', { origin: 'https://evil.test' }, 403],
		['non-JSON body', { contentType: 'text/plain' }, 415]
	] as const)('blocks %s before creating an SDK client', async (_label, options, status) => {
		const response = await POST(makeEvent(undefined, options));

		expect(response.status).toBe(status);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		['anonymous', { principal: anonymousPrincipal() }, 'A browser session is required.'],
		['API key', { principal: apiKeyPrincipal() }, 'A browser session is required.'],
		[
			'Authorization header',
			{ authorization: 'Bearer external-token' },
			'Authorization headers are not accepted for browser requests.'
		],
		['cross-site origin', { origin: 'https://evil.test' }, 'Cross-site mutations are blocked.'],
		['non-JSON body', { contentType: 'text/plain' }, 'A JSON request is required.']
	] as const)('preserves the legacy flat error shape for %s', async (_label, options, error) => {
		const response = await POST(makeEvent(undefined, options));

		expect(await response.json()).toEqual({ error });
	});

	it.each(['{', 'null', '[]'])(
		'rejects malformed transport input before Parchment: %s',
		async (body) => {
			const response = await POST(makeEvent(body));

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Invalid action request' });
			expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
		}
	);

	it('returns a non-cacheable service error when Parchment is unconfigured', async () => {
		mocks.createParchmentServerClient.mockRejectedValue(
			new mocks.ParchmentConfigError('missing base URL')
		);

		const response = await POST(makeEvent());

		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			error: 'Action execution is temporarily unavailable'
		});
	});
});
