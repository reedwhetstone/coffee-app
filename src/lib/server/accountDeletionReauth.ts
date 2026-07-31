import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE = 'account_deletion_reauth_challenge';
export const ACCOUNT_DELETION_REAUTH_COOKIE = 'account_deletion_reauthenticated';
export const ACCOUNT_DELETION_COMPLETION_COOKIE = 'account_deletion_completed';
export const ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS = 10 * 60;
export const ACCOUNT_DELETION_COMPLETION_MAX_AGE_SECONDS = 10 * 60;

type TokenPurpose = 'reauth-challenge' | 'reauth-completion' | 'deletion-completion';

function encodeUserId(userId: string): string {
	return Buffer.from(userId, 'utf8').toString('base64url');
}

function decodeUserId(encodedUserId: string): string | null {
	try {
		const userId = Buffer.from(encodedUserId, 'base64url').toString('utf8');
		return userId.length > 0 ? userId : null;
	} catch {
		return null;
	}
}

function sessionBinding(sessionAccessToken: string): string {
	return createHash('sha256').update(sessionAccessToken).digest('base64url');
}

function signToken(
	purpose: TokenPurpose,
	encodedUserId: string,
	issuedAt: number,
	nonce: string,
	sessionAccessToken: string | undefined,
	credential: string
): string {
	const binding = sessionAccessToken ? sessionBinding(sessionAccessToken) : '';
	return createHmac('sha256', credential)
		.update(`${purpose}:${encodedUserId}:${issuedAt}:${nonce}:${binding}`)
		.digest('base64url');
}

function createUserToken(
	purpose: TokenPurpose,
	userId: string,
	credential: string,
	now: number,
	sessionAccessToken?: string
): string {
	const encodedUserId = encodeUserId(userId);
	const issuedAt = String(now);
	const nonce = randomBytes(16).toString('base64url');
	const signature = signToken(purpose, encodedUserId, now, nonce, sessionAccessToken, credential);
	return `${encodedUserId}.${issuedAt}.${nonce}.${signature}`;
}

function readUserToken(
	token: string | undefined,
	purpose: TokenPurpose,
	credential: string,
	maxAgeSeconds: number,
	now: number,
	expectedUserId?: string,
	sessionAccessToken?: string
): string | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 4) return null;

	const [encodedUserId, encodedIssuedAt, nonce, receivedSignature] = parts;
	const userId = decodeUserId(encodedUserId);
	const issuedAt = Number(encodedIssuedAt);
	if (
		!userId ||
		!nonce ||
		!Number.isSafeInteger(issuedAt) ||
		now - issuedAt < 0 ||
		now - issuedAt > maxAgeSeconds * 1000
	) {
		return null;
	}
	if (expectedUserId !== undefined && userId !== expectedUserId) return null;

	const expectedSignature = signToken(
		purpose,
		encodedUserId,
		issuedAt,
		nonce,
		sessionAccessToken,
		credential
	);
	const received = Buffer.from(receivedSignature, 'base64url');
	const expected = Buffer.from(expectedSignature, 'base64url');
	if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

	return userId;
}

export function createAccountDeletionReauthChallenge(
	userId: string,
	credential: string,
	now = Date.now()
): string {
	return createUserToken('reauth-challenge', userId, credential, now);
}

export function readAccountDeletionReauthChallenge(
	token: string | undefined,
	credential: string,
	now = Date.now()
): string | null {
	return readUserToken(
		token,
		'reauth-challenge',
		credential,
		ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
		now
	);
}

export function createAccountDeletionReauthToken(
	userId: string,
	sessionAccessToken: string,
	credential: string,
	now = Date.now()
): string {
	return createUserToken('reauth-completion', userId, credential, now, sessionAccessToken);
}

export function hasValidAccountDeletionReauth(
	token: string | undefined,
	userId: string,
	sessionAccessToken: string,
	credential: string,
	now = Date.now()
): boolean {
	return (
		readUserToken(
			token,
			'reauth-completion',
			credential,
			ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
			now,
			userId,
			sessionAccessToken
		) === userId
	);
}

export function createAccountDeletionCompletionToken(
	userId: string,
	credential: string,
	now = Date.now()
): string {
	return createUserToken('deletion-completion', userId, credential, now);
}

export function readAccountDeletionCompletionUser(
	token: string | undefined,
	credential: string,
	now = Date.now()
): string | null {
	return readUserToken(
		token,
		'deletion-completion',
		credential,
		ACCOUNT_DELETION_COMPLETION_MAX_AGE_SECONDS,
		now
	);
}
