import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	CanvasSaveError,
	MAX_CANVAS_DECODED_BYTES,
	MAX_CANVAS_JSON_CHARS,
	canvasHttpError,
	decodeCanvasState,
	encodeCanvasState
} from './canvasPersistence';

function envelope(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return { encoding: 'cherry-canvas-gzip-v1', data: btoa(binary) };
}

function largeInventoryWorkspace() {
	const options = Array.from({ length: 5000 }, (_, i) => ({
		label: `Coffee ${i + 1}: Finca El Paraíso — café lavado ☕ / Ethiopia Gedeb natural`,
		value: String(i + 1)
	}));
	return {
		blocks: [
			{
				block: {
					type: 'coffee-cards',
					version: 1,
					data: [{ id: 17, name: 'Finca El Paraíso — 古树咖啡 ☕', source: 'Supplier 1' }]
				},
				messageId: 'historical-message-outside-the-latest-50',
				pinned: true,
				minimized: false,
				title: 'Évidence retained from an older conversation'
			},
			{
				block: {
					type: 'action-card',
					version: 1,
					data: {
						executionId: 'assistant-message:add-bean-tool-call',
						actionType: 'add_bean_to_inventory',
						summary: 'Add Finca El Paraíso to inventory (3 lbs)',
						status: 'success',
						result: { inventoryId: 913, quantity: 3, receipt: 'Saved café ☕' },
						fields: [
							{
								key: 'source_filter',
								value: 'Supplier 1',
								type: 'select',
								editable: true,
								selectOptions: [
									{ label: 'All Suppliers', value: '__all__' },
									...Array.from({ length: 15 }, (_, i) => ({
										label: `Supplier ${i}`,
										value: `Supplier ${i}`
									}))
								]
							},
							{
								key: 'coffee_bean',
								value: '17',
								type: 'select',
								editable: true,
								selectOptions: options
							},
							{
								key: '_bean_sources',
								value: Object.fromEntries(options.map((o, i) => [o.value, `Supplier ${i % 15}`])),
								type: 'hidden',
								editable: false
							},
							{ key: 'catalog_id', value: 17, type: 'number', editable: false },
							{ key: 'purchased_qty_lbs', value: 3, type: 'number', editable: true }
						]
					}
				},
				messageId: 'assistant-message',
				pinned: false,
				minimized: false,
				title: 'Add coffee'
			}
		],
		layout: 'comparison',
		focusBlockId: 'canvas-action-17',
		focusBlockIndex: 1
	};
}

describe('canvas state persistence codec', () => {
	it('losslessly saves a 5000-coffee proposal and pinned historical evidence below the API cap', () => {
		const state = largeInventoryWorkspace();
		const before = JSON.stringify(state);
		const encoded = encodeCanvasState(state);
		const after = JSON.stringify(encoded);

		expect(before.length).toBeGreaterThan(MAX_CANVAS_JSON_CHARS);
		expect(after.length).toBeLessThan(MAX_CANVAS_JSON_CHARS);
		expect(after.length).toBeLessThan(before.length / 5);
		expect(decodeCanvasState(JSON.parse(after))).toEqual(state);
		expect(JSON.stringify(state)).toBe(before);
	});

	it.each([{}, { blocks: [], layout: 'focus', focusBlockId: null }, null])(
		'preserves small legacy state without wrapping: %j',
		(state) => {
			expect(encodeCanvasState(state)).toBe(state);
			expect(decodeCanvasState(state)).toBe(state);
		}
	);

	it('keeps the legacy cutoff in serialized characters for Unicode state', () => {
		const state = { text: '界'.repeat(70_000) };
		const serialized = JSON.stringify(state);

		expect(serialized.length).toBeLessThan(MAX_CANVAS_JSON_CHARS);
		expect(strToU8(serialized).length).toBeGreaterThan(MAX_CANVAS_JSON_CHARS);
		expect(encodeCanvasState(state)).toBe(state);
		expect(encodeCanvasState(state, false)).toBe(state);
	});

	it.each([
		{ encoding: 'cherry-canvas-gzip-v2', data: '' },
		{ encoding: 'cherry-canvas-gzip-v1' },
		{ encoding: 'cherry-canvas-gzip-v1', data: 42 },
		{ encoding: 'cherry-canvas-gzip-v1', data: 'not valid base64 !' },
		envelope(new Uint8Array(20)),
		envelope(gzipSync(strToU8('not JSON')))
	])(
		'rejects malformed or unsupported saved data without returning an empty canvas: %j',
		(state) => {
			expect(() => decodeCanvasState(state)).toThrow(CanvasSaveError);
			expect(() => decodeCanvasState(state)).toThrow('it has not been replaced');
		}
	);

	it('rejects an envelope larger than the transport cap', () => {
		expect(() =>
			decodeCanvasState({
				encoding: 'cherry-canvas-gzip-v1',
				data: 'A'.repeat(MAX_CANVAS_JSON_CHARS)
			})
		).toThrow(CanvasSaveError);
	});

	it('rejects decoded state over its bound even when gzip is tiny', () => {
		const oversized = gzipSync(
			strToU8(JSON.stringify({ text: 'x'.repeat(MAX_CANVAS_DECODED_BYTES) }))
		);
		expect(JSON.stringify(envelope(oversized)).length).toBeLessThan(MAX_CANVAS_JSON_CHARS);
		expect(() => decodeCanvasState(envelope(oversized))).toThrow(CanvasSaveError);
	});

	it('rejects forged gzip sizes, including a small trailer disguising oversized output', () => {
		for (const text of ['valid small text', 'x'.repeat(MAX_CANVAS_DECODED_BYTES + 10)]) {
			const forged = gzipSync(strToU8(JSON.stringify({ text })));
			new DataView(forged.buffer).setUint32(forged.length - 4, 2, true);
			expect(() => decodeCanvasState(envelope(forged))).toThrow(CanvasSaveError);
		}
	});

	it('rejects oversized input and incompressible state as terminal without pruning', () => {
		let seed = 0x12345678;
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		const randomText = Array.from({ length: 350_000 }, () => {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;
			return alphabet[(seed >>> 0) % alphabet.length];
		}).join('');
		for (const text of [randomText, 'x'.repeat(MAX_CANVAS_DECODED_BYTES)]) {
			const state = { blocks: [{ block: { type: 'data-table', data: { text } } }] };
			try {
				encodeCanvasState(state);
				expect.fail('Expected oversize state to fail without discarding evidence');
			} catch (error) {
				expect(error).toBeInstanceOf(CanvasSaveError);
				expect(error).toMatchObject({ retryable: false });
				expect((error as Error).message).toContain('Inventory changes are saved separately');
			}
			expect(state.blocks[0].block.data.text).toBe(text);
		}
	});
});

describe('canvas HTTP error classification', () => {
	it.each([400, 401, 403, 404, 413, 422])('does not retry terminal HTTP %i', (status) => {
		expect(canvasHttpError(status)).toMatchObject({ retryable: false });
	});

	it.each([408, 409, 429, 500, 502, 503])('permits retrying transient HTTP %i', (status) => {
		expect(canvasHttpError(status)).toMatchObject({ retryable: true });
	});
});
