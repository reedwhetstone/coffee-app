import { env } from '$env/dynamic/private';
import { createAdminClient } from '$lib/supabase-admin';
import { getStripe } from '$lib/services/stripe';
import { ACCOUNT_DELETION_CONFIRMATION } from '$lib/accountDeletion';
import type { User } from '@supabase/supabase-js';

export { ACCOUNT_DELETION_CONFIRMATION };
export const RECENT_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000;

export class AccountDeletionConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AccountDeletionConfigError';
	}
}

export class AccountDeletionProviderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AccountDeletionProviderError';
	}
}

export function getAccountDeletionProviderCredential(): string {
	const credential = env.PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL?.trim();
	if (!credential) {
		throw new AccountDeletionConfigError(
			'PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL is not configured'
		);
	}
	return credential;
}

export function hasRecentSignIn(user: Pick<User, 'last_sign_in_at'>, now = Date.now()): boolean {
	if (!user.last_sign_in_at) return false;
	const signedInAt = Date.parse(user.last_sign_in_at);
	const age = now - signedInAt;
	return Number.isFinite(signedInAt) && age >= 0 && age <= RECENT_SIGN_IN_MAX_AGE_MS;
}

/**
 * Read the retained Stripe mapping before Parchment quiesces and later deletes
 * owner rows. A database failure is not the same as no customer: failing closed
 * here keeps provider finalization unpublished and the account retryable.
 */
export async function captureStripeCustomerId(userId: string): Promise<string | null> {
	const { data, error } = await createAdminClient()
		.from('stripe_customers')
		.select('customer_id')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		throw new AccountDeletionProviderError('Unable to read the Stripe customer mapping');
	}

	return data?.customer_id ?? null;
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
