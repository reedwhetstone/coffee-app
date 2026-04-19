# Implementation Plan: Score Badge + Rating Decimal Precision Fix

**Date:** 2026-03-30
**Slug:** score-rating-display-formatting
**Status:** Planning only — awaiting Reed approval before coding
**Repo:** coffee-app (web-only; no CLI changes needed)
**Branch ready:** `origin/fix/score-rating-display` (1 commit ahead of main: `09f2652`)

---

## Feature

**DEVLOG items (Priority 2):**

- "UI/UX — Clean up beans catalog profiles to remove exposed user reference fields from the display" (adjacent: score visibility on catalog)
- Implicit from the existing branch: show supplier quality `score_value` as an amber badge on `CoffeeCard` (full and compact modes), and fix rank precision in `BeanProfileTabs` to preserve `.5` ratings instead of rounding to integer.

**The existing `09f2652` commit delivers:**

1. `CoffeeCard.svelte` — amber score badge (`Score: X.X`) visible when `coffee.score_value != null`, in both full and compact card views
2. `BeanProfileTabs.svelte` — rank display in rating crescent and cupping tab now shows `.5` precision (e.g., 7.5 instead of 8) using the pattern `rank % 1 === 0 ? rank : rank.toFixed(1)`

**Files changed:** 2 (`src/lib/components/CoffeeCard.svelte`, `src/routes/beans/BeanProfileTabs.svelte`)

---

## Why Now

The `fix/score-rating-display` branch has been sitting since Mar 28 with a clean, isolated 2-file commit. The code is already written and tested in isolation. This is a pure merge exercise.

The score badge addresses a real product gap: `score_value` is a scraped supplier quality indicator (appears in 35 supplier feeds), but it was invisible to users browsing the catalog. Adding the badge to `CoffeeCard` makes this data visible without requiring a user to open a bean profile.

The rank precision fix is a UI correctness issue: a user who rates a bean 7.5/10 sees it rounded to 8, which misrepresents their recorded preference. This affects the tasting feedback loop — a core retention mechanic.

---

## Candidate Scoring

| Candidate                                | Priority | Complexity | Risk      | Deps    | Total                 |
| ---------------------------------------- | -------- | ---------- | --------- | ------- | --------------------- |
| Score badge + rating precision (this PR) | P2=6     | easy=10    | low=0     | none=0  | **16**                |
| Artisan import loading indicator         | P5=4     | easy=10    | low=0     | none=0  | **14**                |
| Profit page reactive refresh             | P3=5     | easy=10    | low=0     | none=0  | **15**                |
| Cupping dashed lines opacity             | P2=6     | easy=10    | low=0     | none=0  | **16 (stale branch)** |
| Mobile Navigation                        | P0=10    | hard=2     | medium=-2 | none=0  | **10**                |
| Cupping notes reactive refresh           | P2=6     | medium=6   | medium=-2 | some=-2 | **8**                 |
| Cascade delete for beans                 | P1=8     | hard=2     | high=-5   | none=0  | **5**                 |

**Winner rationale:** Ties at 16 with cupping dashed lines. Tiebreaker: `fix/score-rating-display` is 1 clean commit ahead of main — the branch needs only a PR opened. The cupping dashed lines branch (`fix/cupping-dashed-lines-opacity`) is 107 files _behind_ main (branched from ~PR #170 era), requiring a full rebase before it can be opened. That's scope creep disguised as an easy win. Score badge wins cleanly.

---

## Strategy Alignment Audit

**Active strategy themes this supports:**

1. **Public conversion funnel (P0)** — `CoffeeCard` renders in the public catalog at `/catalog`. Unauthenticated users browsing can now see supplier quality scores alongside price. Data density on the card increases — more signal per scan, lower friction to "this is worth signing up for." Directly supports the conversion funnel priority.

2. **Data transparency as product differentiator** — The blog theme across recent posts ("Who Profits When Coffee Data Stays Scarce?", "Beyond the Coffee Belt") is that purveyors surfaces metadata competitors hide. Score visibility on the card is a concrete manifestation of that positioning — structured quality data made instantly legible.

3. **User engagement loop (tasting/cupping)** — Rating precision fix is directly tied to the cupping workflow. If the displayed rank rounds away `.5` values, users lose confidence in their own recorded preferences. The cupping note form and radar chart are core engagement mechanics; this keeps them numerically honest.

**Contradictions or conflicts with current direction:** None. 2-file cosmetic-plus-precision change with no architectural implications. No API changes, no schema changes, no service boundary crossings.

**CLI cross-check:** `purveyors-cli` recent work (PRs #58-#63) is server-side filter improvements. No CLI changes needed here — `score_value` is already exposed in catalog responses.

**Why this vs. higher-priority items:**

- P0 Mobile Navigation and Homepage Routing are structural/hard (both implemented in large recent PRs; mobile nav redesign is still genuinely complex)
- P1 cascade delete is hard + high risk (foreign key dependencies, rollback complexity)
- This is the highest-scoring item that fits one clean PR with zero risk

---

## Scope

**In scope:**

- Open a PR from `origin/fix/score-rating-display` onto `main` with the existing single commit (`09f2652`)
- Verify CI passes on the branch before opening

**Out of scope:**

- Any changes beyond the 2 files in the commit
- Score badge styling changes (amber is the existing convention; matches wholesale badge pattern)
- Cupping notes reactive refresh (separate backlog item, different branch)
- Cupping dashed lines opacity fix (separate branch, needs rebase)

---

## Proposed UX Behavior

### CoffeeCard — Score Badge

- On catalog cards (both full and compact view), if `coffee.score_value != null`: show `Score: X.X` as an amber badge (matches wholesale badge style: `rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800`)
- Score badge appears next to the wholesale badge in the header row
- No badge rendered if `score_value` is null (most common case for suppliers that don't export scores)

### BeanProfileTabs — Rank Precision

- Rating crescent center display: `7.5` instead of `8` when rank is 7.5
- Cupping tab rank display: same precision fix
- Logic: `rank % 1 === 0 ? rank : rank.toFixed(1)` (avoids trailing `.0` for whole numbers)

---

## Files to Change

| File                                      | Change                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `src/lib/components/CoffeeCard.svelte`    | Add score badge in both full and compact card modes |
| `src/routes/beans/BeanProfileTabs.svelte` | Fix rank decimal precision in 2 display locations   |

No other files touched.

---

## API/Data Impact

None. Both changes are display-only. `score_value` is already included in catalog responses (confirmed present in `coffee_catalog` table). No new queries, no schema changes, no API contract changes.

---

## Acceptance Criteria

- [ ] CoffeeCard shows amber "Score: X.X" badge when `score_value` is not null
- [ ] CoffeeCard does not show score badge when `score_value` is null (most cards)
- [ ] Score badge uses same amber styling as wholesale badge (visual consistency)
- [ ] BeanProfileTabs rating crescent shows `7.5` not `8` for a 7.5 rating
- [ ] BeanProfileTabs cupping tab rank display also shows decimal precision (same fix applied consistently)
- [ ] Whole-number ratings display as integers (e.g., `8` not `8.0`)
- [ ] `pnpm check` passes (no TypeScript errors)
- [ ] `pnpm lint` passes (no lint errors)
- [ ] Playwright E2E smoke tests pass

---

## Test Plan

- **`pnpm check`** — zero type errors
- **`pnpm lint`** — clean
- **Manual verification (CoffeeCard):**
  1. Open `/catalog` — confirm score badges appear on cards that have `score_value` populated
  2. Confirm no badge on cards without `score_value`
  3. Confirm badge is visually consistent with wholesale badge (amber, pill shape)
- **Manual verification (BeanProfileTabs):**
  1. Open a bean profile where `rank` is 7.5 → confirm crescent displays `7.5`
  2. Open a bean profile where `rank` is 8.0 → confirm crescent displays `8` (no trailing `.0`)
  3. Switch to cupping tab → confirm same precision in rank display area
- **Playwright:** Existing smoke tests should still pass; no new test required for display-only changes

---

## Risks and Rollback

**Risk: score_value coverage is low (most cards show no badge)**

- This is expected behavior, not a bug. Score is a scraped field; many suppliers don't expose it.
- Rollback: trivially revert the 2-line addition in CoffeeCard.

**Risk: amber badge visual overlap with wholesale badge on cards that are both scored and wholesale**

- Probability: very low (wholesale coffees rarely have `score_value` in the current dataset)
- Mitigation: both badges render sequentially in the same flex row; they stack horizontally or wrap — safe layout behavior

**Rollback:** 2-file revert. Zero DB impact. No service boundary changes.

---

## Open Questions for Reed

1. **Score badge placement:** The commit puts the score badge adjacent to the wholesale badge in the card header row. Is this the right location, or would you prefer it elsewhere (e.g., in the price row, or below the supplier name)?

2. **Score formatting:** Currently displays as `Score: 7.5`. Should it show just the number, a cup icon, or a different label (e.g., `Q: 7.5` or `⭐ 7.5`)? The amber badge is visible as a quality signal regardless, but the label might need tuning.

3. **Is this branch safe to PR as-is?** The single commit (`09f2652`) is clean and ahead of main. This plan assumes we open the PR directly from `fix/score-rating-display`. Confirm before coding (or confirm we cherry-pick onto a fresh branch from main to avoid any merge noise from the older branch base).
