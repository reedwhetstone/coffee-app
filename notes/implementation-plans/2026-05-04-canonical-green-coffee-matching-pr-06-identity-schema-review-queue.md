# PR 06: Bean Identity Schema and Review Queue Foundation

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Create a reversible canonical identity data model without turning on automatic identity resolution yet.

## Why this slice comes now

Similarity is useful, but canonical matching requires durable state. This PR creates the identity graph and audit trail while keeping operational risk low.

## In-scope

- Add `bean_identities` table with parent identity support for harvest-year children or seasonal records.
- Add `bean_identity_links` table with accepted, candidate, rejected, and superseded states.
- Add uniqueness constraints so one catalog row cannot have multiple active accepted identities.
- Add `bean_identity_events` for append-only audit trail.
- Add server data helpers for creating, linking, unlinking, rejecting, merging, and reading identity state.
- Add admin or internal-only read helpers for review queue data if an admin UI already has a natural place.
- Add database types and tests.

## Out-of-scope

- Auto-linking from scraper.
- Member canonical merged UI.
- Public identity pages.
- Supplier claim flows.
- Bulk backfill.

## Files to change

- `supabase/migrations/*_bean_identity_schema.sql`
- `src/lib/types/database.types.ts`
- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- Admin route files only if review queue read surface is added

## Acceptance criteria

- Identities can be created without changing catalog rows.
- Harvest-year child records can attach to a parent identity/series without overwriting the parent.
- Catalog rows can be linked, unlinked, rejected, and superseded with events recorded.
- Constraints prevent duplicate accepted active identity links for a catalog row.
- Identity status and link status are explicit.
- No scraper job auto-links anything yet.

## Test plan

- Unit tests for helper behavior.
- SQL constraint smoke checks.
- Type generation check.
- `pnpm check` and targeted vitest.

## Risks

- Direct `coffee_catalog.bean_identity_id` is tempting but less auditable. Use link and event tables first; denormalize later only if query performance demands it.
- Review states can become noisy. Keep schema minimal but stateful enough to reject repeated bad candidates.

## Exact follow-on dependency

PR 07 uses this schema from coffee-scraper to create candidate links and conservative auto-links.
