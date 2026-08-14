import { describe, expect, it } from 'vitest';

import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';
import { guardBrowserBffRequest, relayParchmentResult } from './browserBff';

function makeEvent(
	options: {
		method?: string;
		origin?: string | null;
		contentType?: string | null;
		authorization?: string;
		authenticated?: boolean;
	} = {}
) {
	const headers = new Headers();
	if (options.origin !== null) headers.set('origin', options.origin ?? 'https://app.test');
	if (options.contentType !== null) {
		headers.set('content-type', options.contentType ?? 'application/json; charset=utf-8');
	}
	if (options.authorization) headers.set('authorization', options.authorization);

	const request = new Request('https://app.test/api/billing/example', {
		method: options.method ?? 'POST',
		headers
	});
	if (options.origin !== null) request.headers.set('origin', options.origin ?? 'https://app.test');

	return {
		request,
		url: new URL('https://app.test/api/billing/example'),
		locals: {
			principal:
				options.authenticated === false ? anonymousPrincipal() : cookieSessionPrincipal('member')
		}
	} as never;
}

describe('browser billing BFF boundary', () => {
	it('requires a cookie session and rejects Authorization headers', async () => {
		const anonymous = guardBrowserBffRequest(makeEvent({ authenticated: false }));
		const authorization = guardBrowserBffRequest(
			makeEvent({ authorization: 'Bearer machine-credential' })
		);

		expect(anonymous?.status).toBe(401);
		expect(authorization?.status).toBe(401);
		expect(authorization).not.toBeNull();
		if (!authorization) throw new Error('Expected an Authorization rejection response');
		expect((await authorization.json()).error.code).toBe('session_required');
		expect(authorization.headers.get('cache-control')).toBe('no-store');
	});

	it('requires exact same-origin JSON for body mutations', () => {
		expect(
			guardBrowserBffRequest(makeEvent({ origin: null }), {
				mutation: true,
				jsonBody: true
			})?.status
		).toBe(403);
		expect(
			guardBrowserBffRequest(makeEvent({ origin: 'https://evil.test' }), {
				mutation: true,
				jsonBody: true
			})?.status
		).toBe(403);
		expect(
			guardBrowserBffRequest(makeEvent({ contentType: 'text/plain' }), {
				mutation: true,
				jsonBody: true
			})?.status
		).toBe(415);
		expect(guardBrowserBffRequest(makeEvent(), { mutation: true, jsonBody: true })).toBeNull();
	});

	it('relays Parchment success and error status/body while forcing no-store', async () => {
		const accepted = relayParchmentResult({
			data: { operationId: 'operation-1', status: 'accepted' },
			response: new Response(null, { status: 202 })
		});
		const conflictBody = {
			error: { code: 'lifecycle_conflict', message: 'Conflicting durable operation.' }
		};
		const conflict = relayParchmentResult({
			error: conflictBody,
			response: new Response(null, { status: 409 })
		});

		expect(accepted.status).toBe(202);
		expect(await accepted.json()).toEqual({ operationId: 'operation-1', status: 'accepted' });
		expect(accepted.headers.get('cache-control')).toBe('no-store');
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual(conflictBody);
		expect(conflict.headers.get('cache-control')).toBe('no-store');
	});
});
