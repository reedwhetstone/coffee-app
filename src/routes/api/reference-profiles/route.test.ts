import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({ createParchmentServerClient: vi.fn() }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { GET, POST } from './+server';

function event(request: Request, role: 'viewer' | 'member' = 'member') {
	return {
		request,
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: cookieSessionPrincipal(role) }
	};
}

describe('/api/reference-profiles', () => {
	beforeEach(() => vi.clearAllMocks());

	it('keeps Studio profiles unavailable to Intelligence-only viewers', async () => {
		const response = await GET(
			event(new Request('https://app.test/api/reference-profiles'), 'viewer') as never
		);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Member role required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('server-mediates Artisan bytes without projecting the raw filename as a title', async () => {
		const importProfile = vi.fn().mockResolvedValue({
			data: { data: { id: 'profile-1', title: 'Artisan chat reference' } },
			response: { status: 201 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { import: importProfile }
		});
		const form = new FormData();
		form.set('file', new File(['{"timex":[0]}'], 'private-customer-name.alog'));
		const request = new Request('https://app.test/api/reference-profiles', {
			method: 'POST',
			headers: { Origin: 'https://app.test', 'Idempotency-Key': 'idem-1' },
			body: form
		});

		const response = await POST(event(request) as never);

		expect(response.status).toBe(201);
		expect(importProfile).toHaveBeenCalledWith(
			expect.objectContaining({
				fileName: 'private-customer-name.alog',
				fileContent: '{"timex":[0]}',
				title: 'Artisan reference'
			}),
			'idem-1'
		);
	});

	it('pins historical-roast snapshots to the chart revision', async () => {
		const fromRoast = vi.fn().mockResolvedValue({
			data: { data: { id: 'profile-2' } },
			response: { status: 201 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				chartData: vi.fn().mockResolvedValue({
					data: { data: { metadata: { revision: 'roast-revision-7' } } }
				})
			},
			referenceProfiles: { fromRoast }
		});
		const request = new Request('https://app.test/api/reference-profiles', {
			method: 'POST',
			headers: {
				Origin: 'https://app.test',
				'Content-Type': 'application/json',
				'Idempotency-Key': 'idem-2'
			},
			body: JSON.stringify({ source: 'executed_roast', roastId: 7, title: 'Batch 7 reference' })
		});

		const response = await POST(event(request) as never);

		expect(response.status).toBe(201);
		expect(fromRoast).toHaveBeenCalledWith(
			{ roastId: 7, roastRevision: 'roast-revision-7', title: 'Batch 7 reference' },
			'idem-2'
		);
	});
});
