import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';

export const MAX_CANVAS_JSON_CHARS = 200_000;
export const MAX_CANVAS_DECODED_BYTES = 2_000_000;
const ENCODING = 'cherry-canvas-gzip-v1';

export class CanvasSaveError extends Error {
	constructor(
		message: string,
		public readonly retryable = false
	) {
		super(message);
		this.name = 'CanvasSaveError';
	}
}

const tooLarge = () =>
	new CanvasSaveError(
		'Evidence workspace is too large to save. Remove unneeded evidence and try again. Inventory changes are saved separately.'
	);

/** Keep small/legacy states unchanged; large states remain self-contained and lossless. */
export function encodeCanvasState(state: unknown, compressionEnabled = true): unknown {
	const serialized = JSON.stringify(state);
	const bytes = strToU8(serialized);
	if (bytes.length <= MAX_CANVAS_JSON_CHARS) return state;
	if (!compressionEnabled || bytes.length > MAX_CANVAS_DECODED_BYTES) throw tooLarge();
	const compressed = gzipSync(bytes, { level: 6, mtime: 0 });
	let binary = '';
	for (const byte of compressed) binary += String.fromCharCode(byte);
	const envelope = { encoding: ENCODING, data: btoa(binary) };
	if (JSON.stringify(envelope).length > MAX_CANVAS_JSON_CHARS) throw tooLarge();
	return envelope;
}

/** Used at the BFF read boundary, so page loads and older clients still receive normal blocks. */
export function decodeCanvasState(state: unknown): unknown {
	if (!state || typeof state !== 'object' || !('encoding' in state)) return state;
	try {
		if (state.encoding !== ENCODING || !('data' in state) || typeof state.data !== 'string') {
			throw new Error('Unsupported canvas encoding');
		}
		if (JSON.stringify(state).length > MAX_CANVAS_JSON_CHARS) throw tooLarge();
		const bytes = Uint8Array.from(atob(state.data), (char) => char.charCodeAt(0));
		if (bytes.length < 18) throw new Error('Invalid gzip');
		const expectedSize = new DataView(bytes.buffer).getUint32(bytes.length - 4, true);
		if (expectedSize > MAX_CANVAS_DECODED_BYTES) throw tooLarge();
		// An explicit output buffer bounds even a forged gzip size header.
		const decoded = gunzipSync(bytes, { out: new Uint8Array(MAX_CANVAS_DECODED_BYTES + 1) });
		if (decoded.length !== expectedSize || decoded.length > MAX_CANVAS_DECODED_BYTES) {
			throw new Error('Invalid canvas size');
		}
		return JSON.parse(strFromU8(decoded));
	} catch {
		throw new CanvasSaveError(
			'Saved evidence could not be read. Reload or contact support; it has not been replaced.'
		);
	}
}

export function canvasHttpError(status: number): CanvasSaveError {
	if (status === 413) return tooLarge();
	const retryable = status === 408 || status === 429 || status >= 500;
	return new CanvasSaveError(
		retryable
			? 'Failed to save canvas state'
			: 'Evidence workspace could not be saved. Reload and try again.',
		retryable
	);
}
