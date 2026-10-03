const PENDING_CANVAS_SAVES_KEY = 'coffee-chat-pending-canvas-saves-v1';
const MAX_BEACON_PAYLOAD_BYTES = 64 * 1024;

interface PendingCanvasSave {
	workspaceId: string;
	body: string;
	/** Account that made the canvas change. Absent on records written before owner scoping. */
	ownerId?: string;
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
				typeof item.body === 'string' &&
				(item.ownerId === undefined || typeof item.ownerId === 'string')
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

function rememberPendingCanvasSave(
	workspaceId: string,
	body: string,
	ownerId: string | null
): void {
	const saves = readPendingCanvasSaves().filter((save) => save.workspaceId !== workspaceId);
	saves.push(ownerId ? { workspaceId, body, ownerId } : { workspaceId, body });
	writePendingCanvasSaves(saves);
}

/**
 * A replay that can never succeed: the workspace is not this account's, or the
 * payload is invalid. Signed-out, rate-limited, and server failures stay queued.
 */
function isTerminalReplayFailure(status: number): boolean {
	return (
		status >= 400 &&
		status < 500 &&
		status !== 401 &&
		status !== 403 &&
		status !== 408 &&
		status !== 429
	);
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
export function queueCanvasUnloadSave(
	workspaceId: string,
	body: string,
	ownerId: string | null = null
): boolean {
	const payload = new Blob([body], { type: 'application/json' });
	if (payload.size <= MAX_BEACON_PAYLOAD_BYTES && navigator.sendBeacon) {
		try {
			if (navigator.sendBeacon(`/api/workspaces/${workspaceId}/canvas`, payload)) return true;
		} catch {
			// Fall through to the durable same-origin recovery record.
		}
	}
	rememberPendingCanvasSave(workspaceId, body, ownerId);
	return false;
}

/**
 * Replay unload saves before the workspace is rendered on a later page load.
 * Browser storage outlives a sign-out, so a record is replayed only for the
 * account that wrote it; another account's record waits for that account.
 * Returns the workspaces whose saved canvas may have changed.
 */
export async function replayPendingCanvasSaves(ownerId: string | null = null): Promise<string[]> {
	const pending = readPendingCanvasSaves();
	if (pending.length === 0) return [];

	const delivered = new Set<string>();
	const settled = new Set<PendingCanvasSave>();
	for (const save of pending) {
		if (save.ownerId && save.ownerId !== ownerId) continue;
		try {
			const response = await fetch(`/api/workspaces/${save.workspaceId}/canvas`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: save.body
			});
			// A conflict proves another writer has advanced the canvas. The pending
			// request is stale, so let the normal workspace reload win.
			if (response.ok || response.status === 409) {
				delivered.add(save.workspaceId);
				settled.add(save);
			} else if (isTerminalReplayFailure(response.status)) {
				// Retrying would repeat the same failure on every later page load.
				settled.add(save);
			}
		} catch {
			// Keep failed records for a later page load or a recovered network session.
		}
	}

	if (settled.size > 0) {
		// Re-read storage: another tab may have queued a save while this one replayed.
		const settledKeys = new Set([...settled].map((save) => `${save.workspaceId}\n${save.body}`));
		writePendingCanvasSaves(
			readPendingCanvasSaves().filter(
				(save) => !settledKeys.has(`${save.workspaceId}\n${save.body}`)
			)
		);
	}
	return [...delivered];
}
