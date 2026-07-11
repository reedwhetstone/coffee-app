# PR #390 re-verification: chat persistence follow-up

**Date:** 2026-06-14
**Branch:** `fix/chat-persistence-followup`
**Base:** `origin/main`
**Head:** `47072be`
**Verdict:** `ready_with_fixes`

## Operator summary

```text
VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 0
P3: 1
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Strip trailing whitespace from the prior audit report before merge; the timestamp and persistence code fixes are otherwise merge-ready.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_with_trivial_cleanup
VALIDATION_STATUS:
- GitHub PR checks for #390: VALIDATION_PASS, CodeQL, Format/Check/Lint, test, Vercel, and Code Quality analysis all pass on the current PR head.
- git diff --check origin/main...HEAD: VALIDATION_FAIL, trailing whitespace in notes/pr-audits/2026-06-14-pr390-chat-persistence-followup.md lines 3-6.
- Focused local tests: VALIDATION_BLOCKED_ENV, node_modules is absent in this clean worktree, so `pnpm test -- src/lib/services/chatPersistence.test.ts 'src/routes/api/workspaces/[id]/messages/route.test.ts' --runInBand` was not run locally.
```

## Re-verification result

The previous P1 timestamp defect is fixed.

- `buildPersistedChatMessages` now omits `client_created_at` unless the UI message carries a real `Date` instance at `createdAt` (`src/lib/services/chatPersistence.ts:68-92`). It no longer synthesizes same-millisecond client timestamps for fresh AI SDK messages.
- The new helper test covers the exact client-side regression case: two messages without `createdAt` produce payloads with no `client_created_at` field (`src/lib/services/chatPersistence.test.ts:5-24`). It also verifies real `Date` timestamps are preserved (`src/lib/services/chatPersistence.test.ts:26-37`).
- The server fallback remains per-insert-row when the client omits timestamps: `created_at: msg.client_created_at ?? new Date(Date.now() + index).toISOString()` (`src/routes/api/workspaces/[id]/messages/+server.ts:214-222`). The route test pins `Date.now()` and verifies adjacent rows receive `.000Z` and `.001Z` fallback values (`src/routes/api/workspaces/[id]/messages/route.test.ts:177-215`).

The previous P3 coverage gap is acceptably fixed for the timestamp path. The client payload builder now has direct coverage for omission and preservation of timestamps, which is the behavior that failed the prior audit.

## Persistence checks

- Canvas mutations remain wired through the client payload builder. `buildPersistedChatMessages` includes `canvas_mutations: buildMessageCanvasMutations(messages, msg)` for each payload (`src/lib/services/chatPersistence.ts:76-81`).
- The server schema still accepts `canvas_mutations`, validates bounded JSON size, stores it on inserted rows, and preserves caller-supplied values in the route test (`src/routes/api/workspaces/[id]/messages/+server.ts:16-20`, `src/routes/api/workspaces/[id]/messages/+server.ts:174-221`, `src/routes/api/workspaces/[id]/messages/route.test.ts:127-175`).
- The PR #389 de-dupe/upsert behavior remains intact. The server still builds signatures around `client_message_id`, keeps the non-conversation-order prefix fallback, and upserts with `{ onConflict: 'workspace_id,client_message_id', ignoreDuplicates: true }`. Existing retry, repeated-text, non-conversation-order, and overlap-prefix tests remain present.

## Finding

### P3: Prior audit report has trailing whitespace

`git diff --check origin/main...HEAD` fails on trailing whitespace in `notes/pr-audits/2026-06-14-pr390-chat-persistence-followup.md` lines 3-6. This is not a product or code correctness issue, and GitHub's required checks are green, but it is a trivial cleanliness failure in the PR diff.

Recommended fix: strip trailing spaces from those four report lines in the same PR.

## Mergeability

The functional timestamp issue is closed, canvas mutation persistence is still intact, and the PR #389 de-dupe/upsert protection remains intact. After the trivial whitespace cleanup, this PR is ready to merge.
