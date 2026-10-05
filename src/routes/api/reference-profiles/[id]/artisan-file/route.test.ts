import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));
vi.mock('$lib/server/parchmentClient', () => parchmentMocks);

import { GET } from './+server';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000002';
// Not UTF-8: Latin-1 text, a NUL, and bytes that are invalid in UTF-8 anywhere.
const FILE_BYTES = new Uint8Array([
	0x7b, 0x27, 0x62, 0x65, 0x61, 0x6e, 0x73, 0x27, 0x3a, 0x20, 0x27, 0x47, 0x75, 0x6a, 0xed, 0x27,
	0x7d, 0x00, 0x80, 0xbf, 0xff, 0xfe, 0xf5, 0xc0
]);
const DIGEST = `sha-256=:${createHash('sha256').update(FILE_BYTES).digest('base64')}:`;
const DISPOSITION = 'attachment; filename="Guji natural keeper.alog"';

function event(id: string, role: 'viewer' | 'member' | null = 'member') {
	const request = new Request(`https://app.test/api/reference-profiles/${id}/artisan-file`);
	return {
		request,
		params: { id },
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: role ? cookieSessionPrincipal(role) : { isAuthenticated: false } }
	};
}

function answer(result: unknown) {
	const downloadArtisanFile = vi.fn().mockResolvedValue(result);
	parchmentMocks.createParchmentServerClient.mockResolvedValue({
		referenceProfiles: { downloadArtisanFile }
	});
	return downloadArtisanFile;
}

const fileOnRecord = () =>
	answer({
		data: {
			fileName: 'Guji natural keeper.alog',
			bytes: FILE_BYTES,
			fileSize: FILE_BYTES.byteLength,
			contentSha256: createHash('sha256').update(FILE_BYTES).digest('hex')
		},
		response: new Response(null, {
			headers: { 'Content-Disposition': DISPOSITION, 'Repr-Digest': DIGEST }
		})
	});

describe('GET /api/reference-profiles/[id]/artisan-file', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sends the stored file byte for byte, with its name and digest', async () => {
		const downloadArtisanFile = fileOnRecord();

		const response = await GET(event(KEEPER) as never);

		expect(response.status).toBe(200);
		expect(downloadArtisanFile).toHaveBeenCalledWith(KEEPER);
		const received = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(received)).toEqual(Array.from(FILE_BYTES));
		expect(response.headers.get('Repr-Digest')).toBe(DIGEST);
		expect(`sha-256=:${createHash('sha256').update(received).digest('base64')}:`).toBe(DIGEST);
		expect(response.headers.get('Content-Disposition')).toBe(DISPOSITION);
		expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('never lets a stored file be shown in the page, whatever header came with it', async () => {
		answer({
			data: {
				fileName: 'keeper.alog',
				bytes: FILE_BYTES,
				fileSize: FILE_BYTES.byteLength,
				contentSha256: null
			},
			response: new Response(null, { headers: { 'Content-Disposition': 'inline' } })
		});

		const response = await GET(event(KEEPER) as never);

		expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="keeper.alog"');
	});

	it.each([
		['viewer', 403, 'Member role required'],
		[null, 401, 'Authentication required']
	] as const)('refuses a %s before Parchment is asked', async (role, status, error) => {
		fileOnRecord();

		const response = await GET(event(KEEPER, role) as never);

		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ error });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([
		'chart_snapshot',
		'generated_plan',
		'reference_archived',
		'artisan_file_not_retained',
		'artisan_file_too_large'
	])('passes on why no file is on record: %s', async (reason) => {
		answer({
			error: {
				error: {
					code: 'reference_artisan_file_unavailable',
					message: 'This reference has no original Artisan file',
					reason
				}
			},
			response: new Response(null, { status: 400 })
		});

		const response = await GET(event(SNAPSHOT) as never);

		expect(response.status).toBe(400);
		expect(response.headers.get('Content-Disposition')).toBeNull();
		expect(await response.json()).toEqual({
			error: 'This reference has no original Artisan file',
			code: 'reference_artisan_file_unavailable',
			reason
		});
	});

	it.each(['4531', 'not-a-uuid', `${KEEPER}/../x`, ''])(
		'rejects %s as a saved reference without asking Parchment',
		async (id) => {
			const response = await GET(event(id) as never);

			expect(response.status).toBe(400);
			expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		}
	);
});
