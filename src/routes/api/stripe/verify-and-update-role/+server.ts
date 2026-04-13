import type { RequestHandler } from './$types';

import { handleReconcileStripeSession } from '$lib/server/billing/reconcile-session';

const LEGACY_VERIFY_AND_UPDATE_ROLE_HEADERS = {
	Deprecation: 'true',
	Link: '</api/stripe/reconcile-session>; rel="successor-version"',
	Sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
} as const;

function withLegacyVerifyAndUpdateRoleHeaders(headers: HeadersInit = {}): Headers {
	const merged = new Headers(headers);

	for (const [name, value] of Object.entries(LEGACY_VERIFY_AND_UPDATE_ROLE_HEADERS)) {
		merged.set(name, value);
	}

	return merged;
}

// Legacy billing endpoint kept as a compatibility shim for callers that still POST
// completed checkout session IDs to the old role-sync path. Delegate to the
// canonical reconciliation handler so we preserve behavior while signaling the
// successor route explicitly.
export const POST: RequestHandler = async (event) => {
	const response = await handleReconcileStripeSession(event);

	return new Response(response.body, {
		status: response.status,
		headers: withLegacyVerifyAndUpdateRoleHeaders(response.headers)
	});
};
