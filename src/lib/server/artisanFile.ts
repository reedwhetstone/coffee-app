import { json } from '@sveltejs/kit';
import type { ParchmentClient } from '@purveyors/sdk';

type ArtisanFileResult = Awaited<
	ReturnType<
		| ParchmentClient['roasts']['downloadArtisanFile']
		| ParchmentClient['referenceProfiles']['downloadArtisanFile']
	>
>;

/** Why Parchment has no Artisan file to send for a roast or a saved reference. */
const NO_FILE_REASONS = new Set([
	'no_artisan_import',
	'artisan_file_not_retained',
	'artisan_file_too_large',
	'generated_plan',
	'chart_snapshot',
	'reference_archived'
]);

function errorDetail(error: unknown): Record<string, unknown> | null {
	if (typeof error !== 'object' || error === null || !('error' in error)) return null;
	const detail = error.error;
	return typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : null;
}

/** The name to save the file under when Parchment's own header cannot be passed on. */
function attachment(fileName: string): string {
	const safe = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_').trim() || 'roast.alog';
	return `attachment; filename="${safe}"`;
}

/**
 * Answer a download with the stored Artisan file exactly as Parchment sent it. The body stays
 * bytes from Parchment to the browser and is never decoded into text, so a file in any
 * encoding arrives unchanged. Parchment's file name and SHA-256 digest go with it.
 *
 * When no file is on record, Parchment's code and reason are passed on so the page can say
 * what to do next.
 */
export function artisanFileResponse(result: ArtisanFileResult, fallback: string): Response {
	if (result.error || !result.data) {
		const detail = errorDetail(result.error);
		const { message, code, reason } = detail ?? {};
		return json(
			{
				error: typeof message === 'string' ? message : fallback,
				...(typeof code === 'string' ? { code } : {}),
				...(typeof reason === 'string' && NO_FILE_REASONS.has(reason) ? { reason } : {})
			},
			{ status: result.response?.status ?? 500 }
		);
	}

	const file = result.data;
	const upstream = result.response.headers;
	const disposition = upstream.get('content-disposition');
	const digest = upstream.get('repr-digest');
	const headers = new Headers({
		'Content-Type': 'application/octet-stream',
		'Content-Length': String(file.bytes.byteLength),
		// Always a download, never a page drawn from a member's file.
		'Content-Disposition': disposition?.trim().toLowerCase().startsWith('attachment')
			? disposition
			: attachment(file.fileName),
		'Cache-Control': 'private, no-store',
		'X-Content-Type-Options': 'nosniff'
	});
	if (digest) headers.set('Repr-Digest', digest);
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(file.bytes);
			controller.close();
		}
	});
	return new Response(body, { headers });
}
