# PR #388 Re-verify: Chat single conversation cleanup

Generated: 2026-06-11 16:30 UTC

## Verdict

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 1
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

The same-PR patches addressed the prior P1/P2 findings. The PR is independently mergeable: it removes the client-controlled workspace-memory path from `/api/chat`, explicitly locks archive tables to service-role/DBA access, validates message persistence as bounded arrays with JSON-size limits, and returns 400 for malformed message JSON. Local typecheck and formatting pass after providing dummy static-env exports. Unit route tests remain blocked by this clean worktree's test setup resolving to an absent node_modules path outside `/tmp`.

## Prior findings re-check

### Prior P1-1: Client-controlled workspace memory accepted by `/api/chat`

**Status:** fixed.

Evidence:

- `src/routes/api/chat/+server.ts:142-150` changed `workspaceContextSchema` to accept `id`, `type`, `includeMemory`, and `canvasDescription`; it no longer accepts or transforms a client-supplied `summary`.
- `src/lib/components/chat/ChatWorkspace.svelte:213-220` now sends the workspace id and an `includeMemory` preference instead of sending `ws.context_summary` as prompt memory.
- `src/routes/api/chat/+server.ts:460-487` constructs a server-side `WorkspaceContext` and only fills `summary` after fetching `workspaces.id/type/context_summary` with both `.eq('id', clientWorkspaceContext.id)` and `.eq('user_id', user.id)`.
- `_buildSystemPrompt` still injects `WORKSPACE MEMORY` only from `workspaceContext.summary`, but that value is now server-resolved from the authenticated user's workspace row.

Residual note: `canvasDescription` and `pageContext` remain client-supplied descriptive context. That is consistent with existing comments and tool-access enforcement, and is separate from the trusted workspace-memory claim the prior P1 targeted.

### Prior P1-2: Archive tables lacked explicit access hardening

**Status:** fixed.

Evidence:

- `supabase/migrations/20260611_single_chat_workspace_cleanup.sql:50-55` enables RLS on both archive tables, revokes all table privileges from `PUBLIC`, `anon`, and `authenticated`, and grants table privileges to `service_role`.
- No user-facing archive SELECT policy is introduced, which matches the stated decision that recovery should go through an explicit server-controlled flow.

This is the correct safety posture for archived private chat history in the Supabase `public` schema.

### Prior P2-1: `parts` and `canvas_mutations` were size-bounded but not array-bounded

**Status:** fixed for the stated requirement.

Evidence:

- `src/routes/api/workspaces/[id]/messages/+server.ts:10-17` adds `boundedJsonArraySchema = z.array(z.unknown()).max(100)` and applies it to `parts` and `canvas_mutations`.
- `src/routes/api/workspaces/[id]/messages/+server.ts:19-23` requires either a bounded batch of persisted messages or a single persisted message.
- `src/routes/api/workspaces/[id]/messages/+server.ts:62-71` enforces a serialized JSON-size cap for both fields before insert.

This still intentionally allows arbitrary object shapes inside each array element, which is reasonable for AI SDK part compatibility. The prior minimum requested arrays, element count caps, and scalar/object-root rejection; the patch satisfies that.

### Prior P2-2: Malformed message JSON returned 500

**Status:** fixed.

Evidence:

- `src/routes/api/workspaces/[id]/messages/+server.ts:39-43` catches request JSON parse failures and returns `400 { error: 'Invalid JSON payload' }` before schema validation.
- Schema failures return `400 { error: 'Invalid message payload' }` at `src/routes/api/workspaces/[id]/messages/+server.ts:45-49`.

## Additional integration review

### Single-workspace API behavior

- `GET /api/workspaces` now limits to the most recent one workspace, consistent with the single continuous chat model.
- `POST /api/workspaces` is now get-or-create and includes a race-safe fallback on PostgreSQL unique violation `23505`.
- The migration adds `workspaces_one_per_user_key UNIQUE (user_id)` after archiving non-canonical rows, preventing the old multi-workspace path from re-accumulating active duplicates.
- `DELETE /api/workspaces/[id]` returns 405, which is coherent for the single-chat persistence model. `DELETE /messages` still clears the conversation within the one workspace, so the user-visible clear path is preserved.

### Message ordering and persistence

- `GET /api/workspaces/[id]`, `POST /api/workspaces/[id]/summarize`, and `/chat` page prefetch all fetch newest messages with descending order and reverse to chronological order before display/summarization. This preserves the recent 50/30 limit while avoiding the previous oldest-message bias.
- `workspaceStore.createWorkspace` now dedupes by id before appending, which prevents a local duplicate when the server returns an existing workspace.

### Migration recoverability

- Non-canonical and null-user workspaces are archived before deletion.
- Message rows for archived workspaces are inserted into `archived_chat_workspace_messages` before `DELETE FROM public.workspaces`; the existing FK uses `ON DELETE CASCADE`, so deleting archived workspaces should remove their active messages after they are copied.
- Canonical selection by message count, recency, then deterministic tie-breakers is a reasonable one-time cleanup rule.

## Findings

### P3-1: Add regression tests for the patched security/validation paths when the test harness is healthy

**Status:** non-blocking follow-up.

The code now satisfies the prior findings, but there are no new regression tests in this branch for:

- forged `workspaceContext.summary` not being accepted by `/api/chat`,
- malformed JSON to `/api/workspaces/[id]/messages` returning 400,
- scalar/object-root `parts` or `canvas_mutations` being rejected.

I did not mark this as blocking because the branch is coherent and the current clean worktree cannot run even existing targeted Vitest files due to the test setup resolving `@testing-library/svelte` from `/root/.openclaw/workspace/repos/coffee-app/node_modules/...`, which is absent from this `/tmp` checkout. Add route-level tests in a follow-up or before merge if CI has the correct dependency layout and this is easy to cover.

## Validation

- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `SUPABASE_SERVICE_ROLE_KEY=dummy PUBLIC_SUPABASE_URL=http://localhost PUBLIC_SUPABASE_ANON_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm check`: VALIDATION_PASS, `svelte-check found 0 errors and 0 warnings`.
- `pnpm exec prettier --check <changed TS/Svelte route files>`: VALIDATION_PASS.
- `SUPABASE_SERVICE_ROLE_KEY=dummy PUBLIC_SUPABASE_URL=http://localhost PUBLIC_SUPABASE_ANON_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm exec vitest run src/routes/api/chat/route.test.ts`: VALIDATION_BLOCKED_ENV. Vitest resolves `@testing-library/svelte/src/vitest.js` to `/root/.openclaw/workspace/repos/coffee-app/node_modules/...`, which does not exist from this `/tmp/coffee-chat-cleanup` worktree.
- `SUPABASE_SERVICE_ROLE_KEY=dummy PUBLIC_SUPABASE_URL=http://localhost PUBLIC_SUPABASE_ANON_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm exec vitest run src/lib/stores/workspaceStore.svelte.test.ts`: VALIDATION_BLOCKED_ENV for the same dependency-path resolution issue.

## Mergeability assessment

Ready for merge. The prior P1/P2 defects are fixed in the intended layer, the migration is access-hardened, and the PR boundary remains correct. The only follow-up I would carry is regression-test coverage once the clean-worktree Vitest setup is runnable.
