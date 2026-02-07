import type { CanvasState } from '$lib/types/genui';

export interface Workspace {
	id: string;
	title: string;
	type: 'general' | 'sourcing' | 'roasting' | 'inventory' | 'analysis';
	context_summary: string;
	canvas_state: CanvasState | Record<string, never>;
	last_accessed_at: string;
	created_at: string;
}

export interface WorkspaceMessage {
	id: string;
	workspace_id: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	parts: unknown[];
	canvas_mutations: unknown[];
	created_at: string;
}

// Module-level runes state
let workspaces = $state<Workspace[]>([]);
let currentWorkspaceId = $state<string | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

// Track saved message count per workspace to detect new messages needing persistence
let savedMessageCounts = $state<Map<string, number>>(new Map());

let currentWorkspace = $derived(
	workspaces.find((w: Workspace) => w.id === currentWorkspaceId) ?? null
);

let sortedWorkspaces = $derived(
	[...workspaces].sort(
		(a: Workspace, b: Workspace) =>
			new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime()
	)
);

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
		workspaces = [...workspaces, workspace];
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

async function saveMessages(
	workspaceId: string,
	messages: Array<{ role: string; content: string; parts?: unknown }>
): Promise<boolean> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages })
		});
		if (!res.ok) throw new Error('Failed to save messages');

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

async function saveCanvasState(workspaceId: string, canvasState: unknown): Promise<boolean> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}/canvas`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ canvas_state: canvasState })
		});
		if (!res.ok) throw new Error('Failed to save canvas state');
		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

async function triggerSummarize(workspaceId: string): Promise<string | null> {
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}/summarize`, {
			method: 'POST'
		});
		if (!res.ok) throw new Error('Failed to summarize workspace');
		const data = await res.json();
		if (data.summary) {
			// Update local workspace
			workspaces = workspaces.map((w: Workspace) =>
				w.id === workspaceId ? { ...w, context_summary: data.summary } : w
			);
		}
		return data.summary || null;
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
		if (currentWorkspaceId === workspaceId) {
			currentWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
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
		workspaces = workspaces.map((w: Workspace) =>
			w.id === workspaceId ? { ...w, title } : w
		);
		return true;
	} catch (err) {
		error = (err as Error).message;
		return false;
	}
}

function getSavedMessageCount(workspaceId: string): number {
	return savedMessageCounts.get(workspaceId) || 0;
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
	loadWorkspaces,
	createWorkspace,
	switchWorkspace,
	saveMessages,
	saveCanvasState,
	triggerSummarize,
	deleteWorkspace,
	updateTitle,
	getSavedMessageCount
};
