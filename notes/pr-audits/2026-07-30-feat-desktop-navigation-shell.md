# Revision verification: `feat/desktop-navigation-shell`

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- None.
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable
  VALIDATION_STATUS:
- `pnpm exec vitest run src/lib/components/layout/LeftSidebar.svelte.test.ts src/lib/components/layout/desktopShellState.test.ts src/lib/components/layout/MobileAppShell.svelte.test.ts src/lib/components/layout/MobileOverlayShell.test.ts`: VALIDATION_PASS (27 tests)
- `pnpm check --fail-on-warnings` with static environment placeholders: VALIDATION_PASS (0 errors, 0 warnings)
- `pnpm exec eslint src/lib/components/layout/LeftSidebar.svelte src/lib/components/layout/LeftSidebar.svelte.test.ts src/lib/components/layout/desktopShellState.ts src/lib/components/layout/desktopShellState.test.ts`: VALIDATION_PASS
- `git diff --check origin/main...HEAD`: VALIDATION_PASS
- `git diff --check`: VALIDATION_PASS

## Revision result

The user-feedback revision removes the permanently open wide-screen navigation column. Desktop
now uses one compact, labeled action bar at every desktop width:

- Menu, Chat, New, Filters, Admin, and Account controls use visible text instead of relying on
  icon recognition.
- Navigation, actions, filters, admin, and account content stay closed until requested.
- Every secondary surface uses the same 288px overlay panel adjacent to the action bar. Opening a
  panel does not change the action-bar width or shift page content.
- The desktop content offset is one stable 96px contract at all desktop breakpoints.

The existing interaction contracts remain intact: panels are named regions and receive focus on
open; Escape closes and restores the trigger; outside clicks close without stealing focus; a
previously prevented Escape is left for the higher modal layer; active filter counts remain
route-aware. Focused tests now explicitly assert that navigation is absent until the Menu control
opens it.

No P0, P1, P2, or P3 findings remain in the revision. The branch is ready for resubmission.
