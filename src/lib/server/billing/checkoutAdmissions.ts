import { env } from '$env/dynamic/private';
import { getAccountDeletionProviderCredential } from '$lib/server/accountDeletionProvider';
import type { ParchmentClient } from '@purveyors/sdk';
import type { RequestEvent } from '@sveltejs/kit';
import { createHash } from 'node:crypto';

import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

export const CHECKOUT_ADMISSION_METADATA = {
	ownerId: 'supabase_user_id',
	admissionId: 'parchment_admission_id',
	requestId: 'checkout_request_id',
	purchaseFingerprint: 'checkout_purchase_fingerprint'
} as const;

export interface CheckoutAdmissionContext {
	ownerId: string;
	admissionId: string;
	requestId?: string;
	stripeSessionId: string;
}

export interface CheckoutAdmissionMetadataValues {
	ownerId: string;
	admissionId: string;
	requestId: string;
	purchaseFingerprint: string;
}

export interface PublishedCheckoutReplaySession {
	client_reference_id?: string | null;
	client_secret?: string | null;
	status?: string | null;
	metadata?: Record<string, string> | null;
}

export interface PublishedCheckoutReplayExpectation {
	ownerId: string;
	admissionId: string;
	requestId: string;
	purchaseFingerprint: string;
}

export interface CheckoutAdmission {
	admissionId: string;
	status: 'creating' | 'published' | 'closed';
	stripeSessionId: string | null;
}

export class CheckoutAdmissionError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly payload: unknown
	) {
		super(message);
		this.name = 'CheckoutAdmissionError';
	}
}

export function resolveCheckoutAdmissionRollout(
	source: Record<string, string | undefined> & {
		PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED?: string;
		PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED?: string;
	}
): { admissionsEnabled: boolean; legacyDrainEnabled: boolean } {
	const admissionsEnabled =
		source.PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED?.trim().toLowerCase() === 'true';
	const legacyDrainEnabled =
		source.PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED?.trim().toLowerCase() === 'true';
	if (legacyDrainEnabled && !admissionsEnabled) {
		throw new ParchmentConfigError(
			'PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED=true requires PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED=true.'
		);
	}
	return { admissionsEnabled, legacyDrainEnabled };
}

export function checkoutAdmissionsEnabled(): boolean {
	return resolveCheckoutAdmissionRollout(env).admissionsEnabled;
}

export function legacyCheckoutDrainEnabled(): boolean {
	return resolveCheckoutAdmissionRollout(env).legacyDrainEnabled;
}

export function normalizeCheckoutStripePriceIds(stripePriceIds: string[]): string[] {
	return Array.from(
		new Set(stripePriceIds.map((stripePriceId) => stripePriceId.trim()).filter(Boolean))
	).sort();
}

export function checkoutPurchaseFingerprint(stripePriceIds: string[]): string {
	return createHash('sha256')
		.update(normalizeCheckoutStripePriceIds(stripePriceIds).join('\n'))
		.digest('hex');
}

export function buildCheckoutAdmissionMetadata(
	values: CheckoutAdmissionMetadataValues
): Record<string, string> {
	return {
		[CHECKOUT_ADMISSION_METADATA.ownerId]: values.ownerId,
		[CHECKOUT_ADMISSION_METADATA.admissionId]: values.admissionId,
		[CHECKOUT_ADMISSION_METADATA.requestId]: values.requestId,
		[CHECKOUT_ADMISSION_METADATA.purchaseFingerprint]: values.purchaseFingerprint
	};
}

export function verifyPublishedCheckoutReplay(
	session: PublishedCheckoutReplaySession,
	expected: PublishedCheckoutReplayExpectation
): boolean {
	const metadata = session.metadata;
	return (
		session.status === 'open' &&
		typeof session.client_secret === 'string' &&
		session.client_secret.length > 0 &&
		session.client_reference_id === expected.ownerId &&
		metadata?.[CHECKOUT_ADMISSION_METADATA.ownerId] === expected.ownerId &&
		metadata?.[CHECKOUT_ADMISSION_METADATA.admissionId] === expected.admissionId &&
		metadata?.[CHECKOUT_ADMISSION_METADATA.requestId] === expected.requestId &&
		metadata?.[CHECKOUT_ADMISSION_METADATA.purchaseFingerprint] === expected.purchaseFingerprint
	);
}

function upstreamMessage(error: unknown, fallback: string): string {
	if (!error || typeof error !== 'object') return fallback;
	const candidate = error as {
		error?: { message?: unknown };
		message?: unknown;
	};
	if (typeof candidate.error?.message === 'string') return candidate.error.message;
	if (typeof candidate.message === 'string') return candidate.message;
	return fallback;
}

function unwrap<T>(result: { data?: T; error?: unknown; response: Response }, fallback: string): T {
	if (result.error || !result.data || !result.response.ok) {
		throw new CheckoutAdmissionError(
			upstreamMessage(result.error, fallback),
			result.response.status || 503,
			result.error
		);
	}
	return result.data;
}

async function sessionClient(event: RequestEvent): Promise<ParchmentClient> {
	return createParchmentServerClient(event, { mode: 'session', preferHandling: 'inherit' });
}

async function providerClient(event: RequestEvent): Promise<ParchmentClient> {
	return createParchmentServerClient(event, { mode: 'anonymous', preferHandling: 'inherit' });
}

const providerHeaders = () => ({
	'x-account-deletion-provider-credential': getAccountDeletionProviderCredential()
});

export async function acquireCheckoutAdmission(
	event: RequestEvent,
	requestId: string
): Promise<CheckoutAdmission> {
	const client = await sessionClient(event);
	return unwrap(
		await client.checkoutAdmissions.acquire({ requestId }),
		'Checkout is temporarily unavailable'
	);
}

export async function publishCheckoutAdmission(
	event: RequestEvent,
	admissionId: string,
	stripeSessionId: string
): Promise<CheckoutAdmission> {
	const client = await sessionClient(event);
	return unwrap(
		await client.checkoutAdmissions.publish(admissionId, { stripeSessionId }, providerHeaders()),
		'Checkout session publication failed'
	);
}

export async function abandonCheckoutAdmission(
	event: RequestEvent,
	admissionId: string
): Promise<CheckoutAdmission> {
	const client = await sessionClient(event);
	return unwrap(
		await client.raw.POST('/v1/checkout-admissions/{admissionId}/abandon', {
			params: {
				path: { admissionId },
				header: providerHeaders()
			},
			body: { evidence: 'stripe_creation_definitively_absent' }
		}),
		'Checkout admission abandonment failed'
	);
}

export async function checkoutProviderIsEligible(
	event: RequestEvent,
	context: CheckoutAdmissionContext
): Promise<boolean> {
	const client = await providerClient(event);
	const result = await client.raw.POST('/v1/checkout-admissions/provider-eligibility', {
		params: { header: providerHeaders() },
		body: {
			ownerId: context.ownerId,
			admissionId: context.admissionId,
			stripeSessionId: context.stripeSessionId
		}
	});
	return unwrap(result, 'Checkout provider eligibility is unavailable').eligible;
}

export async function terminalizeExpiredCheckoutAdmission(
	event: RequestEvent,
	context: CheckoutAdmissionContext
): Promise<CheckoutAdmission> {
	const client = await providerClient(event);
	return unwrap(
		await client.raw.POST('/v1/checkout-admissions/provider-terminalization', {
			params: { header: providerHeaders() },
			body: {
				ownerId: context.ownerId,
				admissionId: context.admissionId,
				stripeSessionId: context.stripeSessionId,
				terminalStatus: 'expired'
			}
		}),
		'Checkout admission terminalization failed'
	);
}

export function checkoutAdmissionContextFromMetadata(
	metadata: Record<string, string> | null | undefined,
	stripeSessionId: string
): CheckoutAdmissionContext | null {
	const ownerId = metadata?.[CHECKOUT_ADMISSION_METADATA.ownerId];
	const admissionId = metadata?.[CHECKOUT_ADMISSION_METADATA.admissionId];
	const requestId = metadata?.[CHECKOUT_ADMISSION_METADATA.requestId];
	const purchaseFingerprint = metadata?.[CHECKOUT_ADMISSION_METADATA.purchaseFingerprint];
	const hasManagedAdmissionMetadata = Boolean(
		ownerId || admissionId || requestId || purchaseFingerprint
	);
	if (hasManagedAdmissionMetadata && (!ownerId || !admissionId)) {
		throw new Error('Managed checkout session is missing Checkout admission metadata');
	}
	if (!ownerId || !admissionId) return null;
	return {
		ownerId,
		admissionId,
		requestId,
		stripeSessionId
	};
}
