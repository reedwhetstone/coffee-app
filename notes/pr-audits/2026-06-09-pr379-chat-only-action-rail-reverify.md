# PR #379 re-verification: chat-only analytics action rail

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- None. The analytics action rail is now chat-passthrough only, and the prior catalog-intelligence findings remain fixed.

## Summary

Re-verified PR #379 after the latest user-directed analytics action rail cleanup. The branch is independently mergeable: it keeps the catalog-to-intelligence connective tissue while removing noisy analytics action cards that were only glorified links.

## Focused verification

### Analytics action rail now contains only chat passthrough

Confirmed in `src/routes/analytics/+page.svelte`:

- The derived `compareActionHref`, `compareActionLabel`, and `apiActionHref` helpers were removed.
- The `Action rail` section now renders exactly one `AnalyticsActionCta`, the chat handoff: `Ask about this market read`.
- The removed cards are absent from source:
  - `Open catalog evidence`
  - `Compare supplier evidence`
  - `Review machine access`
  - `Watch this scope`
- The rail copy explicitly says catalog, supplier comparison, API access, and watch actions stay out until they create real investigation leverage.

A source search confirms there is only one `<AnalyticsActionCta` instance in `src/routes/analytics/+page.svelte`.

### Tests protect the absence

Confirmed in `src/routes/analytics/page.svelte.test.ts`:

- The action rail test was rewritten to `keeps the investigation rail focused on the chat passthrough only`.
- It still asserts the chat CTA exists and routes anonymous users to `/auth`.
- It asserts absence of the removed card titles and key CTA affordances:
  - `Open catalog evidence`
  - `Compare supplier evidence`
  - `Review machine access`
  - `Watch this scope`
  - `Open catalog`
  - `Review API plans`
  - `Watchlists not live`
- Entitled and roasting-only chat-context tests also assert the old supplier-compare and watch affordances do not reappear.

This is enough coverage for the requested cleanup. It protects against restoring the previous noisy rail structure while preserving the legitimate chat passthrough behavior.

### Prior PR #379 findings remain fixed

Prior catalog-intelligence reverify findings were not regressed:

- `src/routes/catalog/+page.server.ts` still passes `ppiAccess` into catalog page data.
- `src/routes/catalog/+page.svelte` still routes supplier comparison honestly:
  - Parchment Intelligence users get `/analytics#supplier-comparison` with `Review supplier comparison evidence`.
  - Non-PPI users get `/analytics` with `Preview supplier comparison gate`.
- The stale anonymous copy promising saved sourcing research remains removed.
- The paid-tier banner remains suppressed for PPI users who are not Mallard Studio members.
- Catalog tests still cover the connective-tissue hero, entitlement-aware supplier comparison link, empty-state market-index route, and absence of stale saved-workflow copy.

## Product alignment

This change is better than the previous action rail. It follows the PR #378 caution captured in `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md`: action affordances should generate evidence, preserve context, or unlock an actual workflow. The chat handoff is the one rail action that preserves scoped analytics context today. Catalog, API, supplier comparison, and watch cards were not providing additional leverage inside this rail.

The catalog page still does the right PR #05 job: it frames the catalog as the supply evidence layer behind Parchment Market Index reads, gives scoped row/origin/supplier/pricing counts, and links back to existing analytics surfaces without claiming nonexistent saved/watch/shortlist persistence.

## Validation

- `pnpm vitest run src/routes/analytics/page.svelte.test.ts src/routes/catalog/page.svelte.test.ts`: VALIDATION_PASS, 25 tests passed.
- `pnpm run check`: VALIDATION_PASS, 0 errors and 0 warnings.

Note: the analytics test suite intentionally logs one expected `Failed to load analytics chart modules: Error: chunk load failed` message inside its error-state test; the test still passes.

## Scope assessment

SCOPE_ASSESSMENT: mergeable

No rescope or superseding PR is needed. The latest cleanup is same-slice product alignment work and does not disturb the catalog-to-intelligence intent.
