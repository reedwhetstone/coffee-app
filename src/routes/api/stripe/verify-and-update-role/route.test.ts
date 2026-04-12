import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandleReconcileStripeSession = vi.fn();

vi.mock('$lib/server/billing/reconcile-session', () => ({
	handleReconcileStripeSession: mockHandleReconcileStripeSession
}));

let POST: typeof import('./+server').POST;

const LEGACY_SUCCESSOR_LINK = '</api/stripe/reconcile-session>; rel="successor-version"';
const LEGACY_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

function expectLegacyHeaders(response: Response) {
	expect(response.headers.get('Deprecation')).toBe('true');
	expect(response.headers.get('Link')).toBe(LEGACY_SUCCESSOR_LINK);
	expect(response.headers.get('Sunset')).toBe(LEGACY_SUNSET);
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
});

describe('/api/stripe/verify-and-update-role legacy route', () => {
	it('delegates to the canonical reconciliation handler', async () => {
		const expected = new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		mockHandleReconcileStripeSession.mockResolvedValue(expected);

		const response = await POST({
			url: new URL('https://app.test/api/stripe/verify-and-update-role'),
			request: new Request('https://app.test/api/stripe/verify-and-update-role', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: 'cs_test_123' })
			}),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof POST>>[0]);

		expect(mockHandleReconcileStripeSession).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(URL) })
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expectLegacyHeaders(response);
	});

	it('preserves upstream failures while adding deprecation headers', async () => {
		mockHandleReconcileStripeSession.mockResolvedValue(
			new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json; charset=utf-8' }
			})
		);

		const response = await POST({
			url: new URL('https://app.test/api/stripe/verify-and-update-role'),
			request: new Request('https://app.test/api/stripe/verify-and-update-role', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: 'cs_test_123' })
			}),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof POST>>[0]);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
		expectLegacyHeaders(response);
	});
});
