import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv: Record<string, string | undefined> = {};

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));

const RFC_9421_ED25519_TEST_KEY = JSON.stringify({
	kty: 'OKP',
	crv: 'Ed25519',
	d: 'n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU',
	x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs'
});

describe('HTTP message signatures directory route', () => {
	beforeEach(() => {
		delete privateEnv.WEB_BOT_AUTH_PRIVATE_JWK;
	});

	it('fails closed when the signing key is absent', async () => {
		const { GET } = await import('./+server');
		const response = await GET({
			request: new Request('https://www.purveyors.io/.well-known/http-message-signatures-directory')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('serves a signed directory when configured', async () => {
		privateEnv.WEB_BOT_AUTH_PRIVATE_JWK = RFC_9421_ED25519_TEST_KEY;
		const { GET } = await import('./+server');
		const response = await GET({
			request: new Request('https://www.purveyors.io/.well-known/http-message-signatures-directory')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('signature')).toBeTruthy();
		expect(response.headers.get('signature-input')).toBeTruthy();
	});
});
