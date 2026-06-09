# PR #379 verification: Catalog intelligence connective tissue

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 2
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:

- Make the supplier-comparison catalog CTA a real, entitlement-honest analytics path for all user states; today `/analytics#supplier-comparison` only exists for Parchment Intelligence users.
- Remove or rewrite stale catalog copy that promises saved sourcing research before saved/watch/shortlist workflows exist.
- Fix the paid-tier catalog banner so Parchment Intelligence and Mallard Studio are not collapsed into a `!member` prompt.
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable
  VALIDATION_STATUS:
- `pnpm vitest run src/routes/catalog/page.svelte.test.ts`: VALIDATION_PASS
- `pnpm run check`: VALIDATION_PASS

## Summary

The PR is directionally aligned with the analytics intelligence reframe. The catalog hero now frames catalog rows as the evidence substrate behind the Parchment Market Index, adds query/page-level evidence counts, preserves the copy-filtered-link affordance, and updates the implementation plan with the PR #378 product-quality caution. The slice boundary is valid: this can be made independently mergeable without PR 06, and it does not introduce schema changes, persistence, or fake saved/watch success states in the new sections.

It is not ready as-is because the highest-value new CTA is not a real route for most users. The catalog links everyone to `/analytics#supplier-comparison`, but the `supplier-comparison` fragment only exists inside the Parchment Intelligence branch of `/analytics`. Anonymous, viewer, and roasting-only users land on `/analytics` with a dead fragment, while the copy says they will “Review supplier comparison evidence.” That violates the PR’s own “real link paths into analytics” requirement and the plan’s “honest links into existing market reads” caution.

## Findings

### P1 — Supplier comparison CTA is not a real, entitlement-honest link for most catalog users

**Type:** confirmed defect / product alignment

**Evidence:**

- `src/routes/catalog/+page.svelte:278-290` renders a universal link to `/analytics#supplier-comparison` labeled “Review supplier comparison evidence.”
- `src/routes/analytics/+page.svelte:675-683` only uses `#supplier-comparison` for users with `isParchmentIntelligence`; non-entitled users are routed to auth or subscription from the analytics action rail instead.
- `src/routes/analytics/+page.svelte:1244-1245` only renders `<div id="supplier-comparison">` in the Parchment Intelligence branch. The non-entitled preview branch has no matching fragment target.
- The implementation plan says PR 05 should use “concrete evidence paths, scoped copy, and honest links into existing market reads,” not generic cards or overclaims (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:239-241`).
- The action matrix allows supplier comparison as “Link to existing gated module or preview entitlement honestly” (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:320-332`). Current behavior is neither a reliable gated-module anchor nor honest preview copy for non-entitled users.

**Why it matters:**

The main new connective-tissue card looks concrete in tests, but for the default catalog audiences it is effectively a broken deep link. It also overpromises evidence to users who are only allowed to see the public Market Index and a blurred/gated preview.

**Correction guidance:**

Patch in the same PR. Good options:

1. Add a stable `id="supplier-comparison"` or more explicit `id="supplier-comparison-preview"` to the non-entitled analytics preview/gate and change catalog copy to make the gated nature clear, for example “See supplier comparison preview.”
2. Better: pass the existing `ppiAccess` entitlement into catalog page data and choose the CTA by state:
   - Parchment Intelligence: `/analytics#supplier-comparison`, “Review supplier comparison evidence.”
   - Anonymous: `/analytics`, “Review public Market Index,” or `/auth` if the action is compare-specific.
   - Signed-in non-PPI: `/subscription?plan=intelligence-monthly&intent=checkout`, “Unlock supplier comparison.”
3. Add tests for the non-entitled catalog state and, if adding the preview anchor, an analytics test proving the fragment target exists outside the Parchment Intelligence branch.

### P2 — Anonymous catalog CTA still promises saved sourcing research even though saved/shortlist workflows are future work

**Type:** confirmed product copy defect / inherited tech debt now higher risk

**Evidence:**

- `src/routes/catalog/+page.svelte:599-601` says: “Create a free account to browse the full catalog, save sourcing research, and unlock the next step after public market discovery.”
- The same PR adds honest copy at `src/routes/catalog/+page.svelte:510-513` saying watchlists and saved shortlists are future workflows.
- The plan explicitly says current tracked/watched/shortlisted Portfolio objects require a future saved-object model (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:40-43`) and non-persistent CTAs must not imply saved/watch/shortlist/export success (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:332`).

**Why it matters:**

This line predates the PR, but PR 05 is the catalog copy pass that is supposed to remove fake saved-state language. Leaving the old anonymous CTA creates a direct contradiction on the same page.

**Correction guidance:**

Replace “save sourcing research” with an existing, truthful capability, for example: “Create a free account to browse the full catalog, keep filters in the URL, and continue from public market discovery.” If the intent is paid conversion, point to existing analytics/catalog comparison workflows rather than saved research.

### P2 — New paid-tier banner uses member-role gating for Parchment Intelligence copy

**Type:** confirmed product alignment concern / entitlement mismatch

**Evidence:**

- `src/routes/catalog/+page.svelte:503-528` renders the “Need workflow leverage from this supply layer?” banner whenever `session && !hasRequiredRole('member')`.
- The new copy says “Parchment Intelligence adds supplier comparison and market movement reads. Mallard Studio adds owned-stock and roasting context.”
- The implementation plan separates Intelligence (`ppiAccess`) from Roasting (`member`) and says a user can have either, both, or neither (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:52-68`).
- The same plan says supplier comparison belongs to Parchment Intelligence, not member/roasting (`notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:320-326`).

**Why it matters:**

A Parchment Intelligence user without `member` remains in this `!member` bucket and would see a generic “Compare paid products” prompt for a capability they may already have. This was easier to ignore when the banner was generic roaster upsell copy; after this PR, it explicitly talks about Intelligence access and should respect the Intelligence entitlement.

**Correction guidance:**

Prefer passing `ppiAccess` from existing page auth/principal state into catalog data, then branch copy:

- No Intelligence and no Roasting: compare paid products.
- Intelligence-only: route to analytics/supplier comparison and avoid implying they lack Intelligence.
- Roasting-only: explain that supplier comparison is Intelligence, while Mallard context is already available.
- Both: suppress the upgrade prompt or turn it into an evidence/action prompt.

If passing entitlement data is outside this slice, remove tier-specific claims from the `!member` banner and keep the copy generic until the catalog page can distinguish the two products.

## Intent coverage

- **Catalog reads as supply substrate:** mostly satisfied. The new hero copy at `src/routes/catalog/+page.svelte:228-266` ties catalog rows, suppliers, origins, process signals, and pricing evidence to market reads.
- **Real link paths into analytics:** partially satisfied. `/analytics` is real; `/analytics#supplier-comparison` is only real for Parchment Intelligence users.
- **No backend/schema/query changes:** satisfied.
- **No fake saved/watch/export success states:** new sections mostly comply, but the page still carries stale “save sourcing research” copy that conflicts with this requirement.
- **Concrete scoped links rather than generic cards:** partially satisfied. The hero is scoped, but the supplier comparison link needs entitlement-aware routing or a real preview anchor.
- **Plan doc updated with Reed’s PR #378 caution:** satisfied at `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md:239-241`.
- **Tests updated:** partially satisfied. Catalog tests cover hero copy and href attributes, but they do not catch whether the analytics fragment exists for the rendered user state.

## Mergeability and scope assessment

The PR boundary is sound. It does not depend on PR 06 to be coherent, and the needed corrections are same-slice catalog/analytics linking and copy fixes. No rescope or superseding PR is needed.

Current branch state: **needs patch before merge**.

## Validation

- `pnpm vitest run src/routes/catalog/page.svelte.test.ts` passed, 8 tests.
- `pnpm run check` passed with 0 Svelte diagnostics.

Validation did not include full Playwright/browser coverage. The link-fragment issue was confirmed by source inspection of the catalog link and analytics conditional DOM.
