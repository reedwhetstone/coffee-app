# Implementation Plan: Roast Mobile Touch Targets

**Date:** 2026-04-07
**Slug:** roast-mobile-touch-targets
**Status:** Planning only — awaiting Reed review before coding
**Repo:** coffee-app
**CLI impact:** None; web-only UI ergonomics fix

---

## Feature

Improve usability of roast chart controls on mobile.

**DEVLOG source:** Priority 4 — "Improve usability of roast chart buttons on mobile. Touch targets are too small and controls overlap."

This plan focuses on the two mobile interaction clusters that matter during an active roast session:

- `src/lib/components/roast/RoastControls.svelte` — fan and heat stepper controls
- `src/lib/components/roast/EventTimeline.svelte` — milestone/event buttons

The current mobile UI uses small tap areas (`h-8` stepper buttons; dense `p-2 text-xs` event buttons) that are easy to miss during a live roast. This is exactly the kind of friction that turns a core workflow into a chore on a phone.

---

## Candidate Scoring

Only candidates that survived completion reconciliation and still look safely shippable in one PR were considered.

- **Mobile roast chart buttons touch-target fix**

  - Priority: P4 → 4
  - Complexity: easy → 10
  - Risk: low → 0
  - Dependency penalty: none → 0
  - **Total: 14**

- **Roast chart resize on navigation**

  - Priority: P2 → 6
  - Complexity: medium → 6
  - Risk: medium → -2
  - Dependency penalty: some → -2
  - **Total: 8**
  - Not selected because it touches chart lifecycle/layout behavior and is no longer an easy-win.

- **Beans profile cleanup for exposed user reference fields**

  - Excluded from scoring as the remaining scope is too ambiguous for a one-purpose PR without additional discovery.

- **Profit page auto-refresh on new sale form submission**

  - Excluded from scoring because the current code already contains refresh-oriented client-side logic; this now looks closer to a verification/regression question than a clean planning target.

- **Roast profile / bean profile mobile appearance**
  - Excluded from scoring because it is too broad for one clean PR and would likely sprawl into multiple components.

**Winner:** Mobile roast chart buttons touch-target fix.

---

## Why now

- It is still open after completion reconciliation; there are no matching merged commits for the mobile touch-target/overlap issue.
- The current code confirms the problem shape: mobile event buttons are compact grid cells with `p-2 text-xs`, and the fan/heat steppers use `h-8` tap targets inside narrow control columns.
- This is a true easy-win. No schema changes, no API changes, no auth changes, no business-logic risk.
- It improves a core product loop, not a peripheral page. During an active roast, poor mobile ergonomics are higher-cost than a cosmetic issue on a static screen.
- CLI cross-check: recent `purveyors-cli` work is around pagination/docs/ADR hygiene, not roast-session interaction. This should stay web-first and coffee-app-only.

---

## Strategy Alignment Audit

- **Canonical direction:** This aligns with `notes/PRODUCT_VISION.md` by reducing operational friction in a core roasting workflow while keeping professional functionality accessible on smaller devices.
- **Product principle supported:** It strengthens the principle that professional depth should remain accessible. A roast workflow that is frustrating on mobile undermines the product's promise to serious home roasters and micro-roasters.
- **Cross-surface effect:** No CLI or API change is needed. This is intentionally a web-surface ergonomics fix, while preserving the same roast actions and underlying data model across all surfaces.
- **Public value legibility:** Indirect but real. Even though roast controls are authenticated-user functionality, polish in the live-roasting workflow increases trust that Purveyors is a serious operational tool, not just a catalog demo.
- **Scope check:** This plan intentionally excludes full mobile navigation redesign, roast-chart resize lifecycle work, fan-settings repositioning, and any broader roast-page visual overhaul.

### Active strategy themes considered

1. API-first shared logic matters, but not every problem should be forced into a shared abstraction when the issue is pure interaction ergonomics.
2. Public surfaces should prove value before the paywall; authenticated workflows must still feel production-worthy once users convert.
3. Truthful, legible coffee tooling beats noisy UI. During roasting, controls should be easy to hit and easy to trust.
4. Professional depth should remain accessible to serious home roasters and micro-roasters, including on mobile.
5. Intelligence should reduce friction; when a user still needs explicit controls, those controls should be friction-light.

**Alignment verdict:** Aligned.

This is not a flagship strategy bet, but it is solidly on-strategy: a scoped usability improvement in a core operational surface, with low complexity and immediate user value.

---

## Scope

### In scope

- Increase mobile touch-target size for fan and heat increment/decrement buttons.
- Improve spacing and sizing of the numeric control blocks so they remain easy to tap without crowding.
- Improve mobile milestone/event buttons so labels remain legible and tap targets do not feel cramped.
- Adjust roast-page mobile layout only where needed to prevent the controls/timeline area from feeling visually jammed.
- Preserve current roast behavior and event semantics.

### Out of scope

- Roast chart resize-on-navigation fix
- Full mobile navigation redesign
- Moving fan settings to a new section or redesigning the entire roast page information architecture
- New roast features, haptics, or sound feedback
- Any API, DB, CLI, or agent/tool changes

---

## Proposed UX behavior

### RoastControls (`RoastControls.svelte`)

On mobile:

- Fan and heat controls keep the same vertical stepper model, but buttons become finger-sized instead of tiny taps.
- Increment/decrement buttons should be at least ~44px tall in practice.
- The displayed numeric value should have a larger, more stable visual container so the control does not feel cramped.
- The two control groups should keep clear separation without wasting so much horizontal space that they collide with surrounding content.

On tablet/desktop:

- Existing desktop layout should stay visually the same unless a class simplification is required for responsive consistency.

### EventTimeline (`EventTimeline.svelte`)

On mobile:

- Event buttons remain a compact grid, but each button gets a taller tap area and slightly more forgiving internal padding.
- Long labels like `FC Rolling` and `Cool End` should remain readable without feeling clipped or too tiny.
- Button states should remain visually obvious: disabled before roasting, active/selected when logged.

### RoastChartInterface (`RoastChartInterface.svelte`)

Only if needed:

- Slight spacing/layout adjustments around the controls + timeline section to ensure the enlarged mobile controls still fit comfortably below the chart.

---

## Files to change

### Primary

- `src/lib/components/roast/RoastControls.svelte`
- `src/lib/components/roast/EventTimeline.svelte`
- `src/routes/roast/RoastChartInterface.svelte` (only if layout spacing needs a small companion adjustment)

### Test / verification

- `tests/e2e/smoke.spec.ts` or a new focused mobile roast smoke test file if that is cleaner

---

## API/data impact

None.

- No schema changes
- No API contract changes
- No server changes
- No new shared business logic
- No CLI changes

This is a presentation-layer usability PR only.

---

## Acceptance criteria

- [ ] On a mobile viewport (target: ~390px width), fan and heat stepper buttons are materially easier to tap than the current `h-8` controls.
- [ ] Mobile stepper controls meet a practical minimum touch-target size goal of about 44px for tap surfaces.
- [ ] Event timeline buttons on mobile are taller and easier to hit without introducing horizontal scrolling.
- [ ] Labels like `FC Rolling` and `Cool End` remain readable on mobile.
- [ ] Controls no longer feel visually cramped or overlapping in the roast control section on small screens.
- [ ] Fan/heat min/max behavior still works exactly as before (`0..10`).
- [ ] Event buttons remain disabled when `isRoasting === false` and active when roasting is in progress.
- [ ] Desktop and tablet layouts remain functionally unchanged.
- [ ] `pnpm lint` passes.
- [ ] `pnpm check` passes.
- [ ] If a mobile Playwright smoke test is added or updated, it passes in CI.

---

## Test plan

### Static verification

- Run `pnpm lint`
- Run `pnpm check`

### Manual UI verification

- Open `/roast` on a mobile viewport in browser devtools or Playwright mobile emulation.
- Confirm fan/heat controls are comfortable to tap repeatedly.
- Confirm event buttons remain readable and do not clip awkwardly.
- Confirm no horizontal scroll is introduced in the controls area.
- Confirm the chart remains visually separated from the control block.

### Playwright expectation

- Prefer one focused mobile smoke path covering `/roast` at an iPhone-ish viewport.
- Assert the roast controls section renders and key buttons are visible/interactable.
- Keep scope narrow; do not turn this into a full roast-session end-to-end rewrite.

### Vitest expectation

- No new unit tests are strictly required if the change is purely responsive classes/layout.
- If a helper is introduced for responsive layout state, add a narrow test for that helper only.

---

## Risks and rollback

### Risks

- Enlarging controls could accidentally create wrapping or spacing regressions in the roast control panel.
- Over-correcting for mobile could degrade the current desktop/tablet layout if responsive classes are not carefully scoped.
- Touch-target improvements can easily sprawl into broader "roast page redesign" work if scope is not held.

### Rollback

- Low risk and easy rollback: revert the UI component changes.
- No data migration or state cleanup is needed.

---

## Open questions for Reed

1. For mobile, do you want to keep the current two-column event grid, or would you rather prioritize larger one-column buttons even if it makes the control area taller?
2. For fan/heat controls, should the mobile goal be "same layout but bigger targets," or do you want a more opinionated mobile-specific arrangement if that reads better in practice?
3. Is visual pressed-state feedback enough for this PR, or do you want this kept strictly to sizing/spacing with no interaction-style polish?
4. Do you want a small mobile Playwright smoke test added now, or keep this PR UI-only and rely on existing smoke coverage plus manual viewport verification?
