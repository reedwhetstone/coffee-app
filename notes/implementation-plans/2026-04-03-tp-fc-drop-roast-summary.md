# Implementation Plan: Roast Milestone Display + Chart Scaling + Chat Time Formatting

**Date:** 2026-04-03
**Repo:** coffee-app + purveyors-cli
**Estimated complexity:** Medium (3 coordinated fixes)
**Risk:** Low

---

## Overview

Three related roast data display issues, all stemming from milestone/timing/control data that exists in the DB but is either not fetched, not scaled correctly, or not formatted for LLM consumption.

---

## Bug 1: GenUI Roast Table Shows `-` for FC, Drop, ROR

**Root cause:** The CLI's `listRoasts()` uses a hardcoded SELECT string that omits milestone and analytics columns:
```
roast_id, batch_name, coffee_id, coffee_name, roast_date, oz_in, oz_out, weight_loss_percent, roast_notes, roaster_type, roaster_size, temperature_unit, total_roast_time, development_percent, data_source, last_updated
```

Missing: `fc_start_time`, `fc_start_temp`, `fc_end_time`, `fc_end_temp`, `drop_time`, `drop_temp`, `charge_temp`, `tp_time`, `tp_temp`, `total_ror`, `dry_percent`, `maillard_percent`, `auc`, `dry_phase_ror`, `mid_phase_ror`, `finish_phase_ror`, `dry_phase_delta_temp`

The `RoastProfile` interface declares these fields, but they're never fetched. The GenUI `RoastProfilesBlock.svelte` table renders them as `-`.

**Fix (purveyors-cli):** Add the missing columns to `ROAST_LIST_SELECT` in `src/lib/roast.ts`. The fields are lightweight (nullable numbers); adding them to the SELECT has negligible performance impact.

**Files:** `repos/purveyors-cli/src/lib/roast.ts` (ROAST_LIST_SELECT + ROAST_DETAIL_SELECT)

---

## Bug 2: Heat/Fan Lines Overflow the Chart

**Root cause:** In `RoastChart.svelte`, the control scale domain is hardcoded:
```typescript
controlScale = scaleLinear()
    .domain([0, 10])
    .range([innerH, innerH * 0.7]);
```

Artisan .alog files commonly store heat as 0-100 (percentage) and fan as 0-100. A domain of [0, 10] means values like 60 (heat) and 35 (fan) render far above the chart boundary.

**Fix (coffee-app):** Compute the actual max value across all control series points and use it for the domain. Snap to a clean ceiling (e.g., 10, 50, 100) for readability.

**Files:** `repos/coffee-app/src/lib/components/roast/chart/RoastChart.svelte`

---

## Bug 3: Chatbot Says "427 Minutes" Instead of "7:07"

**Root cause:** All time fields (`total_roast_time`, `fc_start_time`, `drop_time`, `tp_time`, etc.) are stored in **seconds** in the database. The LLM receives raw numbers like `427` and interprets them as minutes. The system prompt has no guidance about time units.

**Fix (coffee-app):** Format time fields into human-readable `m:ss` strings in the tool output transformation before the LLM sees them. This is better than a system prompt note because:
- Prevents misinterpretation regardless of model
- Makes the tool output self-documenting
- Applies consistently across workspace types

Add formatted fields alongside raw ones (e.g., `total_roast_time_fmt: "7:07"`) so the GenUI table formatter still gets raw seconds for its own `formatTime()` helper.

**Files:** `repos/coffee-app/src/lib/services/tools.ts` (roast_profiles execute block)

---

## Feature: Milestones Section in RoastProfileDisplay

**Context from investigation:** The roast profile detail panel (`RoastProfileDisplay.svelte`) currently shows only `oz_in`, `oz_out`, `roast_notes`, and `roast_targets`. Milestone data (TP, FC, DROP) is available from the API and visible on the chart, but not in the summary panel.

**What already shows milestones elsewhere:**
- GenUI `RoastProfilesBlock.svelte` table: FC, Drop, Dev%, WL%, ROR columns (will work once Bug 1 is fixed)
- Roast chart: milestone markers on the temperature curve
- Chart tooltip: BT, ET, ROR at hover point

**What's missing:** The `RoastProfileDisplay.svelte` summary cards below the chart. This is the most natural place for a compact milestones section since it's the detail view for a single roast.

**Approach:** Add a read-only "Milestones" card section to `RoastProfileDisplay.svelte`:

```
Milestones
TP     3:42 @ 320°F
FC     8:15 @ 375°F
DROP   11:45 @ 410°F
Total  12:10
```

- 2 cols mobile, 3 desktop
- Hidden entirely when all milestone fields are null (manual entries)
- Read-only (milestones are computed from events, not user-editable)
- FC end shown only if non-null (less commonly tracked)

**Not adding milestones to:** Bean profile tabs, inventory views, or the roast list sidebar. Those contexts prioritize different data (bean attributes, stock levels, batch overview). The GenUI table already covers the tabular comparison use case.

---

## Implementation Plan

### PR 1: purveyors-cli (prerequisite)
**Branch:** `fix/roast-list-select-milestone-fields`

1. Add missing columns to `ROAST_LIST_SELECT` and `ROAST_DETAIL_SELECT` in `src/lib/roast.ts`
2. Verify `RoastProfile` interface already has these fields (it does)
3. Bump patch version
4. `npm test`, push, open PR

### PR 2: coffee-app (all three fixes + milestones display)
**Branch:** `fix/roast-chart-scaling-time-format-milestones`

1. **Chart control scale:** In `RoastChart.svelte`, derive `controlScale` domain from actual data max instead of hardcoded `[0, 10]`
2. **Chat time formatting:** In `tools.ts` roast_profiles execute block, add formatted time fields to the output so the LLM sees `"7:07"` not `427`
3. **Milestones display:** Add milestones section to `RoastProfileDisplay.svelte`
4. Run `pnpm check`, `pnpm lint`, push, open PR
5. Bump CLI dep after PR 1 merges (or use `workspace:*` if applicable)

---

## Acceptance Criteria

- [ ] GenUI roast table shows real FC time/temp, Drop time/temp, and ROR values
- [ ] Chart heat/fan lines stay within the chart boundary for values up to 100
- [ ] Chatbot describes roast times in minutes:seconds format, not raw seconds
- [ ] `RoastProfileDisplay.svelte` shows milestones section for .alog-imported roasts
- [ ] Milestones section hidden for manual entries with no data
- [ ] All checks pass: `pnpm check`, `pnpm lint`, `pnpm test:unit`

---

## Risks

- **CLI version bump:** coffee-app needs the updated CLI to get milestone fields in tool responses. PR 2 can proceed in parallel but the GenUI fix only works end-to-end after PR 1 is published.
- **Control scale edge case:** Some Artisan profiles may have control values in different scales (0-10 vs 0-100 vs 0-255). Using actual data max handles all cases correctly.
- **Time formatting:** Adding `_fmt` fields alongside raw fields keeps backward compatibility. The GenUI table's `formatTime()` helper still works on raw seconds.
