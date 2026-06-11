# PR #388 Verify: Chat single conversation cleanup

Generated: 2026-06-11 16:14 UTC

## Verdict

VERDICT: fail
P0: 0
P1: 2
P2: 2
P3: 0
NEXT_ACTION: patch_same_pr
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

The slice boundary is basically right: the PR can be made independently mergeable with targeted fixes in the same branch. It should not merge as-is because one explicit red-team requirement is still not satisfied, and the migration introduces sensitive archive tables without explicit access hardening.

## P1 findings

### P1-1: Client-controlled workspace memory is still accepted by `/api/chat` and injected into the system prompt

**Status:** confirmed defect.

The PR intent explicitly says client-controlled `context_summary` should not become prompt memory. The patch removes `context_summary` from `PUT /api/workspaces/[id]`, which prevents one ordinary persistence path, but `/api/chat` still trusts the client-provided `workspaceContext.summary`.

Evidence:

- `src/lib/components/chat/ChatWorkspace.svelte:215-218` builds `workspaceContext.summary` from the client-side store.
- `src/lib/components/chat/ChatWorkspace.svelte:735-736` sends that object in every chat request body.
- `src/routes/api/chat/+server.ts:142-148` validates the client-supplied summary as a bounded string.
- `src/routes/api/chat/+server.ts:365-371` reads `body.workspaceContext` directly from the request.
- `src/routes/api/chat/+server.ts:296-298` appends that summary as `WORKSPACE MEMORY` in the model prompt.

A malicious or compromised client can still POST an arbitrary `workspaceContext.summary` and have it framed as previous conversation memory. That is the exact layer the red-team requirement was trying to close.

**Correction:** do not accept `workspaceContext.summary` from the client. Prefer one of:

1. Add a `workspaceId` field to the chat request, verify ownership server-side, fetch `context_summary/type/canvas_state` from Supabase, and build the trusted workspace memory on the server.
2. If the chat endpoint should not fetch workspace state yet, strip `summary` from `workspaceContextSchema` and only keep client-side descriptive context that is clearly labeled as untrusted display context.

Add a route test proving a forged `workspaceContext.summary` is not included in `_buildSystemPrompt` or in the request path used by `POST /api/chat`.

### P1-2: Archive tables for deleted chat history are created in `public` without explicit RLS or grants hardening

**Status:** confirmed hardening gap; exposure impact depends on Supabase default privileges, but the migration should not rely on defaults for archived chat content.

The migration creates `public.archived_chat_workspaces` and `public.archived_chat_workspace_messages` containing `context_summary`, `canvas_state`, `content`, `parts`, and `canvas_mutations` (`supabase/migrations/20260611_single_chat_workspace_cleanup.sql:20-47`). It does not enable RLS, define policies, or explicitly revoke/grant privileges.

Existing live chat tables are protected by RLS in `001_full_schema.sql`, but the archive tables are omitted from equivalent controls. Because this is sensitive private conversation history and the tables live in Supabase's exposed `public` schema, the migration should explicitly lock them down instead of assuming they are unreachable.

**Correction:** in the same migration, add explicit archive-table access policy. Minimal safe option:

- `ALTER TABLE public.archived_chat_workspaces ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE public.archived_chat_workspace_messages ENABLE ROW LEVEL SECURITY;`
- `REVOKE ALL ON public.archived_chat_workspaces, public.archived_chat_workspace_messages FROM anon, authenticated;`
- `GRANT ALL ON public.archived_chat_workspaces, public.archived_chat_workspace_messages TO service_role;`

If user self-service recovery is intended, add narrowly scoped `SELECT` policies by `auth.uid() = user_id` for workspace archives and an `EXISTS` join to archived workspaces for messages. Do not leave archive access implicit.

## P2 findings

### P2-1: Message payload validation is size-bounded but not meaningfully schema-bounded for `parts` or `canvas_mutations`

**Status:** confirmed partial intent coverage.

The message endpoint now validates `role`, `content`, batch size, and serialized JSON size (`src/routes/api/workspaces/[id]/messages/+server.ts:11-16`, `57-66`). However, both `parts` and `canvas_mutations` remain `z.unknown()`, so arbitrary JSON shapes can still be stored as long as they are under 200,000 serialized characters.

That is better than the previous unbounded write path, but it only partially satisfies “schema/size validated” persisted writes.

**Correction:** define permissive but real JSON schemas for the shapes the app emits. For example:

- `parts`: array of known AI SDK part-like objects with bounded `type`, bounded text, and passthrough only for known safe block/result structures.
- `canvas_mutations`: array of bounded mutation objects, or explicitly store an empty array until mutation persistence is wired.

At minimum, require `parts` and `canvas_mutations` to be arrays, cap element count, and reject scalar/object roots.

### P2-2: Invalid JSON in message persistence still returns a 500 instead of a client error

**Status:** confirmed edge-case defect.

`src/routes/api/workspaces/[id]/messages/+server.ts:38` calls `await event.request.json()` outside a parse-specific guard. Malformed JSON falls through the outer catch and returns a 500. The route otherwise treats invalid payloads as 400 at lines 39-43, so malformed JSON should be consistent.

**Correction:** mirror the safer pattern used by `POST /api/workspaces`, e.g. catch JSON parse failure and return `400 { error: 'Invalid JSON payload' }` before schema validation.

## Positive findings

- PPI-only users should now persist chat history across the main touched paths: `/chat` prefetch uses `ppiAccess || member`, and workspace APIs now use `requireChatAccess` instead of `requireMemberRole`.
- Latest-message retrieval was corrected in both server prefetch and workspace GET: fetch newest 50 descending, then reverse before rendering.
- `POST /api/workspaces` now behaves as get-or-create and the client store dedupes by id, which prevents duplicate local rows when the server returns an existing workspace.
- `DELETE /api/workspaces/[id]` is disabled with 405, consistent with the single-chat product model.
- The migration canonicalizes by highest message count, then recency, which is a reasonable preservation rule for old multi-workspace data.

## Validation

- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `pnpm check`: VALIDATION_BLOCKED_ENV. The clean worktree lacks env-backed SvelteKit static exports: `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `pnpm exec vitest run src/lib/stores/workspaceStore.svelte.test.ts`: VALIDATION_BLOCKED_ENV. The runner attempted to load `@testing-library/svelte/src/vitest.js` from `/root/.openclaw/workspace/repos/coffee-app/node_modules/...`, which is not available from this `/tmp` worktree dependency path.

## Mergeability assessment

Do not merge before patching P1-1 and P1-2. The branch is otherwise coherent and does not need a broader rescope. The right next move is a same-PR patch plus re-verify.
