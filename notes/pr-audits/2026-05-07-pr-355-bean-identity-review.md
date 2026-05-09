# PR #355 Verify Audit: Bean Identity Candidate Review Foundation

VERDICT: ready
P0: 0
P1: 0
P2: 1
P3: 1
NEXT_ACTION: merge
TOP_FIXES:
- Before any UI, scraper, or automation caller uses these helpers for production review actions, wrap link/identity/event transitions in a single database transaction or RPC so audit events cannot drift from state transitions.
- Replace the manual `database.types.ts` additions with generated Supabase types when typegen is available.
CONFIDENCE: medium
SCOPE_ASSESSMENT: mergeable_with_followups
VALIDATION_STATUS:
- CI Code Quality run 25492544291: VALIDATION_PASS
- CI Playwright run 25492544249: VALIDATION_PASS
- pnpm exec vitest run src/lib/server/beanIdentity.test.ts in verify worktree: VALIDATION_BLOCKED_ENV, temp worktree has no local node_modules and cross-worktree Vite/PostCSS resolution cannot find tailwindcss
- Implementer local fallback Vitest for beanIdentity.test.ts: VALIDATION_PASS
- Implementer local pnpm check --fail-on-warnings with dummy env: VALIDATION_PASS
- Implementer local pnpm run lint: VALIDATION_PASS

## Summary

PR #355 implements the intended persistence/review foundation for canonical bean identity candidates. The slice is independently coherent: it adds auditable tables, service-role-only RLS, append-only event enforcement, server helpers, and tests without exposing public UI or auto-linking behavior. It can merge even if future scraper automation, review queues, and canonical merged views never ship.

## Evidence reviewed

- `supabase/migrations/20260507_bean_identity_candidate_review.sql`
- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- `src/lib/types/database.types.ts`
- `notes/implementation-plans/2026-05-06-canonical-match-disambiguation-and-performance-pr-03-identity-candidate-review-foundation.md`
- `.verify-pr/20260507T112216Z-HEAD/full.diff`

## Findings

### P2: Review transitions are not transactional yet

`acceptBeanIdentityLink()`, `rejectBeanIdentityLink()`, and `supersedeBeanIdentityLink()` update link state, update identity state, then insert the audit event through separate Supabase calls in `src/lib/server/beanIdentity.ts`. If the event insert fails after the state updates succeed, the helper can leave accepted/rejected/superseded state without the corresponding audit row.

This does not block this foundation PR because no UI, scraper, or automation caller is wired yet, and the migration itself makes `bean_identity_events` append-only. But before production review actions call these helpers, transitions should move into a SQL RPC or another transaction boundary that updates link state, identity state, and event insertion atomically.

### P3: Database types were manually updated

The PR body calls this out. The manual additions appear internally consistent with the migration, but generated Supabase type output should replace them when typegen is available to avoid schema drift.

## Acceptance criteria check

- One active accepted identity per catalog row: satisfied by `bean_identity_links_one_active_accepted_per_catalog_idx` plus helper-level duplicate checks.
- Candidate/rejection history retained: satisfied by link statuses, inactive rejected links, tests covering rejected candidate history, and no destructive deletes in helpers.
- Append-only events: satisfied at database level by update/delete prevention triggers on `bean_identity_events`; helper support exists for create, accept, reject, supersede, merge, split, and note actions.
- Candidate snapshots include classifier version/reason context: satisfied by `classifier_version`, `dimension_scores`, `blockers`, `proof_summary_snapshot`, `reason_codes`, and event payload snapshots.
- No UI auto-promotion: satisfied. Changed files are migration, server helper, tests, and database types only.

## Product alignment

This is the right layer for PR03. It separates durable identity memory from fuzzy recommendation output and avoids direct `coffee_catalog.bean_identity_id` denormalization. That preserves the product vision distinction between similarity, identity candidates, and accepted canonical truth.
