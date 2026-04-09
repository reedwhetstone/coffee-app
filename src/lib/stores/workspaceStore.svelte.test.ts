import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkspaceModule = typeof import('./workspaceStore.svelte');

const workspaceFixture = {
	id: 'ws-2',
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
