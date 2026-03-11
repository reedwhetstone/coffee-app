# Implementation Plan: Fix "New Roast" Link Pre-selection from Bean Page

**Date:** 2026-03-10
**DEVLOG item:** Priority 1 — Bug: "New Roast" link on bean page doesn't navigate to roast form correctly
**Slug:** new-roast-link-preselect-fix

---

## Scoring (easy-win rubric)

| Factor       | Value             | Score  |
| ------------ | ----------------- | ------ |
| Priority     | P1 (critical bug) | +8     |
| Complexity   | Easy              | +10    |
| Risk         | Low               | 0      |
| Dependencies | None              | 0      |
| **Total**    |                   | **18** |

Runner-up: P2 Supplier cupping dashes (score 16), P2 Clean up beans catalog user fields (score 16).
Winner is unambiguous.

---

## Feature

Fix the "Start New Roast" button in `BeanProfileTabs.svelte` so that navigating to `/roast?modal=new&beanId=X&beanName=Y` reliably pre-selects the correct bean in the `RoastProfileForm`.

---

## Why Now

This is a P1 critical bug. Users on the bean profile page click "Start New Roast" expecting to land on a pre-filled roast form. If the bean pre-selection fails silently, they get a blank form and must re-select manually — or worse, submit a roast with no bean linked, creating orphaned data. Fixing it is a small targeted change with zero migration risk.

---

## Strategy Alignment Audit

**Supports:**

- **Product reliability baseline** — the latest blog posts (Beyond the Coffee Belt, Benchmark Leaders) position Purveyors as a serious data platform. Broken core UX directly undercuts that credibility.
- **User retention funnel** — the P0 public catalog conversion funnel work (on the horizon) is only valuable if existing authenticated users actually complete core workflows. A broken "Start New Roast" button breaks the core roasting loop.
- **AI-first workspace** — roast data feeds AI tasting note analysis and comparison features. Without clean roast creation, the AI layer has nothing to analyze.

**No contradictions.** This is pure reliability work that unblocks future feature layers.

**Verdict: Strongly aligned.** Fixing reliability is a precondition for everything strategic.

---

## Root Cause Analysis (pre-code investigation)

From code review of `BeanProfileTabs.svelte` and `src/routes/roast/+page.svelte`:

1. **Link construction** (`BeanProfileTabs.svelte` line ~692):

   ```js
   window.location.href = `/roast?modal=new&beanId=${selectedBean.id}&beanName=${encodeURIComponent(selectedBean.coffee_catalog?.name || selectedBean.name)}`;
   ```

   - `selectedBean` is typed as `InventoryWithCatalog`, which extends `GreenCoffeeInv`.
   - `GreenCoffeeInv` has NO `name` field. Only `coffee_catalog?.name` exists.
   - If `coffee_catalog` is somehow not loaded at click time, `selectedBean.name` evaluates to `undefined`, giving `beanName=undefined` in the URL.

2. **Roast page pre-population** (`+page.svelte` `onMount`):

   ```js
   if (typeof window !== 'undefined' && !currentRoastProfile) {
       const beanId = params.get('beanId');
       const beanName = params.get('beanName');
       if (beanId && beanName) { ... }
   }
   ```

   - The guard `!currentRoastProfile` may prevent pre-selection if a profile is somehow already active.
   - If `beanName` is the string `"undefined"` (truthy), the condition passes but the form shows "undefined" as the bean name.

3. **Timing concern**: `isFormVisible` is a `$derived` (reactive immediately from URL), but `selectedBean.id` is only set in `onMount`. The `$effect` in `RoastProfileForm` that sets `batchBeans[0].coffee_id` fires when `selectedBean.id` becomes truthy. If this reactive chain has any issue (e.g., `untrack()` swallowing the dependency), the dropdown won't show the pre-selected bean.

**Most likely root cause:** The `coffee_catalog` fallback chain in the link builder is fragile and the `!currentRoastProfile` guard can silently prevent pre-selection.

---

## Scope

**In:**

- Fix `BeanProfileTabs.svelte` to always pass a valid `beanName` (use catalog name, no unsafe fallback to undefined)
- Audit the `onMount` guard condition in `+page.svelte` — remove or relax `!currentRoastProfile` if it's blocking pre-selection
- Verify the reactive chain (`selectedBean.id` → `$effect` → `batchBeans[0].coffee_id`) is correct
- Manual browser test of the full flow: Beans → "Start New Roast" → form opens with correct bean pre-selected

**Out:**

- Do not change the RoastProfileForm's dropdown behavior or UI
- Do not change how the URL is cleaned up on form close
- Do not touch the bean deletion bug or any other P1 bug

---

## Proposed UX Behavior

**Before:** Clicking "Start New Roast" on a bean opens the roast form, but the bean dropdown may show empty/No Bean Selected or "undefined" depending on data loading state.

**After:** Clicking "Start New Roast" on a bean reliably opens the roast form with that bean pre-selected in the dropdown and batch fields pre-filled.

---

## Files to Change

| File                                       | Change                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/beans/BeanProfileTabs.svelte`  | Harden the `beanName` construction — assert `coffee_catalog.name` is defined before building the URL, log a warning if catalog is missing                  |
| `src/routes/roast/+page.svelte`            | Review and fix the `!currentRoastProfile` guard in `onMount`; consider reading URL params outside the guard or using `$effect` with URL reactivity instead |
| `src/routes/roast/RoastProfileForm.svelte` | Audit the `$effect` that syncs `selectedBean` prop — confirm it fires correctly when `selectedBean.id` transitions from `undefined` to a value             |

---

## API / Data Impact

None. This is a client-side navigation and reactive state fix. No API changes, no schema changes.

---

## Acceptance Criteria

- [ ] From `/beans`, select a stocked bean with a full profile
- [ ] Click "Start New Roast" button
- [ ] `/roast?modal=new&beanId=X&beanName=Y` loads with URL params present
- [ ] Form opens with the correct bean name shown in the bean dropdown (not "No Bean Selected", not "undefined")
- [ ] `batchBeans[0].coffee_id` equals the inventory `id` of the pre-selected bean
- [ ] Submitting the form creates a roast profile linked to the correct `coffee_id`
- [ ] No TypeScript type errors introduced (`pnpm check` passes)
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes
- [ ] Playwright test for the Beans → New Roast navigation flow passes (or a smoke test confirms the fix)

---

## Test Plan

1. **Local manual test:** Navigate to `/beans`, open a profile, click "Start New Roast", verify form pre-populates correctly.
2. **`pnpm check`** — confirm no TypeScript errors
3. **`pnpm lint`** — confirm no lint issues
4. **`pnpm test:unit`** — run unit tests
5. **CI Playwright** — watch for pass on the beans/roast flow

---

## Risks & Rollback

**Risk:** Very low. Client-side navigation change only; no DB writes, no schema changes, no API changes.

**Rollback:** `git revert` the PR. No data migration needed.

---

## Open Questions for Reed

1. **Is `coffee_catalog` always loaded** on the beans page before the "Start New Roast" button is clickable? If there's a case where the inventory row loads before the catalog join, the `beanName` param might be wrong at click time. Should we add a guard to disable the button until catalog data is confirmed?

2. **Should the form fail loudly or silently** if it arrives at `/roast?modal=new` without a valid `beanId`? Right now it silently falls back to "No Bean Selected". Would a toast/warning be more helpful?

3. **Should we also fix the duplicate occurrence?** There are two `window.location.href` calls in `BeanProfileTabs.svelte` that build the same URL (lines ~692 and ~797). Both should be fixed; want to confirm same approach applies to both, or if they're in different contexts that warrant different handling.

4. **Playwright coverage:** Is there an existing E2E test for the Beans → New Roast flow? If not, should this PR add a basic smoke test, or keep it to a code fix only?
