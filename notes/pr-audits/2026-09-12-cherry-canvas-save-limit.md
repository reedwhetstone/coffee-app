# Cherry canvas save-size recovery

## Outcome

Fix the save failure reported while adding a coffee from Cherry. Inventory execution and evidence persistence are separate requests: the inventory operation can succeed while `PUT /api/workspaces/:id/canvas` rejects a canvas over 200,000 serialized characters. The previous autosave loop retried that permanently invalid payload indefinitely.

Large evidence snapshots now have a self-contained, lossless gzip/base64 representation. The server and database limits are unchanged. Terminal errors stop timed retries, remain visibly unsaved, and recover when the user changes evidence. Reverting to the already-saved state clears the obsolete warning without another write.

**Rollout boundary:** compressed writes are disabled by default. The compatible readers, terminal-error handling, and size preflight can ship first. Enabling compression requires the deployment sequence below; merging alone does not enable large-canvas saves.

## Root cause and ownership

- An add-inventory proposal includes catalog dropdown options and an ID-to-supplier map. Both are required for editing after reload. Multiple retained proposals duplicate these lookup tables in the canvas snapshot.
- Parchment owns the opaque, version-fenced conversation state. Coffee-app owns its rendering representation. No API, SDK, SQL migration, auth change, or inventory-execution change is needed.
- Parchment's 200,000-character contract and 250,000-byte database bound remain in place. Encoded envelopes are bounded to the existing HTTP limit. Decoded UTF-8 input/output is bounded to 2,000,000 bytes.
- Small snapshots keep their existing representation. Larger snapshots preserve all fields, choices, source mappings, pinned blocks, ordering, focus, titles, execution IDs, statuses, and receipts.
- Source-message references were rejected: normal reload only retrieves the latest 50 messages, so old pinned evidence must remain self-contained.
- The shared BFF workspace adapter and canvas response decode envelopes before returning normal blocks to page loaders and browser clients. Invalid encodings fail closed, and automatic/unload writes require successful workspace initialization.
- All browser save paths use the same encoder, including conflict retries and unload beacons. The existing serialized save queue, reset epoch, and canvas version remain authoritative.

## Reader-first deployment and rollback

This PR intentionally does **not** assume a preview is isolated from production conversation storage.

1. Merge/deploy this PR with `CHERRY_COMPRESSED_CANVAS_WRITES` unset or false. Confirm a normal save and reload works; the returned workspace must not advertise `canvas_compression_enabled`.
2. Redeploy every supported preview using the same conversation storage with this reader code, or retire/protect incompatible previews so they cannot write those workspaces. This includes the older compact-chat preview from PR #613 if it remains in use. Do not enable encoded writes in an isolated new preview while production/other reachable previews still use old readers.
3. After that compatibility boundary is verified, explicitly set the server-only deployment variable `CHERRY_COMPRESSED_CANVAS_WRITES=true` on the supported deployment and deploy. New workspace reads advertise the capability; both browser writes and the server write endpoint enforce it.
4. Reload the browser to obtain that capability. Using a test workspace, add enough synthetic retained proposals to cross the former cap, save, reload, and verify complete dropdowns, pinned old evidence, and a completed action receipt. Verify no repeated 413s. Do not repeat a real inventory write merely to check canvas persistence.
5. An older already-open browser tab calling an upgraded BFF continues to receive ordinary decoded blocks. It may still fail to save an oversized uncompressed canvas until reloaded, but it will not mistake the compressed envelope for an empty canvas.

To stop new compressed writes, disable the flag and redeploy **without removing the reader**. Never roll back to a reader-incompatible build after envelopes have been saved. Reader removal would require an explicit, separately reviewed data conversion first. No workspace data was read or mutated to prepare this PR, and no production or preview deployment was changed.

## Validation

`VALIDATION_PASS`: 82 focused tests across 8 files:

```sh
pnpm test src/lib/services/canvasPersistence.test.ts src/lib/stores/workspaceStore.svelte.test.ts 'src/routes/api/workspaces/[id]/canvas/route.test.ts' src/lib/server/parchmentConversation.canvas.test.ts src/lib/components/chat/ChatWorkspace.recovery.svelte.test.ts src/lib/stores/canvasStore.svelte.test.ts src/lib/components/genui/blocks/ActionCardBlock.svelte.test.ts src/lib/services/chatPersistence.test.ts
```

Coverage includes the actual ChatWorkspace terminal-413 timer behavior, subsequent edits, unload encoding, legacy reads, 409 recovery without double encoding, reader-only write rejection, corrupt/forged/oversized envelopes, Unicode, historical pinned evidence, and existing action/recovery behavior.

The realistic 5,000-coffee fixture shrinks from **590,173 to 57,790 serialized characters**, a **90.21% reduction**, with an exact JSON round trip. This is synthetic evidence, not a capture of the reported user's canvas.

`VALIDATION_PASS`: `pnpm check --fail-on-warnings`, `pnpm lint`, and `git diff --check`.

Static checks use repository example env values. Local toolchain: Node 24.19.0/pnpm 10.33.0 versus declared Node 22. Authenticated deployed persistence, browser beacon delivery at platform byte limits, and the actual user's payload are not verified. The unload test proves the constructed request, not delivery after tab closure. The existing per-message size limit and unsent-draft durability are outside this fix.

## Focused review

Independent review identified one material mixed-deployment risk: an older reader could interpret the new representation as a missing canvas, then overwrite historical evidence. The default-off browser/server capability gate and reader-first rollout close that finding for this release. Reassessment found no remaining blockers. Verdict: ready for PR handoff, with compressed writes still subject to the documented activation prerequisite. No merge or deployment is authorized by this review.
