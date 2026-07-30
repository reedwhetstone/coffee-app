# Pre-submission re-review: analytics contextual navigation

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
- `pnpm exec vitest run src/lib/components/layout/Navbar.svelte.test.ts src/lib/components/layout/UnifiedHeader.svelte.test.ts src/lib/components/layout/MobileAppMenu.test.ts src/lib/components/layout/appNavigation.test.ts src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS (49 tests)
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test-anon SUPABASE_SERVICE_ROLE_KEY=test-service STRIPE_SECRET_KEY=sk_test_placeholder STRIPE_WEBHOOK_SECRET=whsec_placeholder OPENROUTER_API_KEY=test-openrouter pnpm check`: VALIDATION_PASS (0 errors, 0 warnings)
- `git diff --check origin/main...HEAD`: VALIDATION_PASS

## What the code actually does

The branch removes the desktop-only floating report navigator from the analytics body.
Authenticated desktop users receive the shared report-section links in the existing
navigation panel. Anonymous desktop users receive the access-filtered links in a sticky
secondary row of the public header. Existing authenticated and anonymous mobile menus
retain the same contextual section tasks.

The standalone Ask action now renders inline immediately after the Market Read at both
mobile and desktop widths. Its entitlement condition, generated analytics context, and
destination are unchanged.

## Re-review result

No remaining P0, P1, P2, or P3 finding was confirmed.

The prior public-desktop regression is fixed:

- `src/routes/+layout.svelte:122-125` sends anonymous `/analytics` through
  `UnifiedHeader`.
- `src/lib/components/layout/UnifiedHeader.svelte:162-177` now renders the desktop report
  navigation on that shell.
- `src/lib/components/layout/UnifiedHeader.svelte:28-30` excludes Disclosure Index for
  anonymous visitors.
- `src/routes/analytics/+page.svelte:1291-1309` renders Disclosure Index only for signed-in
  visitors, matching the shared link filter.

The prior test gap is also closed:

- `src/lib/components/layout/UnifiedHeader.svelte.test.ts` covers anonymous desktop,
  signed-in filtering, and unrelated public routes.
- `src/lib/components/layout/Navbar.svelte.test.ts` covers route context, signed-in
  filtering, and panel closure after a section jump.
- `src/routes/analytics/page.svelte.test.ts:1005-1032` verifies that every advertised
  anonymous and signed-in report link has a rendered anchor target.

## Direction and scope assessment

The implementation remains aligned with accepted ADR-009, ADR-010, ADR-015, and
`notes/PRODUCT_VISION.md`: mobile and desktop preserve the same core report-navigation
task, anonymous navigation exposes only proof-surface sections, and the static report
does not add personalized dashboard sprawl. Moving secondary jumps into the relevant
shells while retaining the bounded Ask action supports the intended calmer decision
surface.

The slice is independently mergeable. It does not require the separate desktop-shell
redesign and introduces no new data, authorization, or external-contract boundary.
