# PR 01: Cross-Supplier Similarity Contract

**Parent plan:** `2026-06-02-canonical-matching-completion-program.md`
**Branch suggestion:** `feat/canonical-matching-cross-supplier-contract`
**Purpose:** Make the beta similar-coffee contract explicitly cross-supplier by default.

## PR goal

Update `/v1/catalog/{id}/similar`, the shared similarity service, and the member comparison UI so canonical candidates and similar recommendations are source-aware. The default product behavior should compare a target coffee against other suppliers, not silently mix same-source near-duplicates into sourcing recommendations.

## Why this slice comes now

This is the smallest independently useful correction before persistence. If the default matching product is not source-aware, durable identity links and agent recommendations will compound ambiguity.

## Mergeable-slice gate

This PR is mergeable even if identity tables never ship. It improves the existing beta member feature by aligning behavior and copy with the cross-supplier sourcing value proposition.

## In scope

- Add `source`/supplier-label fields to target and match classification inputs where missing.
- Default similarity matching to exclude same-source rows from member sourcing output.
- Add an explicit query option only if needed, such as `include_same_source=true`, for diagnostics/backward-compatible exploration.
- Add classification/blocker or metadata fields that explain source filtering or same-source diagnostic status.
- Update `SimilarCoffeePanel.svelte` copy and tests so sections read as cross-supplier sourcing comparisons.
- Keep response groups backward compatible: `groups.canonical_candidates`, `groups.similar_recommendations`, and flat `matches` remain.

## Out of scope

- Identity tables.
- Accepted/rejected candidate persistence.
- Scraper pipeline changes.
- CLI repo changes.
- Public identity pages.

## Files to change

- `src/lib/server/catalogSimilarity.ts`
- `src/lib/server/catalogSimilarity.test.ts`
- `src/routes/v1/catalog/[id]/similar/+server.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts`
- `src/lib/docs/content.ts` if API docs describe query params or semantics

## Acceptance criteria

- Default `/v1/catalog/{id}/similar` results do not include same-source matches when the target and candidate both have the same non-null `source`.
- Same-source behavior is either unavailable by default or accessible only through an explicit diagnostic/compatibility query param.
- API metadata states whether same-source rows were excluded or included.
- UI copy says “other suppliers” or equivalent when showing default results.
- Existing entitlement, threshold, stocked-only, mode, rate-limit, and grouped-output tests still pass.
- Tests cover same-source exclusion, null-source handling, and explicit include behavior if that param is added.

## Test plan

```bash
pnpm exec vitest run src/lib/server/catalogSimilarity.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts
pnpm check --fail-on-warnings
pnpm run lint
```

## Risks

- `source` may not be stable enough to be a permanent supplier id. This PR should treat it as a supplier label and avoid naming it `supplier_id` unless the schema actually has one.
- Same-source rows may be useful for data cleanup. Keep that as an explicit diagnostic path rather than default sourcing behavior.

## Exact follow-on dependency

PR 02 can persist identity candidates knowing that the default candidate pool is source-aware.
