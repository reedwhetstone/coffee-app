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

	it('stops replaying a pending save for a workspace the signed-in account cannot reach', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response('{"error":"Workspace not found."}', { status: 404 }));
		vi.stubGlobal('fetch', fetchMock);

		// Written before saves were scoped to an account, then replayed after an account switch.
		queueCanvasUnloadSave('other-account-workspace', JSON.stringify({ canvas_state: {} }));
		expect(await replayPendingCanvasSaves('user-2')).toEqual([]);
		expect(await replayPendingCanvasSaves('user-2')).toEqual([]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/workspaces/other-account-workspace/canvas',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it("holds another account's pending save for that account instead of sending it", async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);
		const body = JSON.stringify({ canvas_state: { blocks: [] } });

		queueCanvasUnloadSave('workspace-1', body, 'user-1');
		expect(await replayPendingCanvasSaves('user-2')).toEqual([]);
		expect(await replayPendingCanvasSaves(null)).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();

		expect(await replayPendingCanvasSaves('user-1')).toEqual(['workspace-1']);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/workspaces/workspace-1/canvas',
			expect.objectContaining({ method: 'POST', body })
		);
		expect(await replayPendingCanvasSaves('user-1')).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 429, 503])(
		'keeps a pending save for a later page load after a %i response',
		async (status) => {
			const sendBeacon = vi.fn(() => false);
			Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(new Response('{}', { status }))
				.mockResolvedValue(new Response('{}'));
			vi.stubGlobal('fetch', fetchMock);

			queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }), 'user-1');
			expect(await replayPendingCanvasSaves('user-1')).toEqual([]);
			expect(await replayPendingCanvasSaves('user-1')).toEqual(['workspace-1']);
		}
	);

	it('keeps a save queued while an earlier one is still being replayed', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
		const laterBody = JSON.stringify({ canvas_state: { blocks: ['later'] } });
		const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
			queueCanvasUnloadSave('workspace-2', laterBody, 'user-1');
			return new Response('{}');
		});
		fetchMock.mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);

		queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }), 'user-1');
		expect(await replayPendingCanvasSaves('user-1')).toEqual(['workspace-1']);
		expect(await replayPendingCanvasSaves('user-1')).toEqual(['workspace-2']);
		expect(fetchMock).toHaveBeenLastCalledWith(
			'/api/workspaces/workspace-2/canvas',
			expect.objectContaining({ body: laterBody })
		);
	});

	it('clears an older pending payload after a normal canvas save', async () => {
		const sendBeacon = vi.fn(() => false);
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });

		queueCanvasUnloadSave('workspace-1', JSON.stringify({ canvas_state: {} }));
		clearPendingCanvasSave('workspace-1');
		expect(await replayPendingCanvasSaves()).toEqual([]);
	});
});
