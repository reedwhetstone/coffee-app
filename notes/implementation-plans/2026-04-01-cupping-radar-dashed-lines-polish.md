# Implementation Plan: Cupping Radar Dashed Lines Visual Polish

**Date:** 2026-04-01
**Slug:** cupping-radar-dashed-lines-polish
**Status:** Planning only — awaiting Reed approval before coding
**Repo:** coffee-app (web-only; no CLI changes needed)

---

## Feature

**DEVLOG item (Priority 2):**

> "Supplier cupping note dashed lines are too dark and visually distracting. Reduce opacity or change to lighter color."

The `TastingNotesRadar` component renders two overlaid data sets on the spider chart:

- **User cupping data:** filled circles with solid stroke at `stroke-opacity: 1`
- **AI cupping overlay** (when both sets present): dashed circles at `stroke: '#f9a57b'`, `stroke-width: 1`, `stroke-opacity: 0.3`, `stroke-dasharray: '3,6'`

Additionally, the background **concentric grid circles** use `stroke: '#e5e7eb'` at `opacity: 0.1`, and the **axis lines** use `stroke: '#e5e7eb'` at `opacity: 0.2`.

The reported complaint is that the dashed lines are "too dark and visually distracting." Based on the code, the AI overlay circles are already at `stroke-opacity: 0.3`, which should be light. The most likely culprit is the **axis lines** at `opacity: 0.2` on top of a light `#e5e7eb` color — in certain backgrounds these render as visibly bold dashes (they're solid, not dashed). Or the AI dashed overlay is more visible than intended when the background is light.

The fix involves reducing opacity values and possibly smoothing the dash-gap ratio for the AI overlay circles.

---

## Why Now

- Single-file, 4–6 line change with zero functional risk
- Visual polish directly on the tasting/cupping feature — a core differentiator and content source for the blog pillar on data richness
- No dependency on schema, API, or other components
- Ties cleanly to the market-intelligence blog narrative: cupping data is a first-class signal; it should look polished and trustworthy

---

## Strategy Alignment Audit

**Supports:**

- "Data-rich sourcing intelligence" theme — tasting radar chart is a flagship visualization; rough aesthetics undermine trust in the data
- "Roaster credibility tools" narrative in blog posts: the cupping interface is part of the product story Reed is actively writing about
- No contradiction with any current blog or roadmap direction

**Neutral:**

- No bearing on the PPI revenue product, public catalog funnel, or mobile navigation

**Verdict:** Aligned. Polish on a flagship visualization is always safe; this directly supports the tasting-data credibility angle in the market-intelligence blog pillar.

---

## Scope

**In:**

- Reduce visual weight of the AI cupping overlay dashed circles (opacity, dash pattern, or both)
- Optionally reduce the axis lines opacity slightly if they read dark on light backgrounds
- No changes to user data circles (keep those solid/vibrant)

**Out:**

- No changes to layout, sizing, or data logic
- No changes to how the legend text renders ("Solid circles: AI assessment • Dashed circles: Your assessment")
- No changes to the color palette (`#f9a57b` orange accent for AI is appropriate and on-brand)

---

## Proposed Changes

**File:** `src/lib/components/TastingNotesRadar.svelte`

### Change 1: AI overlay dashed circles (lines ~149–153)

Current:

```js
.attr('fill-opacity', 0)
.attr('stroke', '#f9a57b')
.attr('stroke-width', 1)
.attr('stroke-opacity', 0.3)
.attr('stroke-dasharray', '3,6');
```

Proposed:

```js
.attr('fill-opacity', 0)
.attr('stroke', '#f9a57b')
.attr('stroke-width', 0.75)       // softer stroke weight
.attr('stroke-opacity', 0.18)     // reduce from 0.3 → 0.18
.attr('stroke-dasharray', '2,8'); // wider gap for lighter feel
```

### Change 2: Axis lines (lines ~94–96)

Current:

```js
.attr('stroke', '#e5e7eb')
.attr('stroke-width', 1)
.attr('opacity', 0.2)
```

Proposed:

```js
.attr('stroke', '#e5e7eb')
.attr('stroke-width', 0.75)      // from 1 → 0.75
.attr('opacity', 0.15)           // from 0.2 → 0.15
```

---

## Files to Change

| File                                          | Change                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/TastingNotesRadar.svelte` | Reduce AI dashed circle stroke-opacity + stroke-width + dash spacing; reduce axis line opacity + stroke-width |

No other files touched.

---

## API / Data Impact

None. This is a pure visual/rendering change within the SVG drawing function. No data model, API route, or server-side changes.

---

## Acceptance Criteria

- [ ] On a bean with both AI tasting notes AND user cupping notes, the AI dashed circles are visibly present but clearly subordinate — they don't compete with the solid user circles
- [ ] The axis radial lines are subtle guidelines, not prominent dark lines
- [ ] On a bean with only AI tasting notes (no user overlay), the circles render in original solid fill style (unchanged path — the dashed style only applies when `showOverlay && userRadarData.length > 0`)
- [ ] No regression: chart still renders correctly at default `size={300}` and compact `size={120}`
- [ ] `pnpm lint && pnpm check` passes
- [ ] Visual diff: opens `/beans`, picks a bean with both AI and user notes, cupping tab looks clean

---

## Test Plan

- **Manual:** Open `/beans`, select a bean with both AI tasting notes and saved user cupping notes. Switch to Cupping tab. Verify the AI overlay circles are light/ghosted vs the solid user circles.
- **Manual:** Select a bean with only AI notes (no user notes). Verify original solid-fill style still renders (no change expected in that path).
- **Lint/type check:** `pnpm lint && pnpm check` — no new issues expected (no logic changes, only numeric attribute values)
- **No vitest changes needed** — no logic or data transformation changes

---

## Risks and Rollback

- **Risk level: Minimal.** Purely cosmetic SVG attribute adjustments.
- **Rollback:** `git revert` or simply restore the 4–6 numeric values. No migration, no schema change, no downstream impact.
- **One open question:** The exact appearance depends on background color in context. Reed may want a slightly different opacity level after seeing it live. Easy to iterate.

---

## Open Questions for Reed

1. **Severity of the "too dark" complaint** — is it the AI overlay circles specifically, or the grid/axis lines, or both? The plan targets both but the overlay circles are the primary candidate.
2. **Desired visual outcome** — should the AI overlay be "barely-there hints" (ghost-level opacity) or "present but clearly secondary"? This affects whether `0.18` opacity is right or if it should be even lower (e.g., `0.10`).
3. **Test bean** — do you have a specific bean in your inventory that shows both AI + user cupping notes where this looks bad? Knowing which one to check against speeds up verification.
4. **CLI impact** — none needed. Confirm no CLI-side changes are expected for this.
