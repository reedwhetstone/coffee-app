import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	replaceArtisanImport: vi.fn(),
	isTrustedMutationRequest: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

vi.mock('$lib/server/principal', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/principal')>()),
	isTrustedMutationRequest: mocks.isTrustedMutationRequest
}));

import { POST } from './+server';

function makeEvent(
	options: {
		roastId?: string;
		fileName?: string;
		ifMatch?: string;
		authenticated?: boolean;
	} = {}
) {
	const formData = new FormData();
	formData.append('roastId', options.roastId ?? '41');
	formData.append(
		'file',
		new File(['{"roast":true}'], options.fileName ?? 'sample.alog.json', {
			type: 'application/json'
		})
	);
	const headers = new Headers();
	if (options.ifMatch) headers.set('If-Match', options.ifMatch);
	const request = new Request('https://app.test/api/artisan-import', {
		method: 'POST',
		headers,
		body: formData
	});
	return {
		request,
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: {
			principal:
				options.authenticated === false ? anonymousPrincipal() : cookieSessionPrincipal('member')
		}
	};
}

describe('/api/artisan-import Parchment adapter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isTrustedMutationRequest.mockReturnValue(true);
		mocks.createParchmentServerClient.mockResolvedValue({
			roasts: { replaceArtisanImport: mocks.replaceArtisanImport }
		});
	});

	it('forwards the file and optimistic concurrency, preserving the legacy response', async () => {
		mocks.replaceArtisanImport.mockResolvedValue({
			data: {
				data: {
					roast: {
						charge_time: 0,
						tp_time: 75,
						fc_start_time: 360,
						fc_end_time: null,
						drop_time: 540,
						total_roast_time: 540,
						temperature_unit: 'F'
					},
					import: {
						fileName: 'sample.alog.json',
						temperaturePoints: 120,
						milestoneEvents: 4,
						controlEvents: 3
					}
				}
			},
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		const event = makeEvent({ ifMatch: '2026-09-01T18:00:00Z' });

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mocks.replaceArtisanImport).toHaveBeenCalledWith(
			41,
			expect.objectContaining({
				fileName: 'sample.alog.json',
				fileContent: '{"roast":true}',
				fileSize: 14
			}),
			{ ifMatch: '2026-09-01T18:00:00Z' }
		);
		expect(await response.json()).toMatchObject({
			success: true,
			total_time: 540,
			temperature_unit: 'F',
			milestone_events: 4,
			control_events: 3,
			roast_events: 7
		});
	});

	it('rejects malformed roast IDs before constructing a client', async () => {
		const response = await POST(makeEvent({ roastId: '41abc' }) as never);

		expect(response.status).toBe(400);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('rejects unauthenticated and cross-site callers before reading the file', async () => {
		const anonymous = await POST(makeEvent({ authenticated: false }) as never);
		mocks.isTrustedMutationRequest.mockReturnValue(false);
		const crossSiteEvent = makeEvent();
		const crossSite = await POST(crossSiteEvent as never);

		expect(anonymous.status).toBe(401);
		expect(crossSite.status).toBe(403);
		expect(await crossSite.json()).toEqual({ error: 'Cross-site session mutation blocked' });
		expect(mocks.isTrustedMutationRequest).toHaveBeenCalledWith(
			crossSiteEvent,
			crossSiteEvent.locals.principal
		);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});
