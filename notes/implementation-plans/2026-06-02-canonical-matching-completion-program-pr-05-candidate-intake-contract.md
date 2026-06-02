# PR 05: Candidate Intake Contract for Scraper Pipeline

**Parent plan:** `2026-06-02-canonical-matching-completion-program.md`
**Branch suggestion:** `feat/bean-identity-candidate-intake`
**Purpose:** Prepare coffee-app for conservative scraper-generated identity proposals without changing coffee-scraper in this PR.

## PR goal

Add the coffee-app intake/read contract that a later coffee-scraper pipeline can use to propose candidate identity links after ingestion. This PR should make candidate submission safe, idempotent, audited, and respectful of prior rejections.

## Why this slice comes fifth

Automation should wait until source-aware classification, identity persistence, member reads, and agent semantics are coherent. This PR still stops short of auto-linking; it only makes the app ready to receive proposals.

## Mergeable-slice gate

This PR is mergeable even if coffee-scraper never submits candidates. It gives app-side operators and future jobs a safe, tested proposal path.

## In scope

- Add an internal service or gated endpoint for candidate proposals.
- Require classifier version, target id, candidate id, source labels, scores, blockers, and proposal reason codes.
- Make submissions idempotent for the same target/candidate/classifier version.
- Respect rejected candidates by refusing to recreate them as fresh unreviewed candidates unless explicitly superseded.
- Add audit events for proposal creation, ignored duplicate, rejected-memory hit, and supersession.
- Document the expected payload for the future coffee-scraper PR.

## Out of scope

- Implementing the coffee-scraper candidate generation job.
- Auto-linking accepted identities.
- External supplier direct feeds.
- Public endpoints.
- Notifications or alerts.

## Files to change

- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- Optional internal route under `src/routes/api/catalog/identity-candidates/*`
- `src/lib/types/database.types.ts` if schema helpers change
- `src/lib/docs/content.ts` or a notes doc if the intake contract is documented internally

## Acceptance criteria

- Candidate proposals can be created idempotently.
- Previously rejected pairs are not silently reintroduced as fresh candidates.
- Proposal payloads store enough classifier/source/proof snapshot detail for later review.
- Endpoint/service is gated and not publicly callable.
- Tests cover duplicate proposals, rejected-memory suppression, supersession, and event writes.

## Test plan

```bash
pnpm exec vitest run src/lib/server/beanIdentity.test.ts
pnpm check --fail-on-warnings
pnpm run lint
```

If a route is added, include route tests for auth/gating and payload validation.

## Risks

- Creating an HTTP endpoint too early may invite external contract churn. Prefer an internal service unless the scraper deployment path requires HTTP.
- Candidate volume may grow quickly. Keep indexes and idempotency constraints explicit.

## Exact follow-on dependency

A separate `coffee-scraper` plan/PR can call this contract after app-side intake is merged and verified.
