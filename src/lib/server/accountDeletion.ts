import { createAdminClient } from '$lib/supabase-admin';
import { getStripe } from '$lib/services/stripe';
import { ACCOUNT_DELETION_CONFIRMATION } from '$lib/accountDeletion';
export { getAccountDeletionProviderCredential } from '$lib/server/accountDeletionProvider';
import type { User } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

export { ACCOUNT_DELETION_CONFIRMATION };
export const RECENT_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000;
export const ACCOUNT_DELETION_RETRY_COOKIE = 'account_deletion_operation';
export const ACCOUNT_DELETION_RETRY_MAX_AGE_SECONDS = 24 * 60 * 60;

export class AccountDeletionProviderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AccountDeletionProviderError';
	}
}

export function hasRecentSignIn(user: Pick<User, 'last_sign_in_at'>, now = Date.now()): boolean {
	if (!user.last_sign_in_at) return false;
	const signedInAt = Date.parse(user.last_sign_in_at);
	const age = now - signedInAt;
	return Number.isFinite(signedInAt) && age >= 0 && age <= RECENT_SIGN_IN_MAX_AGE_MS;
}

function retrySignature(
	operationId: string,
	issuedAt: number,
	userId: string,
	credential: string
): Buffer {
	return createHmac('sha256', credential).update(`${userId}:${operationId}:${issuedAt}`).digest();
}

export function createAccountDeletionRetryToken(
	operationId: string,
	userId: string,
	credential: string,
	now = Date.now()
): string {
	const signature = retrySignature(operationId, now, userId, credential).toString('base64url');
	return `${operationId}.${now}.${signature}`;
}

export function readAccountDeletionRetryOperation(
	token: string | undefined,
	userId: string,
	credential: string,
	now = Date.now()
): string | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [operationId, encodedIssuedAt, encodedSignature] = parts;
	const issuedAt = Number(encodedIssuedAt);
	const age = now - issuedAt;
	if (
		!operationId ||
		!Number.isSafeInteger(issuedAt) ||
		age < 0 ||
		age > ACCOUNT_DELETION_RETRY_MAX_AGE_SECONDS * 1000
	) {
		return null;
	}

	let received: Buffer;
	try {
		received = Buffer.from(encodedSignature, 'base64url');
	} catch {
		return null;
	}

	const expected = retrySignature(operationId, issuedAt, userId, credential);
	if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
	return operationId;
}

/**
 * Read every known Stripe identity before Parchment quiesces and later deletes
 * owner rows. The local mapping is the read-after-write source of truth, while
 * the metadata search recovers older Stripe customers that are no longer in the
 * mapping table. A database or Stripe failure is not the same as no customer:
 * failing closed here keeps provider finalization unpublished and the account
 * retryable.
 */
export async function captureStripeCustomerIds(userId: string): Promise<string[]> {
	const { data, error } = await createAdminClient()
		.from('stripe_customers')
		.select('customer_id')
		.eq('user_id', userId);

	if (error) {
		throw new AccountDeletionProviderError('Unable to read the Stripe customer mapping');
	}

	const customerIds = new Set(
		(data ?? [])
			.map(({ customer_id }) => customer_id)
			.filter((customerId): customerId is string => Boolean(customerId))
	);

	try {
		const stripe = getStripe();
		let page: string | undefined;

		do {
			const result = await stripe.customers.search({
				query: `metadata['supabaseUserId']:'${userId}'`,
				limit: 100,
				...(page ? { page } : {})
			});

			for (const customer of result.data) customerIds.add(customer.id);
			page = result.next_page ?? undefined;
		} while (page);
	} catch {
		throw new AccountDeletionProviderError('Unable to find the Stripe customers');
	}

	return [...customerIds];
}

/**
 * Remove only the external identity link. Parchment owns deletion of the local
 * stripe_customers row. A missing/already-deleted Stripe customer is an
 * idempotent success, while other Stripe failures stop provider finalization.
 */
export async function unlinkStripeCustomer(
	customerId: string | null,
	userId: string
): Promise<void> {
	if (!customerId) return;

	const stripe = getStripe();
	let customer;
	try {
		customer = await stripe.customers.retrieve(customerId);
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'statusCode' in error &&
			(error as { statusCode?: number }).statusCode === 404
		) {
			return;
		}
		throw new AccountDeletionProviderError('Unable to load the Stripe customer');
	}

	if ('deleted' in customer && customer.deleted) return;
	const linkedUserId = customer.metadata?.supabaseUserId;
	if (!linkedUserId) return;
	if (linkedUserId !== userId) {
		throw new AccountDeletionProviderError('Stripe customer ownership does not match');
	}

	try {
		await stripe.customers.update(customerId, {
			metadata: {
				supabaseUserId: '',
				accountDeletionUnlinkedAt: new Date().toISOString()
			}
		});
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'statusCode' in error &&
			(error as { statusCode?: number }).statusCode === 404
		) {
			return;
		}
		throw new AccountDeletionProviderError('Unable to unlink the Stripe customer');
	}
}

export async function unlinkStripeCustomers(customerIds: string[], userId: string): Promise<void> {
	for (const customerId of customerIds) {
		await unlinkStripeCustomer(customerId, userId);
	}
}
