import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	decodeJwt,
	decodeProtectedHeader,
	exportJWK,
	generateKeyPair,
	importJWK,
	jwtVerify,
	type JWK
} from 'jose';

const environment = vi.hoisted(() => ({
	ACCOUNT_DELETION_REAUTH_ISSUER: 'https://www.purveyors.io',
	ACCOUNT_DELETION_REAUTH_AUDIENCE: 'https://api.purveyors.io/v1/account-deletion',
	ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS: '',
	ACCOUNT_DELETION_REAUTH_ACTIVE_KID: '2026-08'
}));

vi.mock('$env/dynamic/private', () => ({ env: environment }));

import {
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
	AccountDeletionReauthConfigError,
	createAccountDeletionAssertion,
	createAccountDeletionReauthChallenge,
	readAccountDeletionReauthChallenge
} from './accountDeletionReauth';

const issuedAt = new Date('2026-08-14T18:00:00.000Z');
const assertionJti = '9dc525f2-b855-4af1-9908-661f030e716c';
const challengeJti = '62bcf3ea-85f6-4be5-afb4-e69399fa6a40';
let oldPrivateJwk: JWK;
let oldPublicJwk: JWK;
let newPrivateJwk: JWK;

async function createJwk(kid: string): Promise<{ privateJwk: JWK; publicJwk: JWK }> {
	const keyPair = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
	return {
		privateJwk: { ...(await exportJWK(keyPair.privateKey)), kid },
		publicJwk: { ...(await exportJWK(keyPair.publicKey)), kid }
	};
}

function setRing(keys: Record<string, JWK>, activeKid = '2026-08'): void {
	environment.ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS = JSON.stringify({ keys });
	environment.ACCOUNT_DELETION_REAUTH_ACTIVE_KID = activeKid;
}

describe('account deletion Ed25519 assertions', () => {
	beforeAll(async () => {
		({ privateJwk: oldPrivateJwk, publicJwk: oldPublicJwk } = await createJwk('2026-08'));
		({ privateJwk: newPrivateJwk } = await createJwk('2026-09'));
	});

	beforeEach(() => {
		environment.ACCOUNT_DELETION_REAUTH_ISSUER = 'https://www.purveyors.io';
		environment.ACCOUNT_DELETION_REAUTH_AUDIENCE = 'https://api.purveyors.io/v1/account-deletion';
		setRing({ '2026-08': oldPrivateJwk });
	});

	it('mints the exact purpose-bound assertion accepted by the Parchment public key', async () => {
		const assertion = await createAccountDeletionAssertion('user-1', {
			now: issuedAt,
			jti: assertionJti
		});
		const publicKey = await importJWK(oldPublicJwk, 'EdDSA');
		const verified = await jwtVerify(assertion, publicKey, {
			algorithms: ['EdDSA'],
			issuer: environment.ACCOUNT_DELETION_REAUTH_ISSUER,
			audience: environment.ACCOUNT_DELETION_REAUTH_AUDIENCE,
			currentDate: new Date(issuedAt.getTime() + 1000)
		});

		expect(decodeProtectedHeader(assertion)).toEqual({
			alg: 'EdDSA',
			typ: 'JWT',
			kid: '2026-08'
		});
		expect(verified.payload).toEqual({
			iss: environment.ACCOUNT_DELETION_REAUTH_ISSUER,
			aud: environment.ACCOUNT_DELETION_REAUTH_AUDIENCE,
			sub: 'user-1',
			purpose: 'account-deletion',
			iat: Math.floor(issuedAt.getTime() / 1000),
			exp: Math.floor(issuedAt.getTime() / 1000) + ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
			jti: assertionJti
		});
	});

	it('uses a distinct signed purpose for the one-shot OAuth challenge', async () => {
		const challenge = await createAccountDeletionReauthChallenge('user-1', {
			now: issuedAt,
			jti: challengeJti
		});
		const assertion = await createAccountDeletionAssertion('user-1', {
			now: issuedAt,
			jti: assertionJti
		});

		expect(decodeJwt(challenge).purpose).toBe('account-deletion-reauth-challenge');
		await expect(
			readAccountDeletionReauthChallenge(challenge, {
				now: new Date(issuedAt.getTime() + 1000)
			})
		).resolves.toBe('user-1');
		await expect(
			readAccountDeletionReauthChallenge(assertion, {
				now: new Date(issuedAt.getTime() + 1000)
			})
		).resolves.toBeNull();
		await expect(
			readAccountDeletionReauthChallenge(challenge, {
				now: new Date(issuedAt.getTime() + (ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS + 61) * 1000)
			})
		).resolves.toBeNull();
	});

	it('accepts an old challenge during verifier-first rotation and rejects it after retirement', async () => {
		const oldChallenge = await createAccountDeletionReauthChallenge('user-1', {
			now: issuedAt,
			jti: challengeJti
		});
		setRing({ '2026-08': oldPrivateJwk, '2026-09': newPrivateJwk }, '2026-09');
		const newChallenge = await createAccountDeletionReauthChallenge('user-1', {
			now: issuedAt,
			jti: assertionJti
		});

		expect(decodeProtectedHeader(newChallenge).kid).toBe('2026-09');
		await expect(
			readAccountDeletionReauthChallenge(oldChallenge, {
				now: new Date(issuedAt.getTime() + 1000)
			})
		).resolves.toBe('user-1');

		setRing({ '2026-09': newPrivateJwk }, '2026-09');
		await expect(
			readAccountDeletionReauthChallenge(oldChallenge, {
				now: new Date(issuedAt.getTime() + 1000)
			})
		).resolves.toBeNull();
	});

	it.each([
		['malformed JSON', () => (environment.ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS = '{')],
		['public-only key', () => setRing({ '2026-08': oldPublicJwk })],
		['wrong curve', () => setRing({ '2026-08': { ...oldPrivateJwk, crv: 'X25519' } })],
		['missing key id', () => setRing({ '2026-08': { ...oldPrivateJwk, kid: undefined } })],
		['unknown active key', () => (environment.ACCOUNT_DELETION_REAUTH_ACTIVE_KID = 'missing')],
		['missing issuer', () => (environment.ACCOUNT_DELETION_REAUTH_ISSUER = '')],
		['missing audience', () => (environment.ACCOUNT_DELETION_REAUTH_AUDIENCE = '')]
	])('fails closed for %s configuration', async (_name, mutate) => {
		mutate();
		await expect(createAccountDeletionAssertion('user-1')).rejects.toBeInstanceOf(
			AccountDeletionReauthConfigError
		);
	});
});
