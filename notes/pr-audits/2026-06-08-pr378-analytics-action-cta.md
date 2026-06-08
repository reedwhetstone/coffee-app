# PR 378 Verify Audit: Analytics Action CTA Primitive

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- Resolved: the chat prompt now carries a compact bounded analytics context and no separate `analyticsContext` URL parameter is emitted.
- Resolved: explicit Roasting-only and `both` entitlement coverage was added for the analytics CTA rail.
- Resolved: ask CTA copy now uses neutral chat wording instead of overbranding Roasting-only access as Parchment Intelligence Chat.
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable

## Scope reviewed

Reviewed artifacts in `.verify-pr/20260608T035826Z-feat-analytics-action-cta-primitive/`, the full diff, changed files in repo context, `notes/PRODUCT_VISION.md`, the analytics reframe plan, the red-team report, and ADR-003.

Changed files:

- `src/lib/analytics/actionContext.ts`
- `src/lib/analytics/actionContext.test.ts`
- `src/lib/components/analytics/AnalyticsActionCta.svelte`
- `src/routes/analytics/+page.svelte`
- `src/routes/analytics/page.svelte.test.ts`
- `src/routes/chat/+page.svelte`
- `src/routes/chat/page.svelte.test.ts`

## Validation

- `pnpm test -- src/lib/analytics/actionContext.test.ts src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS. Note: this command ran the full Vitest suite in this repo; all 72 test files and 650 tests passed.
- `pnpm check`: VALIDATION_BLOCKED_ENV on first run because `$env/static/*` keys were not exported in the clean worktree. Missing: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm check`: VALIDATION_PASS.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm lint`: VALIDATION_PASS.
- `git diff --check origin/main...HEAD`: VALIDATION_PASS.

## Executive assessment

The PR is directionally aligned with the analytics reframe. It adds a small reusable CTA component, keeps placements limited to `/analytics`, routes to existing surfaces, gates chat and supplier comparison honestly, and keeps watchlists disabled with explicit future-facing language. It does not add persistence, backend schemas, notification logic, saved-state claims, or unsupported success states.

The slice is independently mergeable in product terms: if the next PR never ships, analytics still gains an honest action rail that points to chat, catalog, supplier comparison, API/console, and a disabled watch preview.

Resolution note: the original audit findings below were patched in this PR. The final implementation no longer emits a separate structured analytics URL parameter; instead it embeds compact, user-legible context fields in the chat prompt, including scope, movement window, freshness, counts, visible evidence, and access level. The chat route uses a tested seed-update helper for analytics prompt prefill.

## Findings

### Resolved P2: Analytics context is now consumed through the chat prompt

Original concern: the early draft treated `AnalyticsChatContext` as ceremonial by carrying structured context separately from the prompt.

Resolution: `buildAnalyticsChatHref()` now emits only `source=analytics` and `prompt`. `buildAnalyticsChatPrompt()` includes the bounded analytics context as compact labeled lines: scope, movement window, latest index date, stocked listings, suppliers, origins, visible evidence, and user-legible access level. `/chat` reads the analytics prompt seed and assigns it to the chat input for users who can use chat.

Coverage: analytics tests assert there is no separate `analyticsContext` parameter, the prompt does not contain raw JSON or internal entitlement vocabulary, and the compact context lines are present. `src/lib/analytics/actionContext.test.ts` covers `/chat?source=analytics&prompt=...` extraction plus the seed-update path used by the chat page, including chat entitlement, same-seed replay avoidance, CSR re-navigation to a new analytics seed, and protection for actively typed input. `src/routes/chat/page.svelte.test.ts` adds page-level coverage that chat-entitled users see the analytics prompt prefilled and signed-in users without chat access do not see the input.

### Resolved P2: Roasting-only and `both` entitlement states now have focused tests

Original concern: the first test pass covered anonymous, Parchment Intelligence, and signed-in viewer states, but not the explicit Roasting-only and combined entitlement paths.

Resolution: `src/routes/analytics/page.svelte.test.ts` now covers Roasting-only members, asserts that they can ask with analytics context without unlocking supplier comparison, and covers users with both Parchment Intelligence and Mallard Studio access. The prompt uses user-facing access labels rather than raw internal entitlement values.

### Resolved P3: Ask CTA copy is neutral across chat-entitled users

Original concern: the first draft overbranded the chat path for Roasting-only members.

Resolution: the CTA now says “Open chat with the current scope, movement window, and market evidence already framed in the prompt.” The prompt also uses a user-facing `Access level` line instead of raw entitlement vocabulary.

## Positive coverage

- `src/lib/components/analytics/AnalyticsActionCta.svelte` is a small presentational primitive, not a new workflow system.
- `src/routes/analytics/+page.svelte:660-685` keeps unsupported users on login or upgrade paths rather than opening inaccessible chat.
- Supplier comparison links only to the existing gated module when `isParchmentIntelligence` is active.
- Watch is disabled, labeled as coming soon, and explicitly says no saved state, alerts, or watch confirmations are created.
- API action routes to existing API surfaces: `/api` for public visitors and `/api-dashboard` for signed-in users.
- No backend writes, migrations, alert logic, or persistence claims were introduced.
- Tests assert no fake watch persistence, validate compact chat prompt context, and cover chat prompt prefill.

## Product alignment

Aligned with `notes/PRODUCT_VISION.md` and the analytics reframe:

- Strengthens public product value by turning analytics into a decision/action surface.
- Avoids fake capture theater.
- Keeps anonymous/viewer users on login or upgrade affordances.
- Preserves ADR-003 by leaving deeper supplier comparison behind the Parchment Intelligence gate.
- Does not expand public analytics into power-user workflows.

## Mergeability

The PR is a valid mergeable slice. The boundary is not wrong. The recommended fixes are same-PR hardening, not a rescope or supersede case.
