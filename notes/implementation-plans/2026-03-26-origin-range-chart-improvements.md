# Implementation Plan: Improve Origin Price Ranges Chart

**Date:** 2026-03-26
**Status:** Planning
**Repo:** coffee-app
**Target:** `src/lib/components/analytics/OriginBarChart.svelte` + `src/routes/analytics/+page.server.ts` + `src/routes/analytics/+page.svelte`

---

## Problem

The current **Origin Price Ranges** chart is technically correct but not doing a good job of communicating the important information.

### Reported issues

1. **Long tail of the maximums**

   - A few very high `price_max` values stretch the x-axis
   - This compresses the majority of origins into the left side of the chart
   - The result is visually noisy and less insightful

2. **Bottom of the chart gets cut off**

   - X-axis labels and/or bottom rows are cramped
   - The chart container is too short for the number of rows being shown
   - Bottom padding is also too small (`padding.bottom = 10` currently)

3. **Origin selection is opaque and not user-controlled**
   - Right now origins are selected server-side as the **top 15 by sample size**
   - Then they are sorted client-side by median price ascending
   - That behavior is not visible in the UI and not adjustable
   - Reed wants something more like the Price Trends by Origin chart selector

---

## Current Behavior Audit

### Origin selection today

In `+page.server.ts`, `originRangeData` is:

- grouped from live `coffee_catalog`
- filtered to countries with `sample_size >= 3`
- sorted by `sample_size desc`
- sliced to **top 15**

Then in `OriginBarChart.svelte`, the chart re-sorts those 15 by `price_median asc`.

So the effective behavior today is:

- **selection criterion** = top 15 by bean count
- **display order** = lowest median price to highest median price

This is reasonable for an MVP, but hidden and too rigid.

### Why the max tail is hurting readability

The chart sets:

- `xDomainMin` from `min(price_min)`
- `xDomainMax` from `max(price_max) * 1.05`

That means a single extreme max stretches the whole domain.

But the actual visual insight of the chart is mostly in:

- **IQR** (`price_q1` → `price_q3`)
- **median**
- **mean** deviation from median

The full min/max range is useful context, but not a good default driver of the scale.

---

## Recommendation

## Core design change

Treat the chart as a **distribution insight chart**, not a literal full-range chart.

That means:

- the **IQR + median** should drive readability
- the **min/max tails** should be secondary
- origin selection should be visible and user-controlled

---

## Proposed Changes

### 1. Change the default x-axis scaling to prioritize the core distribution

#### Recommendation: use a robust domain, not absolute `price_max`

Instead of making the x-axis end at the single largest `price_max`, compute the right bound from a more stable statistic.

**Recommended default:**

- `xDomainMin` = min of `price_q1` / `price_min` with small left padding
- `xDomainMax` = **95th percentile of `price_q3` or `price_median`** with right padding

This keeps the chart focused on the part of the distribution users actually care about.

#### What to do with max tails

Do **not** remove max information entirely. Instead:

- keep min/max whiskers visually subtle
- if a max extends beyond the robust domain, **clip it and show an overflow indicator**
  - small arrow/cap at the right edge
  - tooltip still shows true max
- optionally add a small note in the legend: `→ whisker clipped when outlier exceeds chart scale`

This preserves truth without letting one outlier destroy the chart.

#### Why not log scale?

A log scale would reduce the tail problem, but it makes price intuition worse for most users. This chart should stay linear.

---

### 2. Make the chart taller and fix the bottom cut-off

#### Current problem

- container height is fixed at `h-64` / `sm:h-80`
- bottom padding is only `10`
- 15 rows is too much vertical content for that height

#### Recommendation

**In dashboard mode:**

- show fewer rows by default, e.g. **top 8**
- increase bottom padding to **28–36px**
- increase chart height slightly

**In expanded mode:**

- make height dynamic based on visible row count
- formula recommendation:
  - `height = max(360, visibleOrigins * 28 + 80)`

This prevents:

- bottom axis labels from clipping
- lowest row from crowding the bottom axis
- text collisions on dense origin lists

---

### 3. Replace opaque server-side top-15 slicing with chart-level origin selection

#### Current problem

The server decides the origin set and the UI never explains it.

#### Recommendation

Match the pattern used in **Price Trends by Origin**:

- dashboard mode: auto-select a small default set
- expanded mode: allow user selection

#### Recommended behavior

**Server (`+page.server.ts`)**

- stop slicing to top 15
- return all origin rows that meet a minimum quality threshold
- recommended threshold: `sample_size >= 3`
- cap total returned rows at something safe like 50 if needed

**Client (`OriginBarChart.svelte`)**

- maintain `selectedOrigins`
- default to **top 8 by sample size**
- expanded mode gets an origin selector dropdown similar to `OriginLineChart`
- sort selected origins in display by median price ascending

This gives:

- stable default readability
- explicit user control
- continuity with the line chart interaction model

#### Why top 8 by default?

15 rows is too dense for the collapsed card. Top 8 is easier to scan and gives more breathing room.

---

### 4. Improve what the chart emphasizes visually

#### Keep

- IQR bar
- median dot
- mean marker
- sample size labels

#### Reduce emphasis on

- full min/max whiskers

#### Specific visual recommendations

- make min/max whiskers lighter and thinner
- keep IQR as the primary solid visual object
- slightly enlarge median marker for quick scanning
- optionally add color tint on rows with large mean/median gap to highlight skew

This shifts the chart from “everything equally loud” to “core distribution first, outliers second”.

---

### 5. Improve the subtitle and labeling so selection logic is clear

Current subtitle:

> Price spread by origin — IQR box, median & mean markers, full min/max range

Recommended subtitle:

> Distribution of current bean prices by origin. Showing the top selected origins by bean count; median and IQR emphasized, full min/max shown as secondary context.

If we add clipping, mention it in the legend or tooltip.

---

## Proposed MVP Implementation

### Phase 1: readability fixes

1. Increase bottom padding in `OriginBarChart.svelte`
2. Increase chart height in `+page.svelte`
3. Reduce default visible origins from 15 → 8
4. Change x-axis domain to robust scale (not absolute max)
5. Clip outlier max whiskers with right-edge indicator

### Phase 2: interaction improvements

6. Move origin selection from server-side hard slice to client-side selector
7. Add dropdown selector in expanded mode, modeled after `OriginLineChart`
8. Show default top 8 by sample size in collapsed mode

### Phase 3: insight upgrades

9. Add sort mode options if useful:
   - median price
   - sample size
   - spread width (`price_q3 - price_q1`)
10. Consider a toggle:

- `Core distribution`
- `Full range`

For MVP, **Phase 1 + origin selector from Phase 2** is the right scope.

---

## Files to Change

### `src/routes/analytics/+page.server.ts`

- stop slicing `originRangeData` to top 15
- return all origins meeting min sample threshold (or cap at 50)
- keep row metrics the same

### `src/routes/analytics/+page.svelte`

- increase chart container height
- potentially pass `expanded` state into `OriginBarChart`
- update subtitle copy

### `src/lib/components/analytics/OriginBarChart.svelte`

- add `expanded?: boolean` prop
- add client-side origin selection state
- implement default top 8 selection
- add selector UI in expanded mode
- adjust padding bottom
- compute robust x-domain
- render clipped max whiskers / overflow markers

---

## Acceptance Criteria

- [ ] Bottom axis and lowest rows are fully visible; no cut-off
- [ ] Default chart is easier to read with fewer origins shown in collapsed mode
- [ ] Long-tail max outliers no longer compress the core distribution
- [ ] True max values remain accessible via tooltip, even if clipped visually
- [ ] Origin selection is visible and user-controllable in expanded mode
- [ ] Default origin set is clearly based on bean count / coverage
- [ ] Chart remains linear, not log-scaled
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes

---

## Product Recommendation

If only one change ships first, it should be:

**Use a robust x-domain + clip outlier max whiskers.**

That will produce the biggest immediate improvement in readability.

If two changes ship together, pair that with:

**Top 8 default + expanded selector.**

That will solve both the density problem and the "how were these origins chosen?" confusion.

---

## Recommended final UX

- **Collapsed card:** top 8 origins by sample size, robust x-scale, cleaner distribution view
- **Expanded card:** full selector, dynamic height, same robust scale, all insights preserved in tooltips
- **Primary story:** median + IQR comparison across origins
- **Secondary story:** outlier min/max context available but not dominant
