import { describe, expect, it } from 'vitest';
import { verify } from 'http-message-sig';
import { verifierFromJWK } from 'web-bot-auth/crypto';
import {
	WEB_BOT_AUTH_DIRECTORY_MEDIA_TYPE,
	createWebBotAuthDirectoryResponse
} from './webBotAuthDirectory';

const RFC_9421_ED25519_TEST_KEY = JSON.stringify({
	kty: 'OKP',
	crv: 'Ed25519',
	d: 'n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU',
	x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs'
});

describe('Web Bot Auth key directory', () => {
	it('publishes only the public Ed25519 key and binds the response to the request authority', async () => {
		const now = new Date();
		const request = new Request(
			'https://www.purveyors.io/.well-known/http-message-signatures-directory'
		);
		const response = await createWebBotAuthDirectoryResponse(
			request,
			RFC_9421_ED25519_TEST_KEY,
			now
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe(WEB_BOT_AUTH_DIRECTORY_MEDIA_TYPE);
		expect(response.headers.get('signature-input')).toContain(
			'tag="http-message-signatures-directory"'
		);
		expect(response.headers.get('signature-input')).toContain('"@authority";req');
		expect(response.headers.get('signature-input')).toContain('"content-digest"');
		expect(response.headers.get('content-digest')).toMatch(/^sha-256=:[A-Za-z0-9+/]+={0,2}:$/);
		expect(response.headers.get('signature-input')).toContain(
			`created=${Math.floor(now.getTime() / 1000)}`
		);
		expect(response.headers.get('signature-input')).toContain(
			`expires=${Math.floor(now.getTime() / 1000) + 3600}`
		);
		expect(response.headers.get('signature')).toMatch(/^binding0=:[A-Za-z0-9+/]+={0,2}:$/);
		expect(await response.json()).toEqual({
			keys: [
				{
					kty: 'OKP',
					crv: 'Ed25519',
					x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs'
				}
			]
		});
		const verifySignature = await verifierFromJWK({
			kty: 'OKP',
			crv: 'Ed25519',
			x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs'
		});
		await expect(
			verify({ request, response }, (data, signature) =>
				verifySignature(data, signature, {
					keyid: 'test',
					created: now,
					expires: new Date(now.getTime() + 60 * 60 * 1000),
					tag: 'web-bot-auth'
				})
			)
		).resolves.toBeUndefined();
	});

	it.each([
		'not-json',
		JSON.stringify({ kty: 'RSA', n: 'public-only' }),
		JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: 'public-only' })
	])('rejects an invalid or public-only signing key', async (raw) => {
		await expect(
			createWebBotAuthDirectoryResponse(
				new Request('https://www.purveyors.io/.well-known/http-message-signatures-directory'),
				raw
			)
		).rejects.toThrow(/WEB_BOT_AUTH_PRIVATE_JWK/);
	});
});
