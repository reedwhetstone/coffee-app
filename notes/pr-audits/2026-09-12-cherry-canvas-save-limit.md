# Cherry canvas save-size recovery

## Outcome

Fix the save failure reported while adding a coffee from Cherry. Inventory execution and evidence persistence are separate requests: the inventory operation can succeed while `PUT /api/workspaces/:id/canvas` rejects a canvas over 200,000 serialized characters. The previous autosave loop retried that permanently invalid payload indefinitely.

Large evidence snapshots now have a self-contained, lossless gzip/base64 representation. The server and database limits are unchanged. Terminal errors stop timed retries, remain visibly unsaved, and recover when the user changes evidence. Reverting to the already-saved state clears the obsolete warning without another write.

**Current delivery behavior:** large canvases compress automatically on ordinary saves and unload saves. The release flag and workspace capability metadata introduced in #614 have been removed. Merge and normal application deployment deliver the feature; there is no environment-variable activation step. See [the correction and current validation](2026-09-12-cherry-canvas-automatic-saves.md).

## Root cause and ownership

- An add-inventory proposal includes catalog dropdown options and an ID-to-supplier map. Both are required for editing after reload. Multiple retained proposals duplicate these lookup tables in the canvas snapshot.
- Parchment owns the opaque, version-fenced conversation state. Coffee-app owns its rendering representation. No API, SDK, SQL migration, auth change, or inventory-execution change is needed.
- Parchment's 200,000-character contract and 250,000-byte database bound remain in place. Encoded envelopes are bounded to the existing HTTP limit. Decoded UTF-8 input/output is bounded to 2,000,000 bytes.
- Small snapshots keep their existing representation. Larger snapshots preserve all fields, choices, source mappings, pinned blocks, ordering, focus, titles, execution IDs, statuses, and receipts.
- Source-message references were rejected: normal reload only retrieves the latest 50 messages, so old pinned evidence must remain self-contained.
- The shared BFF workspace adapter and canvas response decode envelopes before returning normal blocks to page loaders and browser clients. Invalid encodings fail closed, and automatic/unload writes require successful workspace initialization.
- All browser save paths use the same encoder, including conflict retries and unload beacons. The existing serialized save queue, reset epoch, and canvas version remain authoritative.

## Deployment and compatibility

Compression is normal application behavior, not an operator-controlled rollout. Small canvases keep their original JSON representation; large canvases use the bounded lossless codec. Both workspace readers and save responses decode stored envelopes to ordinary blocks.

The current production reader was introduced in merged #614. Its merge commit `a0c7c495` has a successful Vercel deployment status. This correction requires no Parchment/SDK change, database migration, environment setting, or separate activation deployment.

Historical pre-#614 builds do not understand the encoded storage representation. This correction supports the current application, including older browser bundles calling the current server; it does not retrofit immutable historical preview servers. Do not roll production back to a reader predating #614 after encoded states exist. That is a storage-format compatibility constraint, not a feature activation task.

## Original #614 validation (historical)

`VALIDATION_PASS`: 82 focused tests across 8 files:

```sh
pnpm test src/lib/services/canvasPersistence.test.ts src/lib/stores/workspaceStore.svelte.test.ts 'src/routes/api/workspaces/[id]/canvas/route.test.ts' src/lib/server/parchmentConversation.canvas.test.ts src/lib/components/chat/ChatWorkspace.recovery.svelte.test.ts src/lib/stores/canvasStore.svelte.test.ts src/lib/components/genui/blocks/ActionCardBlock.svelte.test.ts src/lib/services/chatPersistence.test.ts
```

Coverage includes the actual ChatWorkspace terminal-413 timer behavior, subsequent edits, unload encoding, legacy reads, 409 recovery without double encoding, reader-only write rejection, corrupt/forged/oversized envelopes, Unicode, historical pinned evidence, and existing action/recovery behavior.

The realistic 5,000-coffee fixture shrinks from **590,173 to 57,790 serialized characters**, a **90.21% reduction**, with an exact JSON round trip. This is synthetic evidence, not a capture of the reported user's canvas.

`VALIDATION_PASS`: `pnpm check --fail-on-warnings`, `pnpm lint`, and `git diff --check`.

Static checks use repository example env values. Local toolchain: Node 24.19.0/pnpm 10.33.0 versus declared Node 22. Authenticated deployed persistence, browser beacon delivery at platform byte limits, and the actual user's payload are not verified. The unload test proves the constructed request, not delivery after tab closure. The existing per-message size limit and unsent-draft durability are outside this fix.

## Original #614 focused review (historical)

The original review, before the no-release-flag correction, identified one material mixed-deployment risk: an older reader could interpret the new representation as a missing canvas, then overwrite historical evidence. The default-off browser/server capability gate and reader-first rollout close that finding for this release. Reassessment found no remaining blockers. Verdict: ready for PR handoff, with compressed writes still subject to the documented activation prerequisite. No merge or deployment is authorized by this review.
