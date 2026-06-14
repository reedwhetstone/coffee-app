# PR #390 verification: chat persistence follow-up

**Date:** 2026-06-14  
**Branch:** `fix/chat-persistence-followup`  
**Base:** `origin/main`  
**Head:** `dd76466`  
**Verdict:** `ready_with_fixes`

## Operator summary

```text
VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 0
P3: 1
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Do not send synthetic identical `client_created_at` values from `buildPersistedMessages`; omit the field unless the message has a real creation time, or assign a per-batch monotonic timestamp.
- Add coverage for client-built batch payload timestamps, not only server acceptance of a supplied timestamp.
CONFIDENCE: medium
SCOPE_ASSESSMENT: mergeable_with_followups
VALIDATION_STATUS:
- git diff --check origin/main...HEAD: VALIDATION_PASS
- pnpm test -- 'src/routes/api/workspaces/[id]/messages/route.test.ts' --runInBand: VALIDATION_BLOCKED_ENV, `node_modules` is absent in this clean worktree and `vitest` is not found
```

## Scope and intent coverage

The PR is a coherent follow-up slice. It does address two of the stated gaps:

- Message payload construction is now shared between the unload `sendBeacon` path and the normal debounced save path via `buildPersistedMessages` in `src/lib/components/chat/ChatWorkspace.svelte`.
- `workspace_messages.canvas_mutations` is no longer always empty for normal client saves. `buildMessageCanvasMutations` reconstructs the mutations produced by assistant tool parts, including `present_results` explicit mutations and non-present-results block additions.
- Server persistence now accepts and stores `canvas_mutations`, `client_message_id`, and `client_created_at` in a single batch row construction path while preserving the PR #389 upsert conflict target.

The remaining blocker is the timestamp implementation. The PR intends to avoid same-timestamp rows in saved batches, but the current client code can still manufacture same-timestamp batch rows and override the server's monotonic fallback.

## Findings

### P1: Client fallback timestamps can defeat the server's per-row ordering fix

**Evidence:**

- `buildPersistedMessages` reads `(msg as { createdAt?: unknown }).createdAt`, then falls back to `new Date()` and always sends `client_created_at` (`src/lib/components/chat/ChatWorkspace.svelte:398-406`).
- The server only applies its monotonic `Date.now() + index` fallback when `msg.client_created_at` is absent (`src/routes/api/workspaces/[id]/messages/+server.ts:214-222`).
- The routes that reload messages still order only by `created_at` (`src/routes/api/workspaces/[id]/+server.ts:35-40`, `src/routes/chat/+page.server.ts:40-45`), so equal timestamps continue to risk unstable ordering on restore.
- AI SDK v6's documented UI message shape is `id`, `role`, `parts`, and optional `metadata`; it does not document a top-level `createdAt`. That makes the fallback path the likely production path for fresh messages.

**Why it matters:**

If a user and assistant message are saved together and fresh AI SDK messages do not have top-level `createdAt`, `buildPersistedMessages` stamps them at persistence time. In a tight `.map`, those `new Date()` calls can share the same millisecond. Because the client sends the field, the server stores those duplicated timestamps instead of using its `Date.now() + index` sequence. That is the exact failure mode this PR is supposed to close.

**Concrete fix:**

Prefer one of these same-PR patches:

1. Only include `client_created_at` when the message has a real creation timestamp. If absent, omit it and let the server's per-index fallback run.
2. Or generate a monotonic per-batch sequence in `buildPersistedMessages`, e.g. capture `const batchBaseMs = Date.now()` once and use `new Date(batchBaseMs + index).toISOString()` only for messages without a real timestamp.
3. Longer-term, store a durable `createdAt` in UI message metadata when messages are first observed, then persist that stable value.

Whichever path is chosen, add a client-side or extracted-helper test that passes two messages without `createdAt` and asserts distinct, ordered timestamps or omitted `client_created_at` fields.

### P3: Coverage verifies server acceptance, not the new client payload builder

The added test proves the server stores a caller-supplied `canvas_mutations` and `client_created_at`. It does not prove `ChatWorkspace.svelte` actually produces correct canvas mutations or safe timestamp fields from real AI SDK messages.

This is acceptable as a lower-priority coverage gap if the P1 timestamp behavior is fixed, but the current regression would have been caught by a helper-level test for `buildPersistedMessages` or an extracted payload builder.

## Non-findings checked

- **Canvas mutations:** The extraction path mirrors the existing render dispatch logic closely: `present_results` returns explicit `replace`/`add`/`clear`/`layout` mutations, while ordinary renderable tool outputs are converted to `add` mutations and companion blocks are included. I did not find a confirmed mismatch in mutation semantics.
- **De-dupe/upsert behavior:** The server still uses `upsert(..., { onConflict: 'workspace_id,client_message_id', ignoreDuplicates: true })`, and the existing prefix-overlap logic remains in place.
- **Prompt budget:** The existing 24-message client request slice and server-side prompt budget checks were not changed by this PR.
- **Product direction:** This is infrastructure for the conversational/agentic interface layer and aligns with the Product Vision's API-first and agentic workflow direction.

## Validation

- `git diff --check origin/main...HEAD`: pass.
- `pnpm test -- 'src/routes/api/workspaces/[id]/messages/route.test.ts' --runInBand`: blocked because this clean worktree has no `node_modules`; `vitest` is not available. No dependency install was attempted.

## Mergeability

Do not merge as-is. The PR boundary is right and the fix is small, but the timestamp bug is a direct miss on the stated intent. Patch the timestamp payload behavior in the same PR and add one focused regression test, then re-run the route/helper tests in an environment with dependencies.
