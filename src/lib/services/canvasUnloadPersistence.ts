const PENDING_CANVAS_SAVES_KEY = 'coffee-chat-pending-canvas-saves-v1';
const MAX_BEACON_PAYLOAD_BYTES = 64 * 1024;

interface PendingCanvasSave {
	workspaceId: string;
	body: string;
}

function readPendingCanvasSaves(): PendingCanvasSave[] {
	try {
		const stored = localStorage.getItem(PENDING_CANVAS_SAVES_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item): item is PendingCanvasSave =>
				!!item &&
				typeof item === 'object' &&
				typeof item.workspaceId === 'string' &&
				typeof item.body === 'string'
		);
	} catch {
		return [];
	}
}

function writePendingCanvasSaves(saves: PendingCanvasSave[]): void {
	try {
		if (saves.length === 0) {
			localStorage.removeItem(PENDING_CANVAS_SAVES_KEY);
		} else {
			localStorage.setItem(PENDING_CANVAS_SAVES_KEY, JSON.stringify(saves));
		}
	} catch {
		// A storage quota or privacy restriction must not prevent normal unload handling.
	}
}

function rememberPendingCanvasSave(workspaceId: string, body: string): void {
	const saves = readPendingCanvasSaves().filter((save) => save.workspaceId !== workspaceId);
	saves.push({ workspaceId, body });
	writePendingCanvasSaves(saves);
}

/** Drop an older unload record after a newer normal canvas save succeeds. */
export function clearPendingCanvasSave(workspaceId: string): void {
	writePendingCanvasSaves(
		readPendingCanvasSaves().filter((save) => save.workspaceId !== workspaceId)
	);
}

/**
 * Queue an unload canvas save when the browser cannot accept the full payload.
 * sendBeacon and keepalive fetch share a browser-managed 64 KiB budget, so an
 * oversized or quota-rejected beacon is retained for the next page load instead.
 */
export function queueCanvasUnloadSave(workspaceId: string, body: string): boolean {
	const payload = new Blob([body], { type: 'application/json' });
	if (payload.size <= MAX_BEACON_PAYLOAD_BYTES && navigator.sendBeacon) {
		try {
			if (navigator.sendBeacon(`/api/workspaces/${workspaceId}/canvas`, payload)) return true;
		} catch {
			// Fall through to the durable same-origin recovery record.
		}
	}
	rememberPendingCanvasSave(workspaceId, body);
	return false;
}

/** Replay unload saves before the workspace is rendered on a later page load. */
export async function replayPendingCanvasSaves(): Promise<string[]> {
	const pending = readPendingCanvasSaves();
	if (pending.length === 0) return [];

	const delivered = new Set<string>();
	for (const save of pending) {
		try {
			const response = await fetch(`/api/workspaces/${save.workspaceId}/canvas`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: save.body
			});
			// A conflict proves another writer has advanced the canvas. The pending
			// request is stale, so let the normal workspace reload win.
			if (response.ok || response.status === 409) delivered.add(save.workspaceId);
		} catch {
			// Keep failed records for a later page load or a recovered network session.
		}
	}

	if (delivered.size > 0) {
		writePendingCanvasSaves(pending.filter((save) => !delivered.has(save.workspaceId)));
	}
	return [...delivered];
}
