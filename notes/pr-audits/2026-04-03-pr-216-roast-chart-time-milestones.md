# PR Verification Report

## Metadata

- Repo: coffee-app
- Base: origin/main (2b3ce81)
- Head: origin/fix/roast-chart-scaling-time-format-milestones (1ee869d)
- PR #216 - "fix: chart control scale, chat time formatting, milestones display"
- Reviewer model: anthropic/claude-opus-4-6
- Confidence: High
- Scope note: 4 files changed, 97 insertions, 6 deletions. Single commit. Tightly scoped.

## Executive Verdict

- Merge readiness: **Ready with fixes**
- Intent coverage: Full
- Priority summary: P0: 0, P1: 1, P2: 2, P3: 2

## Intent Verification

- **Stated intent:** Three related roast data display fixes: (1) chart control scale overflow for Artisan .alog values 0-100, (2) chat time formatting adding `_display` fields so LLM shows m:ss instead of raw seconds, (3) milestones display (TP/FC/Drop) below the chart in RoastProfileDisplay.svelte.
- **What was implemented:** All three items are addressed. Control scale now derives domain from actual data max with clean ceiling snapping. `_display` fields added to roast tool output with system prompt guidance. Milestones section added to RoastProfileDisplay with TP, FC Start, FC End (conditional), DROP, and Total Time.
- **Coverage gaps:** One timing field (`tp_time`) omitted from the `_display` mapping in tools.ts and from the ROAST DATA UNITS system prompt section. See P2-1 below.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

**P1-1: Hardcoded °F in `formatMilestoneTemp` ignores `temperature_unit`**

- **Evidence:** `src/routes/roast/RoastProfileDisplay.svelte` line ~135 in the branch: `return \`@ ${Math.round(temp)}°F\`;`
- **Impact:** Users with Celsius-based roast profiles (Artisan supports both) will see temperatures labeled as °F when they are actually °C. The database schema has a `temperature_unit` field on `roast_profiles` (confirmed in `database.types.ts` line 445: `temperature_unit: string | null`). This is a data correctness issue visible to end users.
- **Correction:** Either use `profile.temperature_unit ?? 'F'` to display the correct unit, or follow the pattern in `RoastProfilesBlock.svelte` which uses `formatTemp()` returning just `${Math.round(temp)}°` (unit-agnostic). The simpler fix is to drop the "F":
  ```typescript
  function formatMilestoneTemp(temp: number | null): string {
  	if (temp == null) return '';
  	return `@ ${Math.round(temp)}°`;
  }
  ```
  Or, for full correctness, pass `temperature_unit` into the function.

### P2 (important improvements)

**P2-1: `tp_time_display` missing from formatted tool output and system prompt**

- **Evidence:** `src/lib/services/tools.ts` maps `total_roast_time`, `fc_start_time`, `fc_end_time`, `drop_time`, and `charge_time` to `_display` fields. But `tp_time` (turning point time) exists in the database schema (`database.types.ts` line 449) and is rendered in the new milestones UI. The system prompt's ROAST DATA UNITS section in `+server.ts` also omits `tp_time` from its list.
- **Impact:** If the LLM discusses turning point timing, it will receive raw seconds for `tp_time` without a `_display` companion, creating inconsistency with the other timing fields. The LLM _might_ still format it correctly using the general system prompt instruction, but the asymmetry is a latent source of incorrect output.
- **Correction:** Add `tp_time_display: formatSecondsToTime(p.tp_time ?? null)` to the mapping in `tools.ts`, and add `tp_time` to the ROAST DATA UNITS list in `+server.ts`.

**P2-2: Duplicated time formatting logic across three files**

- **Evidence:**
  - `src/lib/services/tools.ts`: `formatSecondsToTime(seconds)` returns `null` for null, `m:ss` otherwise
  - `src/routes/roast/RoastProfileDisplay.svelte`: `formatMilestoneTime(seconds)` returns `'—'` for null, `m:ss` otherwise
  - `src/lib/components/genui/blocks/RoastProfilesBlock.svelte`: `formatTime(seconds)` returns `'-'` for null, `m:ss` otherwise
  - All three have identical core logic: `Math.floor(seconds / 60)` + `Math.round(seconds % 60).padStart(2, '0')`
- **Impact:** Tech debt. Any future bug fix (e.g., the rounding edge case in P3-1) must be applied in three places. Divergent null-return values (`null` vs `'—'` vs `'-'`) suggest no single convention.
- **Correction:** Extract a shared utility to `src/lib/utils/time.ts`:
  ```typescript
  export function formatSecondsToMinSec(seconds: number): string {
  	const mins = Math.floor(seconds / 60);
  	const secs = Math.round(seconds % 60);
  	return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  ```
  Each consumer wraps it with its own null handling. Can be done in follow-up.

### P3 (nice to have)

**P3-1: `Math.round(seconds % 60)` can produce `:60` output**

- **Evidence:** All three formatting functions use `Math.round(seconds % 60)`. If the input is a float where the fractional remainder rounds up (e.g., `seconds = 119.7` → `119.7 % 60 = 59.7` → `Math.round(59.7) = 60`), the output is `"1:60"` instead of `"2:00"`.
- **Impact:** Very low probability. Database values are typically integer seconds or clean decimals. Pre-existing pattern in `RoastProfilesBlock.svelte`.
- **Correction:** Use `Math.floor` instead of `Math.round`, or handle the rollover: `if (secs >= 60) { mins += 1; secs -= 60; }`. Low priority.

**P3-2: Control scale early-return path still has hardcoded [0,10] domain**

- **Evidence:** `RoastChart.svelte` line ~47: `if (innerH <= 0) return scaleLinear().domain([0, 10]).range([0, 0]);`
- **Impact:** None. The range [0,0] maps everything to zero regardless of domain. This is a cosmetic inconsistency only.
- **Correction:** Could change to `domain([0, 1])` or leave as-is. No functional impact.

## Assumptions Review

| Assumption                                              | Validity  | Why                                                                                                                                                           | Action                            |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Control series values max at ~100 (Artisan range)       | **Valid** | Artisan .alog heat/fan values range 0-100. Ceiling snapping to 50/100/ceil(n/50)\*50 covers all practical ranges                                              | None                              |
| All time fields on roast_profiles are in seconds        | **Valid** | Confirmed by database schema, .alog parsing code, and existing `formatTime()` usages in RoastProfilesBlock                                                    | None                              |
| Temperatures are in °F                                  | **Weak**  | Database has `temperature_unit` field that can be 'F' or 'C'. Most users use °F but Celsius is valid                                                          | Fix P1-1                          |
| LLM will respect `_display` field guidance              | **Valid** | System prompt is explicit and provides example. Standard AI SDK pattern                                                                                       | None                              |
| TP/FC/Drop fields are populated for most roast profiles | **Weak**  | These come from .alog milestone extraction. Manual roast entries may have nulls. The UI handles this with em-dash fallback, so functional behavior is correct | None (graceful degradation works) |

## Tech Debt Notes

- **Debt introduced:** Three separate implementations of the same seconds-to-time formatting. The `formatMilestoneTime` and `formatMilestoneTemp` helpers are component-local rather than shared utilities.
- **Debt worsened:** Existing duplication between `RoastProfilesBlock.svelte` (local `formatTime`) and `roast-math.ts` (`formatTimeDisplay` which takes milliseconds) is now joined by two more copies.
- **Suggested follow-up:** Extract `formatSecondsToMinSec()` to `src/lib/utils/time.ts`. Have all consumers import it. Address the ms vs seconds split between `roast-math.ts` (live roasting, milliseconds) and stored profiles (seconds).

## Product Alignment Notes

- **Alignment wins:** All three fixes directly address user-reported display issues. The milestone section is clean, responsive (grid cols adapt), and conditionally hidden when no milestone data exists. The ceiling-snapping logic for chart scale (10/50/100) produces clean axis values. The LLM system prompt guidance is clear and includes a worked example.
- **Misalignments:** The °F hardcoding (P1-1) is the only product-facing concern. International or Celsius-preference users will see incorrect unit labels.
- **Suggested product checks:** Verify milestone display looks correct on a real roast profile with all milestones populated, and one with sparse data (only FC Start + Drop, no TP/FC End).

## Test Coverage Assessment

- **Existing tests that validate changes:** None directly. `roast-math.test.ts` tests `formatTimeDisplay` (millisecond variant) but doesn't cover the new seconds-based formatters. No component tests for RoastProfileDisplay or RoastChart.
- **Missing tests:**
  - Unit test for `formatSecondsToTime` in tools.ts (edge cases: 0, null, 59.5, large values)
  - Snapshot or render test for milestones section in RoastProfileDisplay
- **Suggested test additions:** Given the low complexity and existing test patterns, a follow-up unit test for the extracted shared utility (P2-2) would cover all three consumers. Not blocking for merge.

## Minimal Correction Plan

1. **P1-1 (required):** Change `formatMilestoneTemp` in `RoastProfileDisplay.svelte` to either use `profile.temperature_unit` or omit the unit letter (just `°`) to match `RoastProfilesBlock.svelte` convention.
2. **P2-1 (recommended):** Add `tp_time_display` to the formatted profiles in `tools.ts` and add `tp_time` to the ROAST DATA UNITS list in `+server.ts`.
3. **P2-2 (defer):** Shared time format utility extraction can be a follow-up PR.

## Optional Patch Guidance

### P1-1 Fix (RoastProfileDisplay.svelte)

Replace:

```typescript
function formatMilestoneTemp(temp: number | null): string {
	if (temp == null) return '';
	return `@ ${Math.round(temp)}°F`;
}
```

With:

```typescript
function formatMilestoneTemp(temp: number | null, unit?: string | null): string {
	if (temp == null) return '';
	return `@ ${Math.round(temp)}°${unit ?? 'F'}`;
}
```

And update all callsites to pass `profile.temperature_unit`:

```svelte
{formatMilestoneTemp(profile.tp_temp ?? null, profile.temperature_unit)}
```

### P2-1 Fix (tools.ts + +server.ts)

In `tools.ts`, add to the `formattedProfiles` mapping:

```typescript
tp_time_display: formatSecondsToTime(p.tp_time ?? null),
```

In `+server.ts`, update the ROAST DATA UNITS block:

```
All roast timing fields (total_roast_time, fc_start_time, fc_end_time, drop_time, charge_time, tp_time) are in SECONDS, not minutes.
```
