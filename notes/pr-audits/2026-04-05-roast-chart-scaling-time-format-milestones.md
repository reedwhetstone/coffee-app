# PR Audit: fix/roast-chart-scaling-time-format-milestones

**PR:** #216
**Branch:** `fix/roast-chart-scaling-time-format-milestones`
**Commit:** `4406c01`
**Files changed:** 3 (+112, -6)
**Auditor model:** anthropic/claude-opus-4-6
**Date:** 2026-04-05

---

**Overall verdict:** PASS WITH NOTES
**Confidence:** HIGH

---

## P0 — Blockers (must fix before merge)

None.

## P1 — Required (should fix before merge)

None.

## P2 — Recommended (fix soon, low risk to defer)

### P2-1: `formatTime` in tools.ts uses `Math.floor` for seconds, GenUI uses `Math.round`

**File:** `src/lib/services/tools.ts:294` vs `src/lib/components/genui/blocks/RoastProfilesBlock.svelte:23`

The new `formatTime` in tools.ts uses `Math.floor(seconds % 60)` while the existing GenUI `formatTime` uses `Math.round(seconds % 60)`. This means a value like `427.7` seconds would render as `7:07` in the LLM's `_fmt` field but as `7:08` in the GenUI card.

The discrepancy is small but could confuse users if the LLM quotes a time that doesn't match the UI card below it.

**Recommendation:** Align both to use the same rounding. `Math.round` is arguably more correct for display, but `Math.floor` is the more common convention in roast software (Artisan truncates). Pick one and apply consistently. Low urgency since sub-second precision in stored roast data is uncommon.

### P2-2: Duplicate `formatTime` / `formatMilestoneTime` logic across three locations

**Files:**
- `src/lib/services/tools.ts:292` (`formatTime`)
- `src/routes/roast/RoastProfileDisplay.svelte:21` (`formatMilestoneTime`)
- `src/lib/components/genui/blocks/RoastProfilesBlock.svelte:19` (`formatTime`)

Three independent implementations of "seconds → M:SS" now exist. They differ in rounding behavior (floor vs round) and null-return semantics (null vs dash vs em-dash). This is a minor DRY violation and a future maintenance trap.

**Recommendation:** Extract a shared `formatSecondsToTime(seconds: number): string` utility (e.g., in `$lib/utils/format.ts`) and import it in all three locations. Can be deferred but worth tracking.

### P2-3: `as string[]` type assertion on TIME_FIELDS is unnecessary

**File:** `src/lib/services/tools.ts:305`

```ts
const TIME_FIELDS = [
    'total_roast_time',
    ...
] as string[];
```

The array literal already infers as `string[]`. The `as string[]` cast widens the literal union type but adds no safety. It's harmless but noise.

**Recommendation:** Remove `as string[]`; the literal already satisfies `string[]`. Very low priority.

## P3 — Notes (informational, no action required)

### P3-1: Chart control scale ceiling selection is reasonable but discrete

**File:** `src/lib/components/roast/chart/RoastChart.svelte:55-62`

The ceiling snaps to discrete values: 10, 50, 100, then multiples of 100. This means:
- A max value of 11 snaps to 50 (4.5x headroom)
- A max value of 51 snaps to 100 (nearly 2x headroom)

This is visually fine since control lines occupy the bottom 30% of chart height, so excess headroom just compresses lines slightly within that band. The snap points match common Artisan ranges (0-10 for normalized, 0-100 for raw percentage). No action needed.

### P3-2: controlScale still initializes maxVal to 10 even when controlSeries is empty

**File:** `src/lib/components/roast/chart/RoastChart.svelte:49-50`

When `chartData.controlSeries` is an empty array, the loop never executes and `maxVal` stays at 10, producing `ceiling = 10` and domain `[0, 10]`. This matches the previous hardcoded behavior, so it's correct. Just noting for completeness.

### P3-3: Milestones section visibility condition doesn't include `fc_end_time`

**File:** `src/routes/roast/RoastProfileDisplay.svelte:224`

The visibility guard checks:
```svelte
{#if profile.tp_time != null || profile.fc_start_time != null || profile.drop_time != null || profile.total_roast_time != null}
```

But `fc_end_time` is not in the condition. A profile that somehow has only `fc_end_time` set (no TP, FC start, drop, or total) would not show the milestones panel, even though FC End is rendered inside. This edge case is essentially impossible in real Artisan data (FC end always implies FC start), so the omission is harmless.

### P3-4: `_fmt` fields are added outside the TypeScript type system

**File:** `src/lib/services/tools.ts:312-318`

The `profilesWithFmt` spread produces objects with extra `_fmt` keys not present in the `RoastProfile` type. Since tool results are serialized to JSON for LLM consumption (not rendered in typed Svelte components), this is fine. The `Record<string, string | null>` extra type is correct for the spread. The `(p as unknown as Record<string, unknown>)` cast at line 314 is necessary because the strict DB type doesn't have an index signature. Acceptable pattern for tool-output enrichment.

### P3-5: Whitespace-only change to `preSelectedValue` ternary

**File:** `src/lib/services/tools.ts:435`

A multi-line ternary was collapsed to a single line. This is a formatting-only change (likely prettier). No behavior impact.

### P3-6: Milestones panel uses consistent styling with existing card sections

**File:** `src/routes/roast/RoastProfileDisplay.svelte:225-282`

The milestones section uses `border-background-tertiary-light`, `text-primary-light`, and the same `rounded p-3` pattern as the oz_in/oz_out cards above. The responsive grid (`grid-cols-2 sm:grid-cols-4`) is appropriate. Temperature unit falls back to `'F'` which matches the app's predominant US-centric user base. The section is correctly read-only with no edit bindings. Good implementation.

### P3-7: Data integrity for GenUI confirmed

The `profilesWithFmt` spread in tools.ts uses `{ ...p, ...extra }`, which preserves all original fields from the DB query (including raw `total_roast_time`, `fc_start_time`, etc.) and adds `_fmt` companions alongside them. The GenUI `RoastProfilesBlock` component accesses raw fields directly (`profile.total_roast_time`, `profile.fc_start_time`) and has its own `formatTime` helper. No breakage path exists.

---

## Summary

Clean, well-scoped PR that addresses all three stated goals:

1. **Chart control scale** — Correctly computes dynamic ceiling from actual control series data. The snap-to-clean-value approach prevents ugly axis labels. The bottom-30% range allocation is preserved.

2. **LLM time formatting** — Adds `_fmt` companion fields to tool output without modifying raw values. The LLM now sees `"total_roast_time_fmt": "7:07"` alongside `"total_roast_time": 427`. GenUI components remain unaffected since they operate on raw seconds with their own formatters.

3. **Milestones panel** — Read-only section with correct null guards, temperature unit handling, and responsive layout. Hidden when no milestone data exists. Matches the described behavior.

The only substantive note (P2-1) is the floor-vs-round divergence between the new tools.ts formatter and the existing GenUI formatter, which could produce 1-second display discrepancies between what the LLM quotes and what the UI card shows. Worth aligning but not blocking.

No regressions, no side effects, no type safety issues. Ship it.
