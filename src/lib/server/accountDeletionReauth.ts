import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { SignJWT, decodeProtectedHeader, importJWK, jwtVerify, type JWK, type KeyLike } from 'jose';

export const ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE = 'account_deletion_reauth_challenge';
export const ACCOUNT_DELETION_REAUTH_COOKIE = 'account_deletion_reauthenticated';
export const ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS = 10 * 60;

const ASSERTION_PURPOSE = 'account-deletion';
const CHALLENGE_PURPOSE = 'account-deletion-reauth-challenge';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PrivateKeyRing {
	keys: Record<string, JWK>;
}

interface SigningConfiguration {
	issuer: string;
	audience: string;
	activeKid: string;
	keys: Record<string, JWK>;
}

interface TokenCreationOptions {
	now?: Date;
	jti?: string;
}

interface TokenVerificationOptions {
	now?: Date;
}

export class AccountDeletionReauthConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AccountDeletionReauthConfigError';
	}
}

function requiredEnvironment(name: string, value: string | undefined): string {
	const normalized = value?.trim();
	if (!normalized) {
		throw new AccountDeletionReauthConfigError(`${name} is not configured.`);
	}
	return normalized;
}

function readKeyRing(value: string): PrivateKeyRing {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new AccountDeletionReauthConfigError(
			'ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS must be valid JSON.'
		);
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('keys' in parsed) ||
		typeof parsed.keys !== 'object' ||
		parsed.keys === null ||
		Array.isArray(parsed.keys)
	) {
		throw new AccountDeletionReauthConfigError(
			'ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS must contain a keys object.'
		);
	}

	return { keys: parsed.keys as Record<string, JWK> };
}

function validatePrivateKey(kid: string, key: JWK): void {
	if (
		typeof key !== 'object' ||
		key === null ||
		key.kty !== 'OKP' ||
		key.crv !== 'Ed25519' ||
		typeof key.x !== 'string' ||
		key.x.length === 0 ||
		typeof key.d !== 'string' ||
		key.d.length === 0 ||
		key.kid !== kid
	) {
		throw new AccountDeletionReauthConfigError(
			`ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS contains an invalid Ed25519 private key for ${kid}.`
		);
	}
}

function loadSigningConfiguration(): SigningConfiguration {
	const issuer = requiredEnvironment(
		'ACCOUNT_DELETION_REAUTH_ISSUER',
		env.ACCOUNT_DELETION_REAUTH_ISSUER
	);
	const audience = requiredEnvironment(
		'ACCOUNT_DELETION_REAUTH_AUDIENCE',
		env.ACCOUNT_DELETION_REAUTH_AUDIENCE
	);
	const activeKid = requiredEnvironment(
		'ACCOUNT_DELETION_REAUTH_ACTIVE_KID',
		env.ACCOUNT_DELETION_REAUTH_ACTIVE_KID
	);
	const ring = readKeyRing(
		requiredEnvironment(
			'ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS',
			env.ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS
		)
	);
	const activeKey = ring.keys[activeKid];
	if (!activeKey) {
		throw new AccountDeletionReauthConfigError(
			'ACCOUNT_DELETION_REAUTH_ACTIVE_KID is not present in ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS.'
		);
	}

	for (const [kid, key] of Object.entries(ring.keys)) {
		validatePrivateKey(kid, key);
	}

	return { issuer, audience, activeKid, keys: ring.keys };
}

async function importPrivateKey(key: JWK): Promise<KeyLike | Uint8Array> {
	try {
		return await importJWK(key, 'EdDSA');
	} catch {
		throw new AccountDeletionReauthConfigError(
			'ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS contains an unusable Ed25519 private key.'
		);
	}
}

async function importPublicKey(key: JWK): Promise<KeyLike | Uint8Array> {
	const { d: _privateKey, ...publicKey } = key;
	try {
		return await importJWK(publicKey, 'EdDSA');
	} catch {
		throw new AccountDeletionReauthConfigError(
			'ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS contains an unusable Ed25519 public key.'
		);
	}
}

async function createToken(
	subject: string,
	purpose: typeof ASSERTION_PURPOSE | typeof CHALLENGE_PURPOSE,
	options: TokenCreationOptions = {}
): Promise<string> {
	if (!subject) {
		throw new TypeError('An account-deletion token subject is required.');
	}

	const configuration = loadSigningConfiguration();
	const now = options.now ?? new Date();
	const issuedAt = Math.floor(now.getTime() / 1000);
	const jti = options.jti ?? randomUUID();
	if (!UUID_PATTERN.test(jti)) {
		throw new TypeError('The account-deletion token jti must be a UUID.');
	}

	return new SignJWT({ purpose })
		.setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: configuration.activeKid })
		.setIssuer(configuration.issuer)
		.setAudience(configuration.audience)
		.setSubject(subject)
		.setIssuedAt(issuedAt)
		.setExpirationTime(issuedAt + ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS)
		.setJti(jti)
		.sign(await importPrivateKey(configuration.keys[configuration.activeKid]));
}

export function createAccountDeletionReauthChallenge(
	userId: string,
	options?: TokenCreationOptions
): Promise<string> {
	return createToken(userId, CHALLENGE_PURPOSE, options);
}

export function createAccountDeletionAssertion(
	userId: string,
	options?: TokenCreationOptions
): Promise<string> {
	return createToken(userId, ASSERTION_PURPOSE, options);
}

export async function readAccountDeletionReauthChallenge(
	token: string | undefined,
	options: TokenVerificationOptions = {}
): Promise<string | null> {
	if (!token) return null;

	const configuration = loadSigningConfiguration();
	let kid: string | undefined;
	try {
		kid = decodeProtectedHeader(token).kid;
	} catch {
		return null;
	}
	if (!kid || !configuration.keys[kid]) return null;

	try {
		const { payload, protectedHeader } = await jwtVerify(
			token,
			await importPublicKey(configuration.keys[kid]),
			{
				algorithms: ['EdDSA'],
				issuer: configuration.issuer,
				audience: configuration.audience,
				clockTolerance: 60,
				currentDate: options.now ?? new Date()
			}
		);
		if (
			protectedHeader.typ !== 'JWT' ||
			payload.purpose !== CHALLENGE_PURPOSE ||
			typeof payload.sub !== 'string' ||
			payload.sub.length === 0 ||
			typeof payload.iat !== 'number' ||
			typeof payload.exp !== 'number' ||
			payload.exp <= payload.iat ||
			payload.exp - payload.iat > ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS ||
			payload.iat > Math.floor((options.now ?? new Date()).getTime() / 1000) + 60 ||
			typeof payload.jti !== 'string' ||
			!UUID_PATTERN.test(payload.jti)
		) {
			return null;
		}
		return payload.sub;
	} catch (error) {
		if (error instanceof AccountDeletionReauthConfigError) throw error;
		return null;
	}
}
