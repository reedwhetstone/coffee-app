# PR #379 re-verification: Catalog intelligence connective tissue

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- None. Prior entitlement-honesty findings are fixed in the current branch/worktree state.

## Summary

Re-verified PR #379 after the same-PR patches. The catalog CTA is now entitlement-aware, the anonymous saved-workflow overclaim is removed, and the new paid-tier catalog banner no longer appears for Parchment Intelligence users who are not Mallard Studio members. The branch remains independently mergeable.

Note: the re-verification inspected the current worktree state, including staged same-PR patch changes, because the latest fixes are staged on top of `HEAD` in this checkout.

## Prior findings

### Fixed: supplier-comparison CTA is now entitlement-honest

- `src/routes/catalog/+page.server.ts` now returns `ppiAccess` from `locals.principal.ppiAccess` for authenticated users.
- `src/routes/catalog/+page.svelte` derives `canUseParchmentIntelligence` from `ppiAccess`.
- Non-PPI catalog users now get `href="/analytics"` and label `Preview supplier comparison gate`.
- PPI users get `href="/analytics#supplier-comparison"` and label `Review supplier comparison evidence`.
- `src/routes/analytics/+page.svelte` now keeps `id="supplier-comparison"` only on the real PPI supplier-comparison module, not on the blurred non-PPI gate wrapper.

This fixes the dead-fragment and overpromised evidence path for anonymous, viewer, and other non-PPI catalog users.

### Fixed: anonymous copy no longer promises saved sourcing research

- `src/routes/catalog/+page.svelte` now says: `Create a free account to browse the full catalog, inspect more supply evidence, and continue from public market discovery.`
- The test suite asserts that `save sourcing research` is not present.

This keeps the catalog copy aligned with the explicit future-work status of watchlists and saved shortlists.

### Fixed: PPI-only users are not shown the new generic paid-tier banner

- `src/routes/catalog/+page.svelte` now gates the `Need workflow leverage from this supply layer?` banner behind `session && !hasRequiredRole('member') && !canUseParchmentIntelligence`.
- `src/routes/catalog/page.svelte.test.ts` covers the PPI access case and asserts that the banner is absent.

This prevents Parchment Intelligence users without Mallard Studio membership from seeing copy that implies they still lack Intelligence access.

## Tests and validation

- `pnpm vitest run src/routes/catalog/page.svelte.test.ts`: VALIDATION_PASS, 9 tests passed.
- `pnpm run check`: VALIDATION_PASS, 0 errors and 0 warnings.

## Scope assessment

SCOPE_ASSESSMENT: mergeable

The corrections are same-slice catalog and analytics honesty fixes. No rescope or superseding PR is needed.
