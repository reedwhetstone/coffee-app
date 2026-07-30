import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	maybeSingle: vi.fn(),
	retrieve: vi.fn(),
	update: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: { PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL: ' provider-secret ' }
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({ maybeSingle: mocks.maybeSingle })
			})
		})
	})
}));

vi.mock('$lib/services/stripe', () => ({
	getStripe: () => ({
		customers: {
			retrieve: mocks.retrieve,
			update: mocks.update
		}
	})
}));

import {
	AccountDeletionProviderError,
	captureStripeCustomerId,
	getAccountDeletionProviderCredential,
	hasRecentSignIn,
	unlinkStripeCustomer
} from './accountDeletion';

describe('account deletion provider helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('uses the trimmed server-only finalization credential', () => {
		expect(getAccountDeletionProviderCredential()).toBe('provider-secret');
	});

	it('enforces a ten-minute recent-sign-in window', () => {
		const now = Date.parse('2026-07-30T18:00:00.000Z');
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T17:50:01.000Z' }, now)).toBe(true);
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T17:49:59.000Z' }, now)).toBe(false);
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T18:00:01.000Z' }, now)).toBe(false);
		expect(hasRecentSignIn({ last_sign_in_at: undefined }, now)).toBe(false);
	});

	it('distinguishes a missing Stripe mapping from a database failure', async () => {
		mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
		await expect(captureStripeCustomerId('user-1')).resolves.toBeNull();

		mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('db unavailable') });
		await expect(captureStripeCustomerId('user-1')).rejects.toBeInstanceOf(
			AccountDeletionProviderError
		);
	});

	it('clears only the matching external Stripe identity metadata', async () => {
		mocks.retrieve.mockResolvedValue({
			id: 'cus_123',
			metadata: { supabaseUserId: 'user-1', retained: 'yes' }
		});
		mocks.update.mockResolvedValue({});

		await unlinkStripeCustomer('cus_123', 'user-1');

		expect(mocks.update).toHaveBeenCalledWith('cus_123', {
			metadata: {
				supabaseUserId: '',
				accountDeletionUnlinkedAt: expect.any(String)
			}
		});
	});

	it('is idempotent for missing, deleted, and already-unlinked customers', async () => {
		await unlinkStripeCustomer(null, 'user-1');

		mocks.retrieve.mockResolvedValueOnce({ id: 'cus_123', deleted: true });
		await unlinkStripeCustomer('cus_123', 'user-1');

		mocks.retrieve.mockResolvedValueOnce({ id: 'cus_456', metadata: {} });
		await unlinkStripeCustomer('cus_456', 'user-1');

		mocks.retrieve.mockRejectedValueOnce({ statusCode: 404 });
		await unlinkStripeCustomer('cus_missing', 'user-1');

		expect(mocks.update).not.toHaveBeenCalled();
	});

	it('fails closed when the retained mapping points at another Stripe identity', async () => {
		mocks.retrieve.mockResolvedValue({
			id: 'cus_123',
			metadata: { supabaseUserId: 'different-user' }
		});

		await expect(unlinkStripeCustomer('cus_123', 'user-1')).rejects.toBeInstanceOf(
			AccountDeletionProviderError
		);
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
