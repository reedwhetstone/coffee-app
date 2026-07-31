import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: {
		PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL: ` ${'p'.repeat(32)} ` as string | undefined
	},
	selectCustomers: vi.fn(),
	search: vi.fn(),
	retrieve: vi.fn(),
	update: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: mocks.env
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: () => ({
		from: () => ({
			select: () => ({
				eq: mocks.selectCustomers
			})
		})
	})
}));

vi.mock('$lib/services/stripe', () => ({
	getStripe: () => ({
		customers: {
			search: mocks.search,
			retrieve: mocks.retrieve,
			update: mocks.update
		}
	})
}));

import {
	AccountDeletionProviderError,
	captureStripeCustomerIds,
	createAccountDeletionRetryToken,
	getAccountDeletionProviderCredential,
	hasRecentSignIn,
	readAccountDeletionRetryOperation,
	unlinkStripeCustomer
} from './accountDeletion';

describe('account deletion provider helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.env.PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL = ` ${'p'.repeat(32)} `;
		mocks.selectCustomers.mockResolvedValue({ data: [], error: null });
		mocks.search.mockResolvedValue({ data: [], next_page: null });
	});

	it('uses the trimmed server-only finalization credential', () => {
		expect(getAccountDeletionProviderCredential()).toBe('p'.repeat(32));
	});

	it('rejects missing and undersized provider credentials', () => {
		mocks.env.PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL = undefined;
		expect(() => getAccountDeletionProviderCredential()).toThrow('is not configured');

		mocks.env.PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL = 'too-short';
		expect(() => getAccountDeletionProviderCredential()).toThrow('must be at least 32 characters');
	});

	it('enforces a ten-minute recent-sign-in window', () => {
		const now = Date.parse('2026-07-30T18:00:00.000Z');
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T17:50:01.000Z' }, now)).toBe(true);
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T17:49:59.000Z' }, now)).toBe(false);
		expect(hasRecentSignIn({ last_sign_in_at: '2026-07-30T18:00:01.000Z' }, now)).toBe(false);
		expect(hasRecentSignIn({ last_sign_in_at: undefined }, now)).toBe(false);
	});

	it('accepts only retry tokens signed for the same owner and operation', () => {
		const issuedAt = Date.parse('2026-07-30T18:00:00.000Z');
		const token = createAccountDeletionRetryToken(
			'operation-1',
			'user-1',
			'provider-secret',
			issuedAt
		);

		expect(
			readAccountDeletionRetryOperation(token, 'user-1', 'provider-secret', issuedAt + 1000)
		).toBe('operation-1');
		expect(
			readAccountDeletionRetryOperation(token, 'user-2', 'provider-secret', issuedAt + 1000)
		).toBeNull();
		expect(
			readAccountDeletionRetryOperation(token, 'user-1', 'different-secret', issuedAt + 1000)
		).toBeNull();
		expect(
			readAccountDeletionRetryOperation(
				`${token.slice(0, -1)}x`,
				'user-1',
				'provider-secret',
				issuedAt + 1000
			)
		).toBeNull();
		expect(
			readAccountDeletionRetryOperation(
				token,
				'user-1',
				'provider-secret',
				issuedAt + 24 * 60 * 60 * 1000 + 1
			)
		).toBeNull();
	});

	it('distinguishes missing Stripe mappings from a database failure', async () => {
		await expect(captureStripeCustomerIds('user-1')).resolves.toEqual([]);

		mocks.selectCustomers.mockResolvedValueOnce({ data: null, error: new Error('db unavailable') });
		await expect(captureStripeCustomerIds('user-1')).rejects.toBeInstanceOf(
			AccountDeletionProviderError
		);
	});

	it('captures mapped and metadata-linked Stripe customers across search pages', async () => {
		mocks.selectCustomers.mockResolvedValue({
			data: [{ customer_id: 'cus_mapped' }],
			error: null
		});
		mocks.search
			.mockResolvedValueOnce({
				data: [{ id: 'cus_mapped' }, { id: 'cus_older' }],
				next_page: 'page-2'
			})
			.mockResolvedValueOnce({ data: [{ id: 'cus_oldest' }], next_page: null });

		await expect(captureStripeCustomerIds('user-1')).resolves.toEqual([
			'cus_mapped',
			'cus_older',
			'cus_oldest'
		]);
		expect(mocks.search).toHaveBeenNthCalledWith(1, {
			query: "metadata['supabaseUserId']:'user-1'",
			limit: 100
		});
		expect(mocks.search).toHaveBeenNthCalledWith(2, {
			query: "metadata['supabaseUserId']:'user-1'",
			limit: 100,
			page: 'page-2'
		});
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
