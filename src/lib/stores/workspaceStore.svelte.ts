import type { CanvasState } from '$lib/types/genui';

export interface Workspace {
	id: string;
	title: string;
	type: 'general' | 'sourcing' | 'roasting' | 'inventory' | 'analysis';
	context_summary: string;
	canvas_state: CanvasState | Record<string, never>;
	last_accessed_at: string;
	created_at: string;
	reset_epoch?: number;
	canvas_version?: number;
	summary_version?: number;
	next_message_sequence?: number;
}

export interface WorkspaceMessage {
	id: string;
	workspace_id: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	parts: unknown[];
	canvas_mutations: unknown[];
	client_message_id: string | null;
	created_at: string;
}

type WorkspaceCallbackResult = unknown | Promise<unknown>;

// localStorage helpers
const WORKSPACE_ID_KEY = 'coffee-chat-workspace-id';

function persistWorkspaceId(id: string | null) {
	try {
		if (id) {
			localStorage.setItem(WORKSPACE_ID_KEY, id);
		} else {
			localStorage.removeItem(WORKSPACE_ID_KEY);
		}
	} catch {
		// SSR or localStorage unavailable
	}
}

function getPersistedWorkspaceId(): string | null {
	try {
		return localStorage.getItem(WORKSPACE_ID_KEY);
	} catch {
		return null;
	}
}

// Module-level runes state
let workspaces = $state<Workspace[]>([]);
let currentWorkspaceId = $state<string | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

// Track saved message count per workspace to detect new messages needing persistence
let savedMessageCounts = $state<Map<string, number>>(new Map());

const currentWorkspace = $derived(
	workspaces.find((w: Workspace) => w.id === currentWorkspaceId) ?? null
);

const sortedWorkspaces = $derived(
	[...workspaces].sort(
		(a: Workspace, b: Workspace) =>
			new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime()
	)
);

/**
 * Seed the store from server-prefetched data (chat page load) so the initial
 * render doesn't need the list-then-load fetch waterfall.
 */
function hydrate(
	list: Workspace[],
	current: { workspace: Workspace; messages: WorkspaceMessage[] } | null
): void {
	workspaces = current
		? [...list.filter((w: Workspace) => w.id !== current.workspace.id), current.workspace]
		: list;
	if (current) {
		currentWorkspaceId = current.workspace.id;
		persistWorkspaceId(current.workspace.id);
		savedMessageCounts = new Map(savedMessageCounts);
		savedMessageCounts.set(current.workspace.id, current.messages.length);
	}
}

async function loadWorkspaces(): Promise<void> {
	loading = true;
	error = null;
	try {
		const res = await fetch('/api/workspaces');
		if (!res.ok) throw new Error('Failed to load workspaces');
		const data = await res.json();
		workspaces = data.workspaces || [];
	} catch (err) {
		error = (err as Error).message;
	} finally {
		loading = false;
	}
}

async function createWorkspace(
	title?: string,
	type?: Workspace['type']
): Promise<Workspace | null> {
	try {
		const res = await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: title || 'New Workspace', type: type || 'general' })
		});
		if (!res.ok) throw new Error('Failed to create workspace');
		const data = await res.json();
		const workspace = data.workspace as Workspace;
		workspaces = [...workspaces.filter((w: Workspace) => w.id !== workspace.id), workspace];
		return workspace;
	} catch (err) {
		error = (err as Error).message;
		return null;
	}
}

async function switchWorkspace(
	workspaceId: string
): Promise<{ workspace: Workspace; messages: WorkspaceMessage[] } | null> {
	loading = true;
	error = null;
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}`);
		if (!res.ok) throw new Error('Failed to load workspace');
		const data = await res.json();

		// Update workspace in the list with fresh data
		const ws = data.workspace as Workspace;
		workspaces = workspaces.map((w: Workspace) => (w.id === ws.id ? ws : w));
		currentWorkspaceId = ws.id;
		persistWorkspaceId(ws.id);

		const messages = (data.messages || []) as WorkspaceMessage[];
		savedMessageCounts = new Map(savedMessageCounts);
		savedMessageCounts.set(ws.id, messages.length);

		return { workspace: ws, messages };
	} catch (err) {
		error = (err as Error).message;
		return null;
	} finally {
		loading = false;
	}
}

async function refreshWorkspace(workspaceId: string): Promise<Workspace | null> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}`);
		if (!res.ok) throw new Error('Failed to refresh workspace');
		const data = await res.json();
		const workspace = data.workspace as Workspace;
		workspaces = workspaces.map((item: Workspace) => (item.id === workspace.id ? workspace : item));
		return workspace;
	} catch (err) {
		error = (err as Error).message;
		return null;
	}
}

async function saveMessages(
	workspaceId: string,
	messages: Array<{
		role: string;
		content: string;
		parts?: unknown;
		canvas_mutations?: unknown;
		client_message_id?: string;
		client_created_at?: string;
	}>
): Promise<boolean> {
	try {
		const workspace = workspaces.find((item) => item.id === workspaceId);
		const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expected_reset_epoch: workspace?.reset_epoch ?? 0,
				messages
			})
		});
		if (!res.ok) throw new Error('Failed to save messages');
		const data = await res.json();
		workspaces = workspaces.map((item) =>
			item.id === workspaceId
				? {
						...item,
						reset_epoch: data.reset_epoch,
						next_message_sequence: data.next_message_sequence
					}
				: item
		);

		// Update saved count
		const prev = savedMessageCounts.get(workspaceId) || 0;
		savedMessageCounts = new Map(savedMessageCounts);
		savedMessageCounts.set(workspaceId, prev + messages.length);

		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

async function saveCanvasState(
	workspaceId: string,
	canvasState: unknown,
	retryOnConflict = true
): Promise<boolean> {
	try {
		const workspace = workspaces.find((item) => item.id === workspaceId);
		const res = await fetch(`/api/workspaces/${workspaceId}/canvas`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				canvas_state: canvasState,
				expected_reset_epoch: workspace?.reset_epoch ?? 0,
				expected_canvas_version: workspace?.canvas_version ?? 0
			})
		});
		if (!res.ok) {
			if (res.status === 409 && retryOnConflict) {
				const refreshed = await refreshWorkspace(workspaceId);
				if (!refreshed) throw new Error('Failed to refresh canvas state after a conflict');
				return saveCanvasState(workspaceId, canvasState, false);
			}
			throw new Error('Failed to save canvas state');
		}
		const data = await res.json();
		workspaces = workspaces.map((item) =>
			item.id === workspaceId
				? {
						...item,
						canvas_state: data.canvas_state,
						canvas_version: data.canvas_version,
						reset_epoch: data.reset_epoch
					}
				: item
		);
		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

async function triggerSummarize(workspaceId: string): Promise<string | null> {
	try {
		for (let attempt = 0; attempt < 2; attempt++) {
			const res = await fetch(`/api/workspaces/${workspaceId}/summarize`, {
				method: 'POST'
			});
			if (!res.ok) {
				if (res.status === 409 && attempt === 0) continue;
				throw new Error('Failed to summarize workspace');
			}
			const data = await res.json();
			if (data.summary) {
				// Update local workspace
				workspaces = workspaces.map((w: Workspace) =>
					w.id === workspaceId ? { ...w, context_summary: data.summary } : w
				);
			}
			return data.summary || null;
		}
		return null;
	} catch (err) {
		error = (err as Error).message;
		return null;
	}
}

async function deleteWorkspace(workspaceId: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Failed to delete workspace');
		workspaces = workspaces.filter((w: Workspace) => w.id !== workspaceId);
		// Clean up saved message count for deleted workspace
		savedMessageCounts = new Map(savedMessageCounts);
		savedMessageCounts.delete(workspaceId);
		if (currentWorkspaceId === workspaceId) {
			currentWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
			persistWorkspaceId(currentWorkspaceId);
		}
		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

async function updateTitle(workspaceId: string, title: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title })
		});
		if (!res.ok) throw new Error('Failed to update workspace');
		workspaces = workspaces.map((w: Workspace) => (w.id === workspaceId ? { ...w, title } : w));
		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

function getSavedMessageCount(workspaceId: string): number {
	return savedMessageCounts.get(workspaceId) || 0;
}

function resetSavedMessageCount(workspaceId: string): void {
	savedMessageCounts = new Map(savedMessageCounts);
	savedMessageCounts.set(workspaceId, 0);
}

function applyClearResult(
	workspaceId: string,
	result: { reset_epoch: number; summary_version: number; canvas_version: number }
): void {
	workspaces = workspaces.map((workspace) =>
		workspace.id === workspaceId
			? {
					...workspace,
					context_summary: '',
					reset_epoch: result.reset_epoch,
					summary_version: result.summary_version,
					canvas_version: result.canvas_version,
					next_message_sequence: 1
				}
			: workspace
	);
}

// ─── UI Callbacks (registered by chat page, called by LeftSidebar) ──────────
export interface WorkspaceUICallbacks {
	onSwitch: (id: string) => WorkspaceCallbackResult;
	onCreate: (name: string, type: Workspace['type']) => WorkspaceCallbackResult;
	onDelete: (id: string) => WorkspaceCallbackResult;
	onRename: (id: string, title: string) => WorkspaceCallbackResult;
}

let uiCallbacks = $state<WorkspaceUICallbacks | null>(null);
let workspacesReady = $state(false);

function registerUICallbacks(callbacks: WorkspaceUICallbacks) {
	uiCallbacks = callbacks;
	workspacesReady = true;
}

function unregisterUICallbacks() {
	uiCallbacks = null;
	workspacesReady = false;
}

async function activateWorkspace(workspaceId: string): Promise<boolean> {
	if (uiCallbacks) {
		await uiCallbacks.onSwitch(workspaceId);
		return true;
	}

	return (await switchWorkspace(workspaceId)) !== null;
}

async function createAndActivateWorkspace(
	title?: string,
	type?: Workspace['type']
): Promise<Workspace | null> {
	const nextTitle = title?.trim() || 'New Workspace';
	const nextType = type || 'general';

	if (uiCallbacks) {
		await uiCallbacks.onCreate(nextTitle, nextType);
		return currentWorkspace;
	}

	const workspace = await createWorkspace(nextTitle, nextType);
	if (!workspace) return null;

	const activated = await switchWorkspace(workspace.id);
	return activated?.workspace ?? workspace;
}

export const workspaceStore = {
	get workspaces() {
		return sortedWorkspaces;
	},
	get currentWorkspace() {
		return currentWorkspace;
	},
	get currentWorkspaceId() {
		return currentWorkspaceId;
	},
	get loading() {
		return loading;
	},
	get error() {
		return error;
	},
	get uiCallbacks() {
		return uiCallbacks;
	},
	get workspacesReady() {
		return workspacesReady;
	},
	hydrate,
	loadWorkspaces,
	createWorkspace,
	switchWorkspace,
	activateWorkspace,
	createAndActivateWorkspace,
	saveMessages,
	saveCanvasState,
	refreshWorkspace,
	triggerSummarize,
	deleteWorkspace,
	updateTitle,
	getSavedMessageCount,
	resetSavedMessageCount,
	applyClearResult,
	getPersistedWorkspaceId,
	registerUICallbacks,
	unregisterUICallbacks
};
