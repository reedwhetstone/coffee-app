# Implementation Plan: Wholesale Markers on Roast Profiles Page

**Date:** 2026-03-24
**Slug:** wholesale-markers-roast-profiles
**Status:** Planning only — awaiting Reed review
**Repo:** coffee-app (web-only; no CLI changes needed)

---

## Feature

Add wholesale markers/filtering to the roast profiles page (`/roast`). When a roast used a wholesale bean, display a visible indicator in the roast history table and optionally in the profile display. Add a wholesale filter to match the existing behavior on the `/profit` and `/beans` (inventory) pages.

DEVLOG source: Priority 2 — "Add wholesale markers/filtering to roast profiles page. Show which roasts used wholesale beans."

---

## Candidate Scoring

| Candidate                                | Priority | Complexity | Risk        | Deps      | Total  |
| ---------------------------------------- | -------- | ---------- | ----------- | --------- | ------ |
| Wholesale markers — roast profiles page  | P2 → 6   | easy → 10  | low → 0     | none → 0  | **16** |
| Cupping note dashed lines too dark       | P2 → 6   | easy → 10  | low → 0     | none → 0  | **16** |
| Score & rating display formatting        | P2 → 6   | medium → 6 | low → 0     | none → 0  | **12** |
| Roast chart resize on nav                | P2 → 6   | medium → 6 | medium → -2 | some → -2 | **8**  |
| Cascade delete for beans with sales refs | P1 → 8   | hard → 2   | high → -5   | none → 0  | **5**  |

**Winner: Wholesale markers — roast profiles page (tied at 16 with the dashed lines visual tweak, but this has more strategic weight — see alignment audit below).**

---

## Why Now

The wholesale feature shipped on inventory (PR #121) and sales/profit (PR #167) pages. The roast profiles page is the only remaining page in the core workflow that lacks wholesale context. A roaster looking at their roast history can't distinguish wholesale batches from retail without clicking into each bean. This is the obvious next step in completing the wholesale feature set, and it mirrors work that's already done on adjacent pages.

---

## Strategy Alignment Audit

**Active strategy themes extracted from blog posts and DEVLOG:**

1. AI-first workspace / conversion funnel (catalog access, discovery)
2. Data transparency and market intelligence (blog posts: "Who Profits When Coffee Data Stays Scarce?", "Beyond the Coffee Belt")
3. Purveyors Price Index (PPI) — first revenue product, B2B data API
4. Public catalog access + conversion funnel (P0)
5. Mobile navigation redesign (P0)
6. Wholesale as a first-class dimension across the app

**Alignment verdict: Aligned.**

Completing wholesale marker coverage across all pages is a low-cost finisher on a feature that's already half-done. It directly supports theme 6 (wholesale as a first-class data dimension). It does not compete with or block any of the higher P0 items (PPI, mobile nav, public catalog). It's not in the blog content pipeline. No contradictions with current direction.

**Why not the dashed lines tweak?** Also a score of 16, but a pure cosmetic fix with no strategic compound value. Wholesale markers complete a data feature and give roasters richer segmentation insight. Prefer the one that adds functional dimension.

---

## Scope

### In scope

- Join `coffee_catalog` wholesale field when loading `roast_profiles` in `+page.server.ts`
- Add wholesale indicator badge/tag in `RoastHistoryTable.svelte` (per-row and/or per-batch-summary)
- Add wholesale filter toggle in `/roast` page (matching the retail/wholesale/all pattern on profit page)
- Extend the `RoastProfile` or `RoastWithCoffee` type as needed to carry the `wholesale` flag

### Out of scope

- Schema changes (no DB migrations)
- Wholesale filter on roast chart display
- CLI changes (this is a web-only view feature; wholesale flag comes from catalog data already in the DB)
- Mobile-specific layout changes
- Any changes to the roast form or data entry flow

---

## Proposed UX Behavior

1. **Badge in history table:** Each roast row that used a wholesale bean shows a small "Wholesale" tag (same style as used on inventory and profit pages — check `src/routes/profit/+page.svelte` and `src/routes/beans/+page.svelte` for the existing badge component/style).
2. **Filter toggle:** Add "All / Wholesale / Retail" filter buttons above the roast history table, matching the existing filter pattern on the profit page.
3. **Batch-level summary:** If a batch contains any wholesale roast, the batch header should show the wholesale indicator (same as the `{#if d.rawData.profitData.some((p) => p.wholesale)}` pattern already used in `SalesChart.svelte`).

---

## Files to Change

1. **`src/routes/roast/+page.server.ts`**

   - Change `.select('*')` to a join that includes `green_coffee_inv(catalog_id, coffee_catalog!catalog_id(name, wholesale))`
   - Map the `wholesale` boolean onto each returned profile row
   - Alternative: add a separate lightweight query for `green_coffee_inv` with catalog join, keyed by `coffee_id`

2. **`src/routes/roast/RoastHistoryTable.svelte`**

   - Add `wholesale?: boolean` to the `TableRoastProfile` interface
   - Render badge in the table row (same badge style as existing pages)
   - Render wholesale tag in batch summary if any row in batch is wholesale

3. **`src/routes/roast/+page.svelte`**

   - Add wholesale filter state (`'all' | 'wholesale' | 'retail'`)
   - Filter `sortedGroupedProfiles` based on selected filter before passing to `RoastHistoryTable`
   - Render filter toggle buttons (same pattern as profit page's wholesale/retail filter)

4. **`src/lib/types/component.types.ts`** (possibly)
   - Extend `TableRoastProfile` in the history table, or add `wholesale` to the base `RoastProfile` type if appropriate

---

## API/Data Impact

- No new API routes
- `roast_profiles` does not have a `wholesale` column; the value comes from `coffee_catalog` via `green_coffee_inv`. The join path is: `roast_profiles.coffee_id` → `green_coffee_inv.id` → `green_coffee_inv.catalog_id` → `coffee_catalog.wholesale`
- The server load currently does `select('*')` from `roast_profiles` directly. This needs to become a join. Two options:
  - **Option A:** Extend the Supabase select to join `green_coffee_inv` and `coffee_catalog`. This returns richer data but changes the shape of `profiles[]` returned to the page.
  - **Option B:** After loading profiles, fetch a map of `{ coffee_id: wholesale }` from `green_coffee_inv` joined to `coffee_catalog`, then merge. Keeps the existing `profiles[]` shape unchanged.
  - Prefer **Option B** for minimal risk; profiles shape stays stable, no cascade of type changes.

---

## Acceptance Criteria

- [ ] Roast profiles page shows a "Wholesale" badge on each roast that used a wholesale bean
- [ ] Filter toggle (All / Wholesale / Retail) correctly filters the roast history table
- [ ] Batch header shows wholesale indicator when the batch contains any wholesale roast
- [ ] Roasts from non-wholesale beans show no badge and are not affected
- [ ] `pnpm check` passes (no TypeScript errors)
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes (no regressions in vitest)
- [ ] Manual smoke test: roast page loads, badge visible on wholesale roast rows, filter works correctly

---

## Test Plan

- `pnpm check` — TypeScript type checking
- `pnpm lint` — ESLint/Prettier
- `pnpm test:unit` — vitest unit tests (no new tests expected; verify no regressions)
- Manual: load `/roast`, confirm wholesale badge visible on expected rows, confirm filter toggles work, confirm non-wholesale rows unaffected
- Playwright E2E: existing roast page tests should pass; no new E2E tests strictly required for a display-only feature, but check that existing tests don't break due to the server load change

---

## Risks and Rollback

- **Low risk overall.** This is a read-only display change. No writes, no schema changes.
- **Join shape risk (Option A only):** Changing the select shape in `+page.server.ts` could affect type inference downstream. Option B sidesteps this entirely.
- **Supabase join syntax:** The `coffee_id` FK in `roast_profiles` references `green_coffee_inv.id`. The join may require explicit FK hint syntax (e.g., `green_coffee_inv!roast_profiles_coffee_id_fkey`). Verify against existing join patterns in `sales.ts`.
- **Rollback:** Trivially done by reverting `+page.server.ts` and the two Svelte files. No DB state to unwind.

---

## Open Questions for Reed

1. **Join approach:** Option A (extend the server load select to return wholesale inline) vs Option B (separate lightweight map fetch, merge on client). Option B is safer and keeps the type surface stable. Is there a preference, or just ship whichever is cleaner?

2. **Badge style:** The profit page and beans page both have wholesale indicators. Which visual treatment should be used for the roast page — exact same badge component/class, or a subtler indicator (e.g., just a dot/icon in the table)? Should I just match the profit page treatment for consistency?

3. **Filter placement:** On profit, the filter is above the chart. On roast, the history table is the main list. Should the filter go above the batch list, or in the same toolbar row as other controls (e.g., alongside the existing bean/batch controls)?

4. **CLI relevance:** This is purely a web view feature — no new CLI commands needed. Confirm this is web-only and does not need a `purvey roast list --wholesale` flag added to the CLI at the same time.
