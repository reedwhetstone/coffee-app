import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	downloadFile,
	downloadFileName,
	referenceFileHref,
	referenceFileReasonCopy,
	roastFileHref,
	roastFileReasonCopy
} from './artisan-download';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
// Not UTF-8: decoding these to text and back would change them.
const FILE_BYTES = new Uint8Array([0x7b, 0x27, 0xe9, 0x27, 0x7d, 0x80, 0x00, 0xff, 0xfe, 0xc3]);

describe('where an Artisan file is downloaded from', () => {
	it('names the route for a roast and for a saved reference', () => {
		expect(roastFileHref(4531)).toBe('/api/roast-profiles/4531/artisan-file');
		expect(referenceFileHref(KEEPER)).toBe(`/api/reference-profiles/${KEEPER}/artisan-file`);
	});
});

describe('the name a download is saved under', () => {
	it.each([
		[
			`attachment; filename="plain.alog"; filename*=UTF-8''caf%C3%A9%20keeper.alog`,
			'café keeper.alog'
		],
		['attachment; filename="Wush Wush 10-01.alog"', 'Wush Wush 10-01.alog'],
		['attachment; filename="a \\"quoted\\" name.alog"', 'a "quoted" name.alog'],
		['attachment; filename=bare.alog', 'bare.alog'],
		[`attachment; filename="kept.alog"; filename*=UTF-8''%E0%A4%A`, 'kept.alog'],
		['attachment', 'fallback.alog'],
		[null, 'fallback.alog']
	])('reads %s as %s', (disposition, name) => {
		expect(downloadFileName(disposition, 'fallback.alog')).toBe(name);
	});
});

describe('downloading a file', () => {
	const saved: Blob[] = [];
	let clicked: { download: string; href: string }[];

	beforeEach(() => {
		saved.length = 0;
		clicked = [];
		URL.createObjectURL = vi.fn((blob: Blob) => (saved.push(blob), 'blob:artisan-file'));
		URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
			this: HTMLAnchorElement
		) {
			clicked.push({ download: this.download, href: this.href });
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('hands the browser the bytes that arrived, under the name they came with', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(FILE_BYTES, {
					headers: { 'Content-Disposition': 'attachment; filename="Wush Wush 10-01.alog"' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		const result = await downloadFile(roastFileHref(4531), 'roast-4531.alog');

		expect(result).toEqual({ ok: true, fileName: 'Wush Wush 10-01.alog' });
		expect(fetchMock).toHaveBeenCalledWith('/api/roast-profiles/4531/artisan-file');
		expect(clicked).toEqual([{ download: 'Wush Wush 10-01.alog', href: 'blob:artisan-file' }]);
		expect(Array.from(new Uint8Array(await saved[0].arrayBuffer()))).toEqual(
			Array.from(FILE_BYTES)
		);
		// The link is only there for the click.
		expect(document.querySelector('a[download]')).toBeNull();
	});

	it('uses the fallback name when the answer carries none', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(FILE_BYTES))
		);

		expect(await downloadFile(roastFileHref(4531), 'roast-4531.alog')).toEqual({
			ok: true,
			fileName: 'roast-4531.alog'
		});
	});

	it('answers with Parchment’s reason, and saves nothing, when there is no file', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: 'This roast has no Artisan file on record',
							code: 'roast_artisan_source_unavailable',
							reason: 'no_artisan_import'
						}),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					)
			)
		);

		expect(await downloadFile(roastFileHref(4490), 'roast-4490.alog')).toEqual({
			ok: false,
			reason: 'no_artisan_import',
			message: 'This roast has no Artisan file on record'
		});
		expect(clicked).toEqual([]);
		expect(saved).toEqual([]);
	});

	it('answers with no reason when the request fails or the refusal is not readable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('offline');
			})
		);
		expect(await downloadFile(roastFileHref(4531), 'roast-4531.alog')).toEqual({
			ok: false,
			reason: null,
			message: null
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
		);
		expect(await downloadFile(roastFileHref(4531), 'roast-4531.alog')).toEqual({
			ok: false,
			reason: null,
			message: null
		});
		expect(clicked).toEqual([]);
	});

	it('answers with no reason, and saves nothing, when the file stops arriving part way', async () => {
		// The headers arrived, so the request itself succeeded; the body then fails to read.
		const response = new Response(FILE_BYTES, {
			headers: { 'Content-Disposition': 'attachment; filename="Wush Wush 10-01.alog"' }
		});
		vi.spyOn(response, 'blob').mockRejectedValue(new TypeError('network error'));
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response)
		);

		expect(await downloadFile(roastFileHref(4531), 'roast-4531.alog')).toEqual({
			ok: false,
			reason: null,
			message: null
		});
		expect(clicked).toEqual([]);
		expect(saved).toEqual([]);
		expect(document.querySelector('a[download]')).toBeNull();
	});
});

describe('why there is no file, as the next thing to do', () => {
	it('says what to do for a roast', () => {
		expect(roastFileReasonCopy('no_artisan_import')).toBe(
			'This roast has no Artisan file on record, so there is no file to download. Import its .alog to keep a copy with the roast.'
		);
		expect(roastFileReasonCopy('artisan_file_not_retained')).toBe(
			'This roast was imported before Artisan files were kept, so there is no file to download. Import its .alog again to keep a copy with the roast.'
		);
		expect(roastFileReasonCopy('artisan_file_too_large')).toBe(
			'This roast’s Artisan file is over 10 MB, which is too large to download here.'
		);
		expect(roastFileReasonCopy(null)).toBe(roastFileReasonCopy('no_artisan_import'));
	});

	it('says what to do for a saved reference', () => {
		expect(referenceFileReasonCopy('chart_snapshot')).toBe(
			'This reference holds a roast’s curve without its Artisan file, so there is no file to download. If that roast was imported from Artisan, its file is under More on the roast.'
		);
		expect(referenceFileReasonCopy('generated_plan')).toBe(
			'A plan has no original Artisan file. Download the plan itself to follow it in Artisan.'
		);
		expect(referenceFileReasonCopy('reference_archived')).toBe(
			'This reference is archived, so its Artisan file cannot be downloaded.'
		);
		expect(referenceFileReasonCopy('artisan_file_too_large')).toBe(
			'This reference’s Artisan file is over 10 MB, which is too large to download here.'
		);
		expect(referenceFileReasonCopy(undefined)).toBe(
			'No Artisan file is stored with this reference, so there is no file to download. Add the .alog again to keep a copy here.'
		);
	});
});
