# Pre-submission audit: `feat/desktop-navigation-shell`

VERDICT: ready_with_fixes
P0: 0
P1: 2
P2: 1
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Count every non-default filter contract state, including supplier visibility, in the desktop badge.
- Give desktop panels a complete keyboard focus lifecycle: focus entry, Escape close, and trigger focus restoration.
- Replace the CSS-blind sidebar assertions with viewport-aware/integration coverage of the medium overlay and main-content geometry.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
VALIDATION_STATUS:
- `pnpm vitest run src/lib/components/layout/LeftSidebar.svelte.test.ts src/lib/components/layout/MobileAppShell.svelte.test.ts src/lib/components/layout/MobileOverlayShell.test.ts src/lib/components/layout/Settingsbar.test.ts src/lib/components/chat/ChatDrawer.svelte.test.ts`: VALIDATION_PASS
- `git diff --check origin/main...HEAD`: VALIDATION_PASS
- `pnpm check` with explicit placeholder static environment variables (implementer-reported): VALIDATION_PASS
- targeted Prettier and ESLint (implementer-reported): VALIDATION_PASS

## What the code actually does

The branch replaces the authenticated desktop sidebar at `md` and above. From 768px through
1279px it reserves a fixed 80px left rail and opens a 288px panel over the content. At 1280px
and above it reserves a fixed 288px left column containing the labeled route map and action
buttons; opening account, action, filter, or admin content replaces that route map within the
same 288px column. The main content's left margin no longer changes with panel state, and its
right margin continues to reserve 512px for the existing right sidebar or Ask Parchment drawer.

The shell derives role-gated actions from the same `canManagePortfolio` contract as mobile,
keeps admin controls behind `checkRole(..., 'admin')`, hides filters on the tracked-only catalog,
and routes Chat directly to `/chat`. Mobile components and sub-`md` classes are not changed;
the only content-padding changes begin at `md`.

This is an independently mergeable desktop-shell slice. It adds no analytics route dependency,
placeholder destination, or contract that requires the separate contextual-navigation branch.
It aligns with ADR-009's allowance for distinct desktop and mobile navigation/filter affordances
while preserving the mobile task path. No accepted ADR violation was found.

## Findings

### P1 — The active-filter badge omits a real filter exposed by the same panel

**Evidence:** `src/lib/components/layout/LeftSidebar.svelte:42-48` counts only entries in
`$filterStore.filters`. `src/lib/components/layout/Settingsbar.svelte:142-155` presents
“Home Roaster Suppliers Only” as a filter and changes `showWholesale`.
`src/lib/stores/filterStore.ts:575-600` confirms that `showWholesale=false` changes the catalog
query and result set, while `clearFilters()` at `src/lib/stores/filterStore.ts:635-645` resets it
as active filter state.

**Failure scenario:** On `/catalog`, a user enables “Home Roaster Suppliers Only” with no other
filters. The result set is narrowed and the URL carries `showWholesale=false`, but both desktop
filter launchers show no badge. If the user also selects one country, the badge says `1` while
two filter constraints are active. A `wholesaleOnly=true` URL is likewise omitted.

This is confirmed wrong behavior in a feature whose stated intent explicitly includes active
filter counts.

**Fix:** Derive the count from the complete filter contract, not only the `filters` map. Reuse
the existing empty-value semantics (`sanitizeFilters`/`isEmptyFilterValue`) and add one active
constraint for non-default supplier visibility (`!showWholesale` or `wholesaleOnly`, without
double-counting the mutually exclusive modes). Add cases for the default state, hobbyist-only,
wholesale-only, boolean false filters, ranges, and ordinary arrays/strings.

### P1 — Opening a wide-screen panel destroys keyboard focus and no desktop panel has a complete Escape/restore lifecycle

**Evidence:** At wide widths, the launcher buttons live inside the `{:else}` branch at
`src/lib/components/layout/LeftSidebar.svelte:128-195`. Clicking one sets `activeMenu`, which
immediately unmounts the focused button and replaces that entire branch with the selected panel
at lines 124-127. There is no saved trigger, no focus transfer into the panel, and no focus
restoration in `setMenu`/`closeAllMenus` at lines 50-60. At medium widths the trigger remains
mounted, but the overlay wrapper at lines 283-290 has no keydown handler or focus entry. The
only Escape handlers are attached to each panel's close button (for example
`Settingsbar.svelte:81-88`), so Escape works only after the user manually tabs to that button.
The mobile equivalent already supplies focus entry, focus trapping, Escape, and restoration in
`MobileOverlayShell.svelte:26-96`.

**Failure scenario:** At 1280px or wider, a keyboard user tabs to Filters and presses Enter. The
focused element is removed from the DOM, focus falls back to the document, and the new Filters
panel is not announced or focused. Pressing Escape does nothing. Closing later remounts the
launcher but does not return focus, forcing the user to restart navigation through the page.
At medium widths, Enter leaves focus on the rail and Escape likewise does not close the panel.

**Fix:** Track the invoking button, focus the selected panel heading or first control after it
mounts, close on Escape from the panel/shell, and restore focus to the still-connected or
remounted trigger. Give the disclosure a stable `id` plus `aria-controls`/`aria-expanded` (or a
properly labelled non-modal dialog/region contract). Do not mark it modal unless background
interaction is also intentionally blocked.

### P2 — The new tests do not exercise the responsive branch or the claimed content geometry

**Evidence:** `src/lib/components/layout/LeftSidebar.svelte.test.ts:75-107` renders both the
`xl:flex` wide controls and the `xl:hidden` medium controls into Happy DOM; CSS media queries are
not applied. The test therefore expects two Account buttons, two Chat buttons, and two badges.
The “opens filters as an overlay” test clicks index zero, which is the wide launcher by DOM order,
then accepts any “Filters menu” instance. Once `activeMenu` is set, both the wide replacement and
the medium overlay exist in the test DOM, so this does not prove medium behavior. Comparing the
outer shell's class string cannot prove stable content geometry because the margin being changed
is on `<main>` in `src/routes/+layout.svelte:60-61,174`, outside this component.

**Failure scenario:** A later edit can break `md`/`xl` visibility, move the overlay to the wrong
offset, or restore menu-dependent main margins while all three new tests remain green. The focus
regression above also survives because no test opens/closes a panel from the keyboard.

**Fix:** Add viewport-aware browser/component coverage at representative sub-`md`, `md`, and
`xl` widths, or factor geometry/state contracts into testable helpers and add a layout
integration assertion. Verify: mobile shell isolation; 80px reserved rail plus overlaid panel at
medium; 288px reserved sidebar at wide; invariant main left margin while panels open; right
drawer coexistence; keyboard focus/Escape/restore; and role/filter visibility. Keep the existing
unit tests for state wiring, but do not treat duplicate CSS-hidden DOM nodes as breakpoint proof.

## Forest-level and boundary assessment

- The static main margins and overlay positioning preserve content geometry across menu changes.
- The existing right-side 512px reservation remains composed with the new left margins; no
  conflicting z-index or route-state ownership was found.
- Role gates match the mobile/action-panel contracts. No authorization decision was moved
  client-side beyond pre-existing presentation gates.
- The mobile shell, mobile overlays, and sub-`md` content padding are unchanged. Existing mobile
  tests pass.
- The branch is five commits behind current `origin/main`, but those commits affect the
  principal/auth boundary rather than these shell files. A three-way merge inspection found no
  content conflict. The branch should still be updated onto current main before submission as
  normal hygiene.
- Wide action/filter/account/admin panels replace the labeled route map temporarily while
  retaining the 288px shell width. This is a product tradeoff worth making explicit, but it is
  not classified as a defect here because the default wide state remains persistent and the
  selected panel has an explicit close path.

## Validation notes

The reviewer-rerun focused suite passed 19 tests across five files. Happy DOM emitted no failures.
An earlier mistyped run omitted `MobileAppShell.svelte.test.ts`; the corrected command above is
the canonical result. The branch's Node engine warning (`22.x` requested, Node 24 in the review
environment) did not affect test completion.
