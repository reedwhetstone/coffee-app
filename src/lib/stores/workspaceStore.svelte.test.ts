import { decodeCanvasState } from '$lib/services/canvasPersistence';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkspaceModule = typeof import('./workspaceStore.svelte');

const workspaceFixture = {
	id: 'ws-2',
	canvas_compression_enabled: true,
	title: 'Analysis Workspace',
	type: 'analysis' as const,
	context_summary: '',
	canvas_state: {},
	last_accessed_at: '2026-04-08T00:00:00.000Z',
	created_at: '2026-04-08T00:00:00.000Z'
};

async function loadWorkspaceStore(): Promise<WorkspaceModule> {
	vi.resetModules();
	return import('./workspaceStore.svelte');
}

describe('workspaceStore lifecycle helpers', () => {
	it('resets saved count only when explicitly committed after a successful clear', async () => {
		const { workspaceStore } = await loadWorkspaceStore();
		workspaceStore.hydrate([workspaceFixture], {
			workspace: workspaceFixture,
			messages: [{}, {}, {}] as never
		});
		expect(workspaceStore.getSavedMessageCount('ws-2')).toBe(3);
		workspaceStore.resetSavedMessageCount('ws-2');
		expect(workspaceStore.getSavedMessageCount('ws-2')).toBe(0);
	});
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('uses registered UI callbacks for workspace activation on chat surfaces', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		const onSwitch = vi.fn().mockResolvedValue(undefined);

		workspaceStore.registerUICallbacks({
			onSwitch,
			onCreate: vi.fn(),
			onDelete: vi.fn(),
			onRename: vi.fn()
		});

		await expect(workspaceStore.activateWorkspace('ws-2')).resolves.toBe(true);
		expect(onSwitch).toHaveBeenCalledWith('ws-2');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('falls back to direct workspace loading when no UI callbacks are registered', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ workspace: workspaceFixture, messages: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);
		const { workspaceStore } = await loadWorkspaceStore();

		await expect(workspaceStore.activateWorkspace('ws-2')).resolves.toBe(true);
		expect(workspaceStore.currentWorkspaceId).toBe('ws-2');
		expect(localStorage.getItem('coffee-chat-workspace-id')).toBe('ws-2');
	});

	it('refreshes the canvas version once before retrying after a conflict', async () => {
		const initialWorkspace = { ...workspaceFixture, reset_epoch: 2, canvas_version: 3 };
		const refreshedWorkspace = { ...initialWorkspace, canvas_version: 8 };
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 409 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ workspace: refreshedWorkspace, messages: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						canvas_state: { blocks: [] },
						canvas_version: 9,
						reset_epoch: 2
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
			);
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		workspaceStore.hydrate([initialWorkspace], { workspace: initialWorkspace, messages: [] });

		await expect(workspaceStore.saveCanvasState('ws-2', { blocks: [] })).resolves.toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(3);
		expect(JSON.parse(fetchSpy.mock.calls[2][1].body as string)).toMatchObject({
			expected_canvas_version: 8,
			expected_reset_epoch: 2
		});
	});

	it('leaves a repeated canvas conflict retryable for the next background attempt', async () => {
		const initialWorkspace = { ...workspaceFixture, reset_epoch: 2, canvas_version: 3 };
		const refreshedWorkspace = { ...initialWorkspace, canvas_version: 8 };
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 409 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ workspace: refreshedWorkspace, messages: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(new Response(null, { status: 409 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						canvas_state: { blocks: [] },
						canvas_version: 9,
						reset_epoch: 2
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
			);
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		workspaceStore.hydrate([initialWorkspace], { workspace: initialWorkspace, messages: [] });

		await expect(workspaceStore.saveCanvasState('ws-2', { blocks: [] })).resolves.toBe(false);
		expect(workspaceStore.getCanvasSaveFailure('ws-2')).toMatchObject({ retryable: true });
		expect(fetchSpy).toHaveBeenCalledTimes(3);

		await expect(workspaceStore.saveCanvasState('ws-2', { blocks: [] })).resolves.toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(4);
		expect(JSON.parse(fetchSpy.mock.calls[3][1].body as string)).toMatchObject({
			expected_canvas_version: 8,
			expected_reset_epoch: 2
		});
	});

	it('retries summary compaction once after a message high-water conflict', async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 409 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ summary: 'Fresh summary' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		workspaceStore.hydrate([workspaceFixture], { workspace: workspaceFixture, messages: [] });

		await expect(workspaceStore.triggerSummarize('ws-2')).resolves.toBe('Fresh summary');
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(workspaceStore.currentWorkspace?.context_summary).toBe('Fresh summary');
	});

	it('uses registered UI callbacks for workspace creation before activation', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input.toString();

			if (url === '/api/workspaces' && init?.method === 'POST') {
				return new Response(JSON.stringify({ workspace: workspaceFixture }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url === '/api/workspaces/ws-2') {
				return new Response(JSON.stringify({ workspace: workspaceFixture, messages: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		const onCreate = vi.fn(
			async (
				name: string,
				type: 'general' | 'sourcing' | 'roasting' | 'inventory' | 'analysis'
			) => {
				const created = await workspaceStore.createWorkspace(name, type);
				if (created) {
					await workspaceStore.switchWorkspace(created.id);
				}
			}
		);

		workspaceStore.registerUICallbacks({
			onSwitch: vi.fn(),
			onCreate,
			onDelete: vi.fn(),
			onRename: vi.fn()
		});

		const created = await workspaceStore.createAndActivateWorkspace(
			'  Analysis Workspace  ',
			'analysis'
		);

		expect(onCreate).toHaveBeenCalledWith('Analysis Workspace', 'analysis');
		expect(created?.id).toBe('ws-2');
		expect(workspaceStore.currentWorkspaceId).toBe('ws-2');
	});
});

describe('canvas size persistence', () => {
	it('compresses large saves and preserves decoded state through conflict recovery', async () => {
		const state = {
			blocks: [{ block: { type: 'action-card', data: { note: 'Coffee choice '.repeat(20000) } } }]
		};
		const sent: unknown[] = [];
		const fetchSpy = vi.fn(async (input, init) => {
			if (!init)
				return Response.json({
					workspace: { ...workspaceFixture, canvas_version: 9 },
					messages: []
				});
			const body = JSON.parse(init.body);
			sent.push(body.canvas_state);
			if (sent.length === 1) return new Response(null, { status: 409 });
			return Response.json({ canvas_state: body.canvas_state, canvas_version: 10, reset_epoch: 0 });
		});
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		workspaceStore.hydrate([workspaceFixture], { workspace: workspaceFixture, messages: [] });
		expect(await workspaceStore.saveCanvasState('ws-2', state)).toBe(true);
		expect(sent).toHaveLength(2);
		expect(sent[0]).toEqual(sent[1]);
		expect(JSON.stringify(sent[0]).length).toBeLessThan(200000);
		expect(decodeCanvasState(sent[0])).toEqual(state);
		expect(workspaceStore.currentWorkspace?.canvas_state).toEqual(state);
	});
	it.each([413, 400, 403])('exposes terminal %s errors without retrying', async (status) => {
		const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status }));
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		expect(await workspaceStore.saveCanvasState('ws-2', {})).toBe(false);
		expect(workspaceStore.getCanvasSaveFailure('ws-2')).toMatchObject({ retryable: false });
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
	it('preflights an unrepresentable save without sending a request', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		const { workspaceStore } = await loadWorkspaceStore();
		expect(await workspaceStore.saveCanvasState('ws-2', { text: 'x'.repeat(2000001) })).toBe(false);
		expect(workspaceStore.getCanvasSaveFailure('ws-2')).toMatchObject({ retryable: false });
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it.each([429, 503])('keeps %s failures retryable', async (status) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
		const { workspaceStore } = await loadWorkspaceStore();
		expect(await workspaceStore.saveCanvasState('ws-2', {})).toBe(false);
		expect(workspaceStore.getCanvasSaveFailure('ws-2')).toMatchObject({ retryable: true });
	});
});

it('does not enable compressed writes on an older or reader-only deployment', async () => {
	const fetchSpy = vi.fn();
	vi.stubGlobal('fetch', fetchSpy);
	const { workspaceStore } = await loadWorkspaceStore();
	const readerOnly = { ...workspaceFixture, canvas_compression_enabled: undefined };
	workspaceStore.hydrate([readerOnly], { workspace: readerOnly, messages: [] });
	expect(await workspaceStore.saveCanvasState('ws-2', { text: 'coffee '.repeat(40000) })).toBe(
		false
	);
	expect(fetchSpy).not.toHaveBeenCalled();
	expect(workspaceStore.getCanvasSaveFailure('ws-2')).toMatchObject({ retryable: false });
});
