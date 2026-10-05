/** Where the Artisan file a roast was imported from is downloaded from. */
export function roastFileHref(roastId: number | string): string {
	return `/api/roast-profiles/${encodeURIComponent(String(roastId))}/artisan-file`;
}

/** Where the Artisan file a saved reference was added from is downloaded from. */
export function referenceFileHref(referenceId: string): string {
	return `/api/reference-profiles/${encodeURIComponent(referenceId)}/artisan-file`;
}

/** What to do with a downloaded file once it is on the roaster's computer. */
export const ARTISAN_BACKGROUND_STEPS =
	'In Artisan, open Roast, then Background, and load this file. It appears behind your live curve as a guide. It does not control your roaster, unless Artisan is set to play back a background’s events or to follow the background.';

export type FileDownload =
	| { ok: true; fileName: string }
	/** `reason` is Parchment's, when it has no file to send. */
	| { ok: false; reason: string | null; message: string | null };

/** The file name a download was sent with: `filename*=UTF-8''…` first, then `filename="…"`. */
export function downloadFileName(disposition: string | null, fallback: string): string {
	const encoded = disposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
	if (encoded) {
		try {
			const name = decodeURIComponent(encoded.trim()).trim();
			if (name) return name;
		} catch {
			// Fall through to the plain name.
		}
	}
	const plain = disposition?.match(/filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i);
	const name = (plain?.[1]?.replace(/\\(.)/g, '$1') ?? plain?.[2])?.trim();
	return name || fallback;
}

/**
 * Fetch a file and hand it to the browser to save. The body is kept as bytes from the
 * response to the saved file. A refusal resolves with Parchment's reason so the page can
 * say what to do next, instead of the browser saving an error in the file's place.
 */
export async function downloadFile(href: string, fallbackName: string): Promise<FileDownload> {
	let response: Response;
	try {
		response = await fetch(href);
	} catch {
		return { ok: false, reason: null, message: null };
	}
	if (!response.ok) {
		const body: { error?: unknown; reason?: unknown } | null = await response
			.json()
			.catch(() => null);
		return {
			ok: false,
			reason: typeof body?.reason === 'string' ? body.reason : null,
			message: typeof body?.error === 'string' ? body.error : null
		};
	}
	const fileName = downloadFileName(response.headers.get('content-disposition'), fallbackName);
	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.hidden = true;
	document.body.append(link);
	link.click();
	link.remove();
	// The browser reads the file after the click returns.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
	return { ok: true, fileName };
}

/** Why a roast has no Artisan file to download, as the next thing to do. */
export function roastFileReasonCopy(reason: string | null | undefined): string {
	switch (reason) {
		case 'artisan_file_not_retained':
			return 'This roast was imported before Artisan files were kept, so there is no file to download. Import its .alog again to keep a copy with the roast.';
		case 'artisan_file_too_large':
			return 'This roast’s Artisan file is over 10 MB, which is too large to download here.';
		default:
			return 'This roast has no Artisan file on record, so there is no file to download. Import its .alog to keep a copy with the roast.';
	}
}

/** Why a saved reference has no Artisan file to download, as the next thing to do. */
export function referenceFileReasonCopy(reason: string | null | undefined): string {
	switch (reason) {
		case 'chart_snapshot':
			return 'This reference holds a roast’s curve without its Artisan file, so there is no file to download. If that roast was imported from Artisan, its file is under More on the roast.';
		case 'generated_plan':
			return 'A plan has no original Artisan file. Download the plan itself to follow it in Artisan.';
		case 'reference_archived':
			return 'This reference is archived, so its Artisan file cannot be downloaded.';
		case 'artisan_file_too_large':
			return 'This reference’s Artisan file is over 10 MB, which is too large to download here.';
		default:
			return 'No Artisan file is stored with this reference, so there is no file to download. Add the .alog again to keep a copy here.';
	}
}
