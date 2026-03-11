# Wholesale Markers on Green Coffee Inventory Page

**Date:** 2026-03-11
**Slug:** wholesale-markers-inventory
**Status:** Planning only — awaiting Reed approval before coding

---

## Feature

Add wholesale badge/indicator to the green coffee inventory (`/beans`) page so users can immediately see which stocked coffees are wholesale lots at a glance.

---

## Why Now

The wholesale data model was fully shipped in a prior PR (wholesale boolean + price_tiers on coffee_catalog, catalog UI filtering). But the inventory page (`/beans`) does not surface this flag — users who own wholesale lots see no indication in their inventory view. This is a natural completion step that closes the gap between catalog visibility and inventory visibility.

Additionally, `wholesale` is not currently included in `buildGreenCoffeeQuery`'s coffee_catalog select, making it unavailable to any downstream component on the beans page. This PR fixes that gap with a trivially scoped query change and a single badge addition.

---

## Strategy Alignment Audit

**Active strategy themes this supports:**

1. **Risk-aware sourcing / portfolio intelligence** — Knowing at a glance which green coffees are wholesale lots (higher min purchase, price-tier structured) is directly relevant to the sourcing diversification themes in the Priority 15 DEVLOG section ("barbell sourcing planner", "portfolio concentration risk").

2. **Data completeness and transparency** — The "green-coffee-information-gap" blog outline argues that key sourcing attributes are systematically under-surfaced. Wholesale classification is exactly that kind of sourcing signal. This PR makes it visible in the workflow where it matters: inventory management.

3. **Feature completeness for existing users** — Wholesale lots have distinct purchasing economics (tier pricing, higher minimums). Users who sourced wholesale beans have context the UI currently strips from them once they leave the catalog.

**Contradictions or concerns:**
- None. This is a display-only extension of a fully shipped data model. No schema changes, no new API surface.

**Verdict: Strongly aligned.** Closes a feature gap, supports the sourcing intelligence narrative, zero architectural risk.

---

## Scope

**In:**
- Add `wholesale` to the `buildGreenCoffeeQuery` coffee_catalog select
- Add a "Wholesale" badge to each bean card on `/beans` where `catalogData?.wholesale === true`
- Badge placement: alongside existing ⭐ rating and ☕ cupped indicators
- Style: consistent with existing badge pattern (small colored pill)

**Out:**
- No filtering by wholesale on inventory page (separate future item)
- No wholesale indicators on roast profiles or sales page (separate future items in DEVLOG)
- No price_tiers display (already handled in BeanForm; not needed in list view)
- No schema changes

---

## Proposed UX Behavior

Bean cards on `/beans` that reference a catalog entry with `wholesale: true` show a small "Wholesale" pill badge alongside (or just below) the supplier name, consistent in style with the existing amber ⭐ and purple ☕ badges.

Example badge: `<span class="rounded bg-blue-100 px-1 text-xs text-blue-800">🏭 Wholesale</span>`

Badge appears both in the desktop flex row and mobile layout where rating badges already appear.

---

## Files to Change

1. **`src/lib/server/greenCoffeeUtils.ts`**
   - In `buildGreenCoffeeQuery`, add `wholesale` to the `coffee_catalog!catalog_id (...)` select list (alongside existing fields like `cost_lb`, `source`, `stocked`, etc.)

2. **`src/routes/beans/+page.svelte`**
   - Add `{@const isWholesale = catalogData?.wholesale === true}` in the `{#each}` block
   - Add wholesale badge in the badge row alongside ⭐ and ☕ badges:
     ```svelte
     {#if isWholesale}
       <span class="rounded bg-blue-100 px-1 text-xs text-blue-800">Wholesale</span>
     {/if}
     ```
   - Ensure badge appears in both the `sm:flex` desktop row and is accessible on mobile layout

---

## API / Data Impact

- No new API endpoints
- `buildGreenCoffeeQuery` adds one field to an existing Supabase join select — no DB migration needed
- The `wholesale` column already exists on `coffee_catalog` (boolean, default false)
- The `Database` types already include `wholesale` in the catalog Row type — no type generation needed

---

## Acceptance Criteria

- [ ] A bean card in `/beans` that corresponds to a catalog entry with `wholesale: true` shows a "Wholesale" badge
- [ ] A bean card with `wholesale: false` or `null` shows no badge
- [ ] Badge renders correctly on desktop (sm:flex row) and mobile layout
- [ ] Existing badges (⭐ rating, ☕ cupped) are unaffected
- [ ] `pnpm check` passes with no new TypeScript errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes (no existing tests touch this query; if greenCoffeeUtils has tests, wholesale field is included in snapshots)

---

## Test Plan

1. `pnpm check` — TypeScript strict mode passes
2. `pnpm lint` — ESLint clean
3. `pnpm test:unit` — vitest passes; if greenCoffeeUtils snapshot tests exist, update them
4. Manual: navigate to `/beans` with a seeded wholesale=true entry → badge visible
5. Manual: navigate to `/beans` with wholesale=false entries → no badge shown
6. Playwright: existing beans E2E should continue to pass (no structural change to the page)

---

## Risks and Rollback

- **Risk level: Low**
- Only display change; no data writes, no auth changes
- If the badge causes layout issues on mobile, it can be hidden with `hidden sm:inline` and revisited
- Rollback: revert the two file changes; no DB migration to roll back

---

## Open Questions for Reed

1. **Badge label and icon:** "Wholesale" + no icon, vs "🏭 Wholesale", vs "W" pill? What matches your mental model for the UI?

2. **Badge color:** Blue-100/blue-800 feels neutral. Should it be a warning-adjacent color (amber/yellow) to indicate "larger minimums / different pricing" instead?

3. **Mobile visibility:** Should the wholesale badge be shown on mobile (space is tight) or desktop-only for the initial pass?

4. **Filter extension:** Should this PR also add a "Show wholesale only" toggle on `/beans`, or keep it display-only and file that separately?
