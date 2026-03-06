# Daily PR Plan - 2026-03-06

## Candidate scoring (easy-win rubric)

| Candidate                                                   | Priority | Complexity |        Risk | Dependencies |  Total |
| ----------------------------------------------------------- | -------: | ---------: | ----------: | -----------: | -----: |
| **Bug: Roast form layout overflow on some screen sizes**    |   P1 = 8 |  easy = 10 |     low = 0 |     none = 0 | **18** |
| UI/UX: Clean up beans catalog exposed user reference fields |   P2 = 6 |  easy = 10 |     low = 0 |     none = 0 |     16 |
| UI/UX: Supplier cupping note dashed lines too dark          |   P2 = 6 |  easy = 10 |     low = 0 |     none = 0 |     16 |
| Bug: User rating editing broken                             |   P1 = 8 | medium = 6 | medium = -2 |     none = 0 |     12 |
| Bug: Bean profile data collection incomplete                |   P1 = 8 | medium = 6 |     low = 0 |    some = -2 |     12 |

Note: "New Roast link routing" (P1, score 18) was planned 2026-03-05; excluded from today's candidates.

Selected item: **Bug: Roast form layout overflow on some screen sizes** (highest total, tight CSS-only scope).

---

## Feature

**Fix the roast profile creation modal so it fits within the viewport on all screen sizes without requiring horizontal scrolling.**

DEVLOG reference: Priority 1 critical bug - "Roast form layout overflow. The form doesn't fit within the page viewport on certain screen sizes, requiring horizontal scrolling."

## Why now

- P1 critical bug that degrades the core roast creation workflow.
- Direct prerequisite for the P0 Mobile Navigation initiative; the form must be viewport-safe before broader mobile layout work begins.
- Pure CSS/layout fix with zero data or API risk; ideal one-PR scope.
- High user-facing impact relative to effort.

## Strategy Alignment Audit

**Active strategy themes (extracted from blog + DEVLOG):**

1. **Mobile UX readiness** - P0 Mobile Navigation is the top DEVLOG priority. This fix is foundational; a mobile nav redesign is undermined if forms still overflow.
2. **Data-first foundation / deterministic core** - Blog posts ("Inference Is in the Name", "AI Moats Aren't Software") emphasize getting the core product right before adding adaptive features. Fixing broken layout is core product quality.
3. **Public conversion funnel** - P0 Public Catalog Access will bring new users. Broken form layout on their devices is a conversion killer.
4. **Supply chain discovery vs reliability** - Not directly related.

**Verdict: Aligned.** Supports themes 1, 2, and 3. No contradictions with current direction. Fixing the form layout is necessary groundwork before any of the P0 mobile/public-access features can ship credibly.

## Scope (in/out)

### In scope

- Fix horizontal overflow in `RoastProfileForm.svelte` modal on narrow and short viewports.
- Add responsive padding reduction for small screens (the modal currently has fixed `p-6` that doesn't scale down).
- Ensure the modal header, scrollable form, and footer buttons all remain accessible on viewports as small as 320px wide and landscape phones.
- Verify no regressions on desktop (standard modal behavior unchanged).

### Out of scope

- Roast form UX redesign (field ordering, new fields, layout overhaul).
- Any backend, API, or data changes.
- Broader mobile navigation work (that is a separate P0 initiative).
- Changes to other forms or modals outside the roast form.

## Proposed UX behavior

- On all screen sizes, the roast form modal should:
  1. Fill available width with appropriate margin (no horizontal scrollbar).
  2. Show a scrollable form area when content exceeds viewport height.
  3. Keep the header ("Add New Roast Profile") and footer buttons (Cancel, Create) visible and tappable without scrolling horizontally.
  4. Use reduced padding on small screens (`p-3` or `p-4` instead of `p-6`).
- On landscape phones (short viewports), the `max-h-[70vh]` scrollable area should still leave enough room for header + footer. If necessary, reduce header/footer chrome.

## Files to change

- **`src/routes/roast/RoastProfileForm.svelte`** (primary)
  - Add responsive padding: `p-4 sm:p-6` on modal panel.
  - Ensure `max-w-4xl` doesn't overflow with padding on small screens (add `mx-auto` if missing, verify box-sizing).
  - Adjust `max-h-[70vh]` to account for header/footer on short viewports (consider `max-h-[calc(100vh-12rem)]` or similar).
  - Verify all inner grid sections (`grid-cols-1 sm:grid-cols-2`) collapse correctly at 320px.
  - Check that file upload input, textarea, and select elements don't force minimum widths that exceed container.

## API/data impact

- **No database changes.**
- **No API route changes.**
- **No state management changes.**
- Pure CSS/Tailwind class adjustments.

## Acceptance criteria (checklist)

- [ ] No horizontal scrollbar appears on 320px wide viewport with the roast form open.
- [ ] No horizontal scrollbar on 375px (iPhone SE), 390px (iPhone 14), 414px (iPhone Plus) widths.
- [ ] Form is fully usable on landscape phone (e.g., 667x375 viewport).
- [ ] Header and footer buttons remain visible without horizontal scroll on all tested sizes.
- [ ] All form fields (coffee select, weight inputs, file upload, textareas) are accessible and not clipped.
- [ ] Desktop experience (1280px+) is unchanged.
- [ ] Tablet experience (768px-1024px) looks clean.
- [ ] `pnpm lint` passes.
- [ ] `pnpm check` passes.

## Test plan (lint/check/vitest/playwright expectations)

1. **Manual responsive testing (primary)**
   - Open roast form at viewport widths: 320, 375, 390, 414, 768, 1024, 1280.
   - Test landscape orientation at 667x375 and 844x390.
   - Confirm no horizontal overflow at any breakpoint.
   - Confirm form scrolling works (add multiple beans to batch to increase form height).
2. **Project validation**
   - `pnpm lint` - no new violations.
   - `pnpm check` - TypeScript clean.
   - `pnpm vitest --run` - existing tests pass (no logic changes expected).
   - Playwright CI - existing e2e suite should pass unchanged; this PR touches no logic.
3. **Regression check**
   - Verify Artisan file upload still works in the form.
   - Verify multi-bean batch creation flow still works.

## Risks and rollback

### Risks

- Tailwind class changes could interact with the roast chart page layout if styles leak. Low risk since the form is a scoped modal.
- Over-aggressive padding reduction could make the form feel cramped on borderline sizes (tablet portrait).

### Mitigation

- All changes scoped to `RoastProfileForm.svelte` modal container; no global style changes.
- Test at multiple breakpoints before merge.
- Keep changes minimal: responsive padding + overflow containment only.

### Rollback

- Revert the single-file CSS changes; no data or API impact.

## Open questions for Reed

1. What screen size or device are you seeing the overflow on? (Helps target the exact breakpoint that's broken.)
2. Is 320px the right minimum width to support, or do you want a higher floor like 360px?
3. Should we address the form's `max-h-[70vh]` behavior on landscape phones now, or defer that to the broader P0 Mobile Navigation work?
4. Any preference on padding reduction approach: gradual (`p-3 sm:p-4 md:p-6`) or simple two-step (`p-4 sm:p-6`)?
