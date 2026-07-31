import { describe, expect, it } from 'vitest';
import {
	createAccountDeletionCompletionToken,
	createAccountDeletionReauthChallenge,
	createAccountDeletionReauthToken,
	hasValidAccountDeletionReauth,
	readAccountDeletionCompletionUser,
	readAccountDeletionReauthChallenge
} from './accountDeletionReauth';

describe('account deletion reauthentication capabilities', () => {
	const credential = 'provider-secret';
	const issuedAt = Date.parse('2026-07-30T18:00:00.000Z');

	it('binds the reauthentication capability to the current session', () => {
		const token = createAccountDeletionReauthToken('user-1', 'session-1', credential, issuedAt);

		expect(
			hasValidAccountDeletionReauth(token, 'user-1', 'session-1', credential, issuedAt + 1000)
		).toBe(true);
		expect(
			hasValidAccountDeletionReauth(token, 'user-1', 'session-2', credential, issuedAt + 1000)
		).toBe(false);
		expect(
			hasValidAccountDeletionReauth(token, 'user-2', 'session-1', credential, issuedAt + 1000)
		).toBe(false);
		expect(
			hasValidAccountDeletionReauth(
				token,
				'user-1',
				'session-1',
				credential,
				issuedAt + 10 * 60 * 1000 + 1
			)
		).toBe(false);
	});

	it('binds the OAuth challenge to the account that started reauthentication', () => {
		const token = createAccountDeletionReauthChallenge('user-1', credential, issuedAt);

		expect(readAccountDeletionReauthChallenge(token, credential, issuedAt + 1000)).toBe('user-1');
		expect(
			readAccountDeletionReauthChallenge(token, 'different-secret', issuedAt + 1000)
		).toBeNull();
	});

	it('accepts only a fresh server-issued deletion completion token', () => {
		const token = createAccountDeletionCompletionToken('user-1', credential, issuedAt);

		expect(readAccountDeletionCompletionUser(token, credential, issuedAt + 1000)).toBe('user-1');
		expect(readAccountDeletionCompletionUser(`${token}x`, credential, issuedAt + 1000)).toBeNull();
		expect(
			readAccountDeletionCompletionUser(token, credential, issuedAt + 10 * 60 * 1000 + 1)
		).toBeNull();
	});
});
