# Pre-submission audit: analytics contextual navigation

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 1
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Give anonymous desktop `/analytics` users a contextual section menu before removing the in-page desktop navigator.
- Add shell-level access/anchor contract tests for anonymous and signed-in desktop paths.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
VALIDATION_STATUS:
- `pnpm exec vitest run src/lib/components/layout/Navbar.svelte.test.ts src/lib/components/layout/MobileAppMenu.test.ts src/lib/components/layout/appNavigation.test.ts src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS
- focused 35-test implementation validation reported by the implementer: VALIDATION_PASS
- `pnpm check` with required static environment placeholders: VALIDATION_PASS
- bare `pnpm check` without required static environment values: VALIDATION_BLOCKED_ENV
- targeted Prettier and ESLint validation reported by the implementer: VALIDATION_PASS

## What the code actually does

The change removes the desktop-only sticky `Market Index sections` navigator from the
analytics report body. For authenticated users, it adds the shared analytics link set to
the existing desktop sidebar navigation panel and closes that panel when a section link is
clicked. The sidebar link set includes Disclosure Index for every signed-in user, matching
the report's current rendering condition. The existing signed-in mobile app menu and public
mobile header menu continue to provide their contextual section controls.

The Ask action is removed from the deleted sticky bar and rendered as a standalone action
immediately after the Market Read. It remains full width on small screens and becomes a
right-aligned intrinsic-width button at desktop sizes. Its existing analytics-chat
entitlement condition is unchanged.

The anonymous desktop path is different: `/analytics` is rendered with `UnifiedHeader`,
not the authenticated `LeftSidebar`/`Navbar` shell. `UnifiedHeader` only renders its
contextual Market Index section controls inside a `md:hidden` mobile menu. Consequently,
the patch removes anonymous desktop's existing section navigator without adding the
claimed contextual desktop replacement.

## Findings

### P1 — Anonymous desktop loses the report navigation instead of receiving the replacement

- Evidence:
  - `src/routes/analytics/+page.svelte:1085-1094` now proceeds directly from Market Read to
    the standalone Ask action; the former desktop section navigator is gone.
  - `src/routes/+layout.svelte:155-177` routes anonymous `/analytics` through
    `UnifiedHeader`, while the new `Navbar` section is reachable only in the authenticated
    app-shell branch.
  - `src/lib/components/layout/UnifiedHeader.svelte:82-96` renders only the ordinary route
    navigation at desktop widths.
  - `src/lib/components/layout/UnifiedHeader.svelte:162-194` contains the Market Index
    section controls exclusively inside `md:hidden`.
  - `src/lib/components/layout/Navbar.svelte:111-131` adds the replacement only to the
    authenticated sidebar menu.
- Failure scenario: an anonymous visitor opens `/analytics` at a desktop width. Before this
  change, Read, Signals, and Market Index were available in the sticky report navigator.
  After this change, those shortcuts disappear. Opening the public header offers no desktop
  contextual menu, because the only contextual block is mobile-only. This is a connected
  surface regression and leaves the stated replacement incomplete for the public proof
  surface.
- Product consequence: the public Market Index is explicitly a proof surface under
  ADR-010. Removing its desktop report navigation while keeping contextual navigation for
  signed-in desktop and both mobile shells weakens cross-access coherence and does not
  satisfy the claimed access-aware replacement. It does not violate section visibility
  directly—the remaining content is still rendered—but it removes the promised navigation
  path for a realistic access level.
- Fix: add an analytics-only contextual menu/secondary navigation affordance to the desktop
  `UnifiedHeader`, using `getAnalyticsSectionLinks({ includeDisclosureIndex: false })` for
  anonymous visitors. Alternatively, retain the in-page desktop navigator only for the
  anonymous public shell. Keep the solution in this PR; it is part of the replacement
  contract and does not require the separate desktop-shell redesign.

### P2 — The tests no longer enforce the cross-shell access and anchor contract

- Evidence:
  - `src/lib/components/layout/Navbar.svelte.test.ts:29-45` exercises only the authenticated
    `Navbar` in isolation and asserts only one link target plus Disclosure Index presence.
  - `src/routes/analytics/page.svelte.test.ts:985-996` now verifies only that the old
    navigator is absent.
  - The removed assertions previously checked each advertised section href against an
    actual target in the rendered report body.
  - No `UnifiedHeader` test covers an anonymous desktop analytics path; the only public
    contextual controls are therefore untested at the shell breakpoint where the P1 occurs.
- Failure scenario: the public desktop shell can omit contextual navigation entirely—as
  this patch currently does—or a section id can later be renamed while the menu keeps its
  old href, and all changed tests still pass. The component test's hard-coded data also
  cannot establish that the menu's access filter matches sections rendered by the report.
- Fix: add shell-level coverage for anonymous desktop and authenticated desktop analytics,
  asserting the correct visible link set for each access state. Restore an anchor-contract
  test that verifies every link advertised for an access level resolves to an element
  rendered for that same access level. This can be done with focused component tests; a
  broad end-to-end suite is not required.

## ADR and direction assessment

- **ADR-009:** The standalone Ask action remains available on mobile and desktop for users
  who can use analytics chat, and mobile contextual navigation remains intact. The current
  P1 is primarily an access/shell parity issue rather than loss of a critical analytical
  decision path, because the public sections remain scrollable.
- **ADR-010:** Link filtering itself matches rendered sections: anonymous links exclude
  Disclosure Index and signed-in links include it. The defect is that the anonymous desktop
  shell receives no replacement navigation at all.
- **ADR-015 / Product Vision:** Moving secondary section jumps out of the report body can
  support a calmer decision surface, and the Ask action remains tied to the shared
  analytics context. No wrong-layer personalization or new dashboard sprawl is introduced.

## Slice assessment

The slice remains independently useful and does not depend on the separate desktop-shell
redesign. The boundary is coherent once the existing public desktop shell is included in
the contextual-navigation replacement and the shell/access contract is tested. The fixes
are local to this PR.

The branch is five commits behind `origin/main`, but those intervening changes are in the
principal/auth server boundary and do not overlap this diff; a merge-tree check found no
conflict markers. Rebase/update before submission remains routine branch hygiene, not a
review finding.
