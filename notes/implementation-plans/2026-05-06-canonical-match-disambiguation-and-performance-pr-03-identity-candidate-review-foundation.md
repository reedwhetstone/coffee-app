# PR 03: Identity Candidate Review Foundation

**Branch suggestion:** `feat/bean-identity-candidate-review`  
**Parent plan:** `2026-05-06-canonical-match-disambiguation-and-performance.md`  
**Purpose:** Persist candidate, accepted, and rejected identity decisions only after the matching contract is hard-gated and calibrated.

## PR goal

Add reversible identity-candidate storage and audit events for canonical green coffee matching. This PR should not auto-link scraper results yet. It creates the safe persistence layer for human-reviewed or future pipeline-proposed identity candidates.

## Why this slice comes third

Identity storage is valuable, but storing bad identity links is worse than having no identity model. PR 01 must first prevent obvious false identity claims, and PR 02 must seed calibration. Then persistence can safely capture candidate and rejection decisions.

## Mergeable-slice gate

This PR is mergeable even if scraper automation and canonical merged views never ship. It gives the product a durable review memory: accepted and rejected candidates stop being ephemeral UI observations.

## In scope

- Add additive migration(s) for:
  - `bean_identities`
  - `bean_identity_links`
  - `bean_identity_events`
- Support statuses such as `candidate`, `accepted`, `rejected`, and `superseded`.
- Store classifier version, dimension scores, blockers, and proof summary snapshot on candidate links.
- Add constraints preventing multiple active accepted identities for one catalog row.
- Add server helpers for creating candidates, accepting, rejecting, superseding, and reading identity state.
- Add tests for reversibility and duplicate accepted-link prevention.

## Out of scope

- Scraper post-ingestion candidate generation.
- Automatic high-confidence linking.
- Public identity pages.
- Canonical merged view UI.
- Supplier claim or verification flows.

## Files to change

Likely coffee-app files:

- `supabase/migrations/*_bean_identity_candidate_review.sql`
- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- `src/lib/types/database.types.ts`
- Optional internal route helpers if an admin/review surface is added later

## Acceptance criteria

- A catalog row can have at most one active accepted identity link.
- Candidate and rejection records can coexist historically without destructive deletion.
- Events are append-only for create, accept, reject, supersede, merge, split, and note actions.
- Stored candidate records include the classifier version and reason codes used at proposal time.
- No public or member UI auto-promotes candidates solely because the table exists.

## Test plan

```bash
pnpm check --fail-on-warnings
pnpm run lint
pnpm exec vitest run src/lib/server/beanIdentity.test.ts
```

SQL smoke checks should verify:

- duplicate active accepted link is rejected
- rejected candidate can be retained and respected later
- event rows are written for state changes

## Risks

- Schema can overfit early classifier output. Mitigate by storing versioned JSON snapshots plus stable top-level fields.
- Direct `coffee_catalog.bean_identity_id` is tempting but less auditable. Use links and events first; denormalize later only if query performance demands it.

## Exact follow-on dependency

PR 04, scraper candidate proposal pipeline, should use this schema to create candidates and respect rejections. Auto-linking remains disabled until the calibrated high-confidence band earns it.
