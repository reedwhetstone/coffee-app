# Filter, search, and CTA pre-submission audit

**Branch:** `fix/filter-search-cta-audit`
**Base:** `origin/main`
**Final commit reviewed:** `8b722ddd`

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:
- None.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
VALIDATION_STATUS:
- Focused regression suite (134 tests): VALIDATION_PASS
- pnpm lint: VALIDATION_PASS
- Placeholder-environment pnpm check --fail-on-warnings: VALIDATION_PASS
- Full pnpm test suite (931 tests before the final focused corrections): VALIDATION_PASS
```

## Scope audited

- Catalog filter controls, stable URL state, SSR queries, in-page BFF refreshes, and Parchment SDK query serialization
- Viewer and member entitlement behavior for process, range, freshness, wholesale, and advanced-sort controls
- Tracked-only catalog state and query behavior
- Market Index scope and window controls
- Free-tier CTA repetition across catalog and Market Index states
- Accepted product direction in `notes/PRODUCT_VISION.md`, ADR-005, and ADR-010

## Findings resolved before submission

1. The app sent several stable snake_case aliases directly to the current camelCase SDK contract. Stocked dates, stocked windows, variety, price and score ranges, sort fields, and tracked IDs could be silently ignored. A shared boundary adapter now serves SSR and BFF paths, including the scalar comma-list `coffeeIds` contract.
2. `stocked_days` did not survive URL parsing and reload. It now round-trips through URL, store, SSR, and request state.
3. Free viewers could see controls that the product entitlement contract does not grant. Wholesale, price and score ranges, and freshness controls are now member-only in the UI and stripped from viewer SSR state.
4. Canonical denial notices did not reconcile back to app-owned range or advanced-sort state. Denied filters and sorts now clear from local state and the effective share URL.
5. Tracked-only mode exposed disconnected filters and could carry hidden filters into its tracked-ID request. It now uses one effective, cleared state and hides launchers only when the server authorizes the tracked view.
6. Catalog and Market Index free-tier states repeated same-destination CTAs. Each page state now keeps one clear CTA per distinct action, including zero-result catalog states.
7. The settings launcher appeared on `/profit` despite that route having no filterable columns. It is now absent on desktop and mobile.

## Validation notes

The first unconfigured `pnpm check --fail-on-warnings` invocation was environment-blocked because the worktree intentionally had no local secrets. The same static check passed with non-secret placeholder values for the required compile-time environment variables. Runtime behavior was not validated with placeholders.

The full Vitest suite passed before the final tracked-state and freshness-entitlement corrections. Those final corrections were then covered by the focused 134-test suite, lint, and zero-warning Svelte checks. The final independent reviewer confirmed both prior P1 findings were resolved with no remaining P0, P1, P2, or P3 findings.
