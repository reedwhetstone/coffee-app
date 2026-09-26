import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPendingCanvasSave,
	queueCanvasUnloadSave,
	replayPendingCanvasSaves
} from './canvasUnloadPersistence';

describe('canvas unload persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('replays payloads that exceed the beacon budget', async () => {
		const sendBeacon = vi.fn(() => true);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		const body = JSON.stringify({ canvas_state: { data: 'x'.repeat(70 * 1024) } });
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);

		expect(queueCanvasUnloadSave('workspace-1', body)).toBe(false);
		expect(sendBeacon).not.toHaveBeenCalled();
		expect(await replayPendingCanvasSaves()).toEqual(['workspace-1']);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/workspaces/workspace-1/canvas',
			expect.objectContaining({ method: 'POST', body })
		);
	});

	it('retains a payload when the browser rejects it because the remaining quota is exhausted', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		const body = JSON.stringify({ canvas_state: { blocks: [] } });
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);

		expect(queueCanvasUnloadSave('workspace-1', body)).toBe(false);
		expect(sendBeacon).toHaveBeenCalledTimes(1);
		expect(await replayPendingCanvasSaves()).toEqual(['workspace-1']);
	});

	it('uses the beacon when the payload is within the browser budget', async () => {
		const sendBeacon = vi.fn(() => true);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });

		expect(queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }))).toBe(true);
		expect(await replayPendingCanvasSaves()).toEqual([]);
	});

	it('drops a pending payload after a newer server write wins the version check', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 409 }))
		);

		queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }));
		expect(await replayPendingCanvasSaves()).toEqual(['workspace-1']);
		expect(await replayPendingCanvasSaves()).toEqual([]);
	});

	it('clears an older pending payload after a normal canvas save', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });

		queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }));
		clearPendingCanvasSave('workspace-1');
		expect(await replayPendingCanvasSaves()).toEqual([]);
	});
});
