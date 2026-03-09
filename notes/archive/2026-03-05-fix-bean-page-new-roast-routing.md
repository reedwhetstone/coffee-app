# Daily PR Plan - 2026-03-05

## Candidate scoring (easy-win rubric)

| Candidate                                                       | Priority | Complexity |        Risk | Dependencies |  Total |
| --------------------------------------------------------------- | -------: | ---------: | ----------: | -----------: | -----: |
| **Bug: New Roast link on bean page doesn’t navigate correctly** |   P1 = 8 |  easy = 10 |     low = 0 |     none = 0 | **18** |
| UI/UX: Supplier cupping note dashed lines too dark              |   P2 = 6 |  easy = 10 |     low = 0 |     none = 0 |     16 |
| Bug: Roast form layout overflow on some screens                 |   P1 = 8 | medium = 6 | medium = -2 |     none = 0 |     12 |
| UI/UX: Score and rating display formatting cleanup              |   P2 = 6 | medium = 6 |     low = 0 |     none = 0 |     12 |
| UI/UX: Saving cupping notes does not refresh page data          |   P2 = 6 | medium = 6 | medium = -2 |    some = -2 |      8 |

Selected item: **Bug: New Roast link on bean page doesn’t navigate correctly** (highest total, tightest scope for one clean PR).

---

## Feature

**Fix bean-profile "Start New Roast" navigation so roast form opens with the selected bean prefilled every time.**

DEVLOG reference: Priority 1 critical bug - "New Roast link on bean page doesn’t navigate to roast form correctly."

## Why now

- Priority 1 bug that interrupts a core workflow from bean analysis to roasting.
- Highly visible user friction with a small, isolated fix surface.
- Strong fit for one-purpose PR with low regression risk.

## Scope (in/out)

### In scope

- Standardize query params used by bean page when navigating to `/roast`.
- Make `/roast` URL param parsing resilient (support canonical + backward-compatible params).
- Ensure roast form auto-opens when valid bean navigation params are present.
- Add focused tests for param handling logic.

### Out of scope

- Any roast form UI redesign.
- Any backend/schema/API contract changes.
- Any broader navigation refactor across unrelated routes.

## Proposed UX behavior

- Clicking **Start New Roast** (or **Start First Roast**) from a bean profile should:
  1. Navigate to `/roast`.
  2. Preselect the bean that was active on `/beans`.
  3. Auto-open the roast creation form.
- If only bean ID is present and name is missing, the roast page should still open form and hydrate name from available coffee data when possible.
- If params are invalid, user lands on `/roast` safely without crash and sees existing default state.

## Files to change

- `src/routes/beans/BeanProfileTabs.svelte`
  - Normalize route construction for roast navigation from both roast CTA buttons.
  - Use one shared navigation builder in-file to avoid divergence.
- `src/routes/roast/+page.svelte`
  - Harden query param parsing and fallback behavior.
  - Accept canonical param names and maintain backward compatibility with current links.
- `src/lib/utils/` (new helper, proposed)
  - Add small utility for roast navigation param parsing/validation (optional but preferred for testability).
- `src/lib/utils/*.test.ts` (new)
  - Unit tests for URL param parsing and fallback matrix.

## API/data impact

- **No database changes.**
- **No API route contract changes.**
- Frontend-only routing and state hydration fix.

## Acceptance criteria (checklist)

- [ ] From `/beans`, clicking **Start New Roast** opens `/roast` with form visible.
- [ ] Bean is preselected correctly in the roast form when arriving from `/beans`.
- [ ] **Start First Roast** follows the same correct behavior.
- [ ] Existing deep links using current params continue to work (backward compatibility).
- [ ] Invalid/missing params do not crash the roast page.
- [ ] No regressions for loading existing roast profiles via `profileId` URL param.

## Test plan (lint/check/vitest/playwright expectations)

1. **Unit tests (Vitest)**
   - Param parsing handles canonical params.
   - Param parsing handles legacy params.
   - Missing/invalid values degrade safely.
   - `profileId` flow remains prioritized over new-roast flow.
2. **Manual smoke test**
   - Beans page -> Start New Roast (bean with existing roasts).
   - Beans page -> Start First Roast (bean with no roasts).
   - Direct `/roast?profileId=...` link still opens profile.
3. **Project validation**
   - `pnpm lint`
   - `pnpm check`
   - `pnpm vitest --run`
   - Playwright: run targeted navigation smoke if available; otherwise rely on manual route verification in this PR and keep full Playwright in CI.

## Risks and rollback

### Risks

- Param compatibility bug could break old bookmarks or internal links.
- Over-eager auto-open logic could interfere with explicit `profileId` route behavior.

### Mitigation

- Keep parser precedence explicit: `profileId` > new-roast params.
- Add unit tests covering compatibility matrix.
- Keep change set minimal and localized.

### Rollback

- Revert this PR cleanly (frontend-only); no data migration required.

## Open questions for Reed

1. Do you want to standardize on `coffeeId`/`coffeeName` as canonical URL params going forward, while still supporting current `beanId`/`beanName` links?
2. If name is missing from URL, should we silently load by ID only, or show a light warning/toast?
3. Should both roast CTAs on bean profile use identical helper logic now (recommended), or keep duplicated inline navigation code?
4. For this PR, do you want a tiny targeted Playwright test added for beans -> roast navigation, or keep this one to unit + manual smoke only?
