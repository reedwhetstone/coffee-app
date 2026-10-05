import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));
vi.mock('$lib/server/parchmentClient', () => parchmentMocks);

import { GET } from './+server';

// An Artisan file is not always UTF-8: a Latin-1 "é", a stray continuation byte, a NUL,
// and bytes that are invalid in UTF-8 anywhere. Decoding these to text and back changes them.
const FILE_BYTES = new Uint8Array([
	0x7b, 0x27, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x27, 0x3a, 0x20, 0x27, 0x63, 0x61, 0x66, 0xe9, 0x27,
	0x7d, 0x0d, 0x0a, 0x80, 0x00, 0xff, 0xfe, 0xc3, 0x28
]);
const DIGEST = `sha-256=:${createHash('sha256').update(FILE_BYTES).digest('base64')}:`;
const DISPOSITION = `attachment; filename="Wush Wush 10-01.alog"; filename*=UTF-8''Wush%20Wush%2010-01.alog`;

function event(id: string, role: 'viewer' | 'member' | null = 'member') {
	const request = new Request(`https://app.test/api/roast-profiles/${id}/artisan-file`);
	return {
		request,
		params: { id },
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: role ? cookieSessionPrincipal(role) : { isAuthenticated: false } }
	};
}

function fileOnRecord() {
	const downloadArtisanFile = vi.fn().mockResolvedValue({
		data: {
			fileName: 'Wush Wush 10-01.alog',
			bytes: FILE_BYTES,
			fileSize: FILE_BYTES.byteLength,
			contentSha256: createHash('sha256').update(FILE_BYTES).digest('hex')
		},
		response: new Response(null, {
			headers: { 'Content-Disposition': DISPOSITION, 'Repr-Digest': DIGEST }
		})
	});
	parchmentMocks.createParchmentServerClient.mockResolvedValue({
		roasts: { downloadArtisanFile }
	});
	return downloadArtisanFile;
}

describe('GET /api/roast-profiles/[id]/artisan-file', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sends the stored file byte for byte, with its name and digest', async () => {
		const downloadArtisanFile = fileOnRecord();
		const requestEvent = event('4531');

		const response = await GET(requestEvent as never);

		expect(response.status).toBe(200);
		expect(downloadArtisanFile).toHaveBeenCalledWith('4531');
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(requestEvent, {
			mode: 'session',
			signal: requestEvent.request.signal
		});
		const received = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(received)).toEqual(Array.from(FILE_BYTES));
		// The digest Parchment sent still describes the body that arrived.
		expect(response.headers.get('Repr-Digest')).toBe(DIGEST);
		expect(`sha-256=:${createHash('sha256').update(received).digest('base64')}:`).toBe(DIGEST);
		expect(response.headers.get('Content-Disposition')).toBe(DISPOSITION);
		expect(response.headers.get('Content-Length')).toBe(String(FILE_BYTES.byteLength));
		expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('names the file as an attachment when Parchment’s header is missing', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				downloadArtisanFile: vi.fn().mockResolvedValue({
					data: {
						fileName: 'café "keeper".alog',
						bytes: FILE_BYTES,
						fileSize: FILE_BYTES.byteLength,
						contentSha256: null
					},
					response: new Response(null)
				})
			}
		});

		const response = await GET(event('4531') as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="caf_ _keeper_.alog"'
		);
		expect(response.headers.get('Repr-Digest')).toBeNull();
		expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(
			Array.from(FILE_BYTES)
		);
	});

	it.each([
		['viewer', 403, 'Member role required'],
		[null, 401, 'Authentication required']
	] as const)('refuses a %s before Parchment is asked', async (role, status, error) => {
		fileOnRecord();

		const response = await GET(event('4531', role) as never);

		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ error });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each(['no_artisan_import', 'artisan_file_not_retained', 'artisan_file_too_large'])(
		'passes on why no file is on record: %s',
		async (reason) => {
			parchmentMocks.createParchmentServerClient.mockResolvedValue({
				roasts: {
					downloadArtisanFile: vi.fn().mockResolvedValue({
						error: {
							error: {
								code: 'roast_artisan_source_unavailable',
								message: 'This roast has no Artisan file on record',
								reason
							}
						},
						response: new Response(null, { status: 400 })
					})
				}
			});

			const response = await GET(event('4490') as never);

			expect(response.status).toBe(400);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			expect(response.headers.get('Content-Disposition')).toBeNull();
			expect(await response.json()).toEqual({
				error: 'This roast has no Artisan file on record',
				code: 'roast_artisan_source_unavailable',
				reason
			});
		}
	);

	it('passes on a roast that is not the member’s as not found, with no reason', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roasts: {
				downloadArtisanFile: vi.fn().mockResolvedValue({
					error: { error: { code: 'not_found', message: 'Roast not found', reason: 'made_up' } },
					response: new Response(null, { status: 404 })
				})
			}
		});

		const response = await GET(event('999') as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Roast not found', code: 'not_found' });
	});

	it.each(['abc', '0', '-4', '12.5', '4531/../1', '99999999999999999999'])(
		'rejects %s as a roast ID without asking Parchment',
		async (id) => {
			const response = await GET(event(id) as never);

			expect(response.status).toBe(400);
			expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		}
	);
});
