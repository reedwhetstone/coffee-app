import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { createWebBotAuthDirectoryResponse } from '$lib/server/webBotAuthDirectory';

export const GET: RequestHandler = async ({ request }) => {
	if (!env.WEB_BOT_AUTH_PRIVATE_JWK) {
		return new Response('Web Bot Auth signing identity is not configured', {
			status: 503,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		});
	}

	try {
		return await createWebBotAuthDirectoryResponse(request, env.WEB_BOT_AUTH_PRIVATE_JWK);
	} catch (error) {
		console.error('Web Bot Auth key directory configuration is invalid', error);
		return new Response('Web Bot Auth signing identity is unavailable', {
			status: 503,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		});
	}
};
