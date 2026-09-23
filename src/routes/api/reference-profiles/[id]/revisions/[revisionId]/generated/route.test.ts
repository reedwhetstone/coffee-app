import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({ createParchmentServerClient: vi.fn() }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { POST as preview } from '../preview/+server';
import { POST as generate } from './+server';
import { GET as download } from '../export/+server';

const input = {
	title: 'Next batch',
	changes: {
		temperatureAdjustments: [
			{
				kind: 'bean_temperature',
				startMilliseconds: 60_000,
				endMilliseconds: 180_000,
				delta: 5
			}
		]
	}
};

function event(request: Request, role: 'viewer' | 'member' = 'member') {
	return {
		request,
		url: new URL(request.url),
		params: { id: 'parent-1', revisionId: 'revision-2' },
		fetch: vi.fn(),
		locals: { principal: cookieSessionPrincipal(role) }
	};
}

describe('planned reference BFF', () => {
	beforeEach(() => vi.clearAllMocks());

	it('does not expose preview or export to non-members', async () => {
		const previewResponse = await preview(
			event(
				new Request('https://app.test/preview', {
					method: 'POST',
					body: JSON.stringify(input)
				}),
				'viewer'
			) as never
		);
		const exportResponse = await download(
			event(new Request('https://app.test/export'), 'viewer') as never
		);
		expect(previewResponse.status).toBe(403);
		expect(exportResponse.status).toBe(403);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('passes an explicit preview through the session-scoped SDK without saving', async () => {
		const previewSdk = vi.fn().mockResolvedValue({
			data: { data: { parentRevisionId: 'revision-2', exportEligible: true } },
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { preview: previewSdk }
		});
		const request = new Request('https://app.test/preview', {
			method: 'POST',
			body: JSON.stringify(input)
		});
		const requestEvent = event(request);
		const response = await preview(requestEvent as never);
		expect(response.status).toBe(200);
		expect(previewSdk).toHaveBeenCalledWith('parent-1', 'revision-2', input);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(requestEvent, {
			mode: 'session',
			signal: request.signal
		});
	});

	it('requires an idempotency key to save and forwards the immutable parent revision', async () => {
		const generateSdk = vi.fn().mockResolvedValue({
			data: { data: { id: 'generated-1', currentRevisionId: 'generated-revision' } },
			response: { status: 201 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { generate: generateSdk }
		});
		const missingKey = await generate(
			event(
				new Request('https://app.test/generated', {
					method: 'POST',
					body: JSON.stringify(input)
				})
			) as never
		);
		expect(missingKey.status).toBe(400);
		expect(generateSdk).not.toHaveBeenCalled();
		const response = await generate(
			event(
				new Request('https://app.test/generated', {
					method: 'POST',
					headers: { 'Idempotency-Key': 'stable-key' },
					body: JSON.stringify(input)
				})
			) as never
		);
		expect(response.status).toBe(201);
		expect(generateSdk).toHaveBeenCalledWith('parent-1', 'revision-2', input, 'stable-key');
	});

	it('returns only the saved generated file as a private attachment', async () => {
		const exportSdk = vi.fn().mockResolvedValue({
			data: {
				data: { fileContent: "{'title': 'Purveyors plan'}", fileName: 'Purveyors-reference.alog' }
			},
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { exportGenerated: exportSdk }
		});
		const response = await download(event(new Request('https://app.test/export')) as never);
		expect(exportSdk).toHaveBeenCalledWith('parent-1', 'revision-2');
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="Purveyors-reference.alog"'
		);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.text()).toBe("{'title': 'Purveyors plan'}");
	});
});
