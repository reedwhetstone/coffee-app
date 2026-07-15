import { createHash } from 'node:crypto';
import { signatureHeaders } from 'http-message-sig';
import { MediaType, type Signer } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';

export const WEB_BOT_AUTH_DIRECTORY_PATH = '/.well-known/http-message-signatures-directory';
export const WEB_BOT_AUTH_DIRECTORY_MEDIA_TYPE = MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY;

type Ed25519PrivateJwk = JsonWebKey & {
	kty: 'OKP';
	crv: 'Ed25519';
	x: string;
	d: string;
};

function parsePrivateJwk(raw: string): Ed25519PrivateJwk {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('WEB_BOT_AUTH_PRIVATE_JWK must be valid JSON');
	}

	if (
		typeof value !== 'object' ||
		value === null ||
		(value as JsonWebKey).kty !== 'OKP' ||
		(value as JsonWebKey).crv !== 'Ed25519' ||
		typeof (value as JsonWebKey).x !== 'string' ||
		typeof (value as JsonWebKey).d !== 'string'
	) {
		throw new Error('WEB_BOT_AUTH_PRIVATE_JWK must contain an Ed25519 private JWK');
	}

	return value as Ed25519PrivateJwk;
}

function publicJwk(privateJwk: Ed25519PrivateJwk): JsonWebKey {
	return {
		kty: privateJwk.kty,
		crv: privateJwk.crv,
		x: privateJwk.x
	};
}

export async function createWebBotAuthDirectoryResponse(
	request: Request,
	privateJwkRaw: string,
	now = new Date()
): Promise<Response> {
	const privateJwk = parsePrivateJwk(privateJwkRaw);
	const signer: Signer = await signerFromJWK(privateJwk);
	const body = JSON.stringify({ keys: [publicJwk(privateJwk)] });
	const contentDigest = `sha-256=:${createHash('sha256').update(body).digest('base64')}:`;
	const response = new Response(body, {
		status: 200,
		headers: {
			'Content-Type': WEB_BOT_AUTH_DIRECTORY_MEDIA_TYPE,
			'Cache-Control': 'public, max-age=300, s-maxage=300',
			'Content-Digest': contentDigest,
			'X-Content-Type-Options': 'nosniff'
		}
	});
	const signed = await signatureHeaders(
		{ request, response },
		{
			signer,
			components: [{ name: '@authority', parameters: new Map([['req', true]]) }, 'content-digest'],
			created: now,
			expires: new Date(now.getTime() + 60 * 60 * 1000),
			keyid: signer.keyid,
			key: 'binding0',
			tag: 'http-message-signatures-directory'
		}
	);

	response.headers.set('Signature', signed.Signature);
	response.headers.set('Signature-Input', signed['Signature-Input']);
	return response;
}
