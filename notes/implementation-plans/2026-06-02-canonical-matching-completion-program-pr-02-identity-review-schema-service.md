# PR 02: Identity Review Schema and Service

**Parent plan:** `2026-06-02-canonical-matching-completion-program.md`
**Branch suggestion:** `feat/bean-identity-review-service`
**Purpose:** Persist canonical identity candidates, accepted/rejected links, and audit events.

## PR goal

Add the reversible persistence layer for canonical green coffee identity decisions. The app should be able to remember candidate, accepted, rejected, superseded, and event history without mutating `coffee_catalog` rows.

## Why this slice comes now

The similarity contract is already beta-useful. Once source-aware filtering is in place, the next bottleneck is memory: reviewed matches should not disappear after a panel closes, and rejected false positives should not keep returning as fresh candidates.

## Mergeable-slice gate

This PR is mergeable even if no new UI or scraper automation ships. It creates durable review memory and testable constraints that future surfaces can safely consume.

## In scope

- Add additive migrations for `bean_identities`, `bean_identity_links`, and `bean_identity_events`.
- Include statuses such as `candidate`, `accepted`, `rejected`, and `superseded`.
- Store classifier version, source labels, dimension scores, blockers, confidence, proof summary snapshot, and review notes where appropriate.
- Prevent a catalog row from having multiple active accepted identity links.
- Add server helpers for creating candidates, accepting, rejecting, superseding, reading identity state, and appending events.
- Add tests for constraints, event writes, rejection memory, and reversible status changes.

## Out of scope

- Member-facing review UI.
- Scraper candidate submission.
- Auto-linking.
- Public identity pages.
- CLI changes.

## Files to change

- `supabase/migrations/*_bean_identity_review.sql`
- `src/lib/types/database.types.ts`
- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- Optional route tests only if internal review endpoints are needed in this PR

## Acceptance criteria

- A `coffee_catalog` row can have at most one active accepted identity link.
- Rejected candidates remain queryable and can be used to suppress future unreviewed suggestions.
- Every create, accept, reject, supersede, merge, split, or note action writes an append-only event.
- Stored candidate records include classifier/source metadata sufficient to reconstruct why the candidate existed.
- No public/member route changes are required for the schema to be useful.

## Test plan

```bash
pnpm exec vitest run src/lib/server/beanIdentity.test.ts
pnpm check --fail-on-warnings
pnpm run lint
```

SQL smoke when env permits:

- duplicate active accepted link is rejected
- rejected candidate can coexist historically with later superseded state
- event rows are written transactionally with state changes

## Risks

- Schema can overfit the first classifier. Use stable top-level fields plus versioned JSON snapshots.
- Direct `coffee_catalog.bean_identity_id` would be simpler but less auditable. Keep link/event tables first.

## Exact follow-on dependency

PR 03 reads this state through member/API endpoints and comparison UI.
