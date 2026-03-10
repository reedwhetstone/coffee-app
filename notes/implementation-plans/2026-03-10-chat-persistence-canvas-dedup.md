# Chat Persistence & Canvas Duplication Fix Plan

## Bug 1: General Tab Chat Doesn't Persist (but Canvas Does)

**Diagnosis:**
The issue is a race condition during initial workspace load. In `onMount`:

1. `loadWorkspaces()` runs async
2. If no workspaces exist, `createWorkspace('General')` creates the workspace
3. `loadWorkspace(ws.id)` is called to load it
4. The cleanup function (on navigation) calls `handleBeforeUnload()`

The problem: `handleBeforeUnload()` checks `workspaceStore.currentWorkspaceId` to determine if there's a workspace to save to. But if the user navigates away **before** `loadWorkspace` completes (which sets `currentWorkspaceId`), the workspace ID is still null and nothing gets persisted.

The canvas appears to persist because it's restored from `canvas_state` in the workspace record (saved separately), while messages require the workspace ID to be known at navigation time.

**Fix:**
Capture the workspace ID in a local variable immediately when available, and use that in the cleanup handler instead of relying on the store state which might not be set yet.

## Bug 2: Canvas Duplication on Workspace Switch

**Diagnosis:**
In `loadWorkspace()`:

1. Canvas is cleared: `canvasStore.clearAll()`
2. `dispatchedParts = new Set()` is cleared
3. Messages are restored to `chat.messages`
4. Canvas is restored from `workspace.canvas_state`

Then the `$effect` that dispatches blocks from messages fires because `chat.messages` changed. Since `dispatchedParts` was cleared, it re-dispatches all blocks from the restored messages - **duplicating** what was already restored from `canvas_state`.

Two sources of truth both populate the canvas:

- `canvas_state` from the workspace (correct restoration)
- `$effect` iterating through `chat.messages` (incorrectly re-adds blocks)

**Fix:**
After restoring messages in `loadWorkspace`, populate `dispatchedParts` with all tool part keys from the restored messages. This prevents the `$effect` from re-dispatching blocks that are already represented in the restored canvas state.

## Files to Modify

1. `src/routes/chat/+page.svelte` - Fix both bugs

## Implementation

### Bug 2 Fix (in `loadWorkspace`):

```typescript
// After restoring messages, populate dispatchedParts to prevent re-dispatch
if (result.messages.length > 0) {
	// ... restore messages ...

	// Mark all tool parts as already dispatched to prevent duplication
	for (const msg of result.messages) {
		if (msg.role !== 'assistant') continue;
		const parts = Array.isArray(msg.parts) ? msg.parts : [];
		for (const part of parts) {
			if ((part as Record<string, unknown>)?.type?.startsWith('tool-')) {
				const p = part as Record<string, unknown>;
				const partKey = `${msg.id}-${p.toolInvocationId ?? p.toolName ?? p.type}`;
				dispatchedParts.add(partKey);

				// Also mark companion blocks
				const companions = extractCompanionBlocks(p);
				for (let ci = 0; ci < companions.length; ci++) {
					dispatchedParts.add(`${partKey}-companion-${ci}`);
				}
			}
		}
	}
}
```

### Bug 1 Fix (in `onMount` cleanup):

```typescript
// Capture workspace ID at mount time, update when it changes
let activeWorkspaceId: string | null = null;
$effect(() => {
	activeWorkspaceId = workspaceStore.currentWorkspaceId;
});

// In cleanup, use captured ID instead of store
const handleBeforeUnload = () => {
	const wsId = activeWorkspaceId; // Use captured ID
	if (!wsId) return;
	// ... rest of save logic
};
```

## Testing

1. **Bug 1:** Open chat, ensure General workspace loads, type messages, navigate to /roast, return to /chat - messages should persist
2. **Bug 2:** Create multiple workspaces with canvas blocks, switch between them - canvas should not duplicate blocks
