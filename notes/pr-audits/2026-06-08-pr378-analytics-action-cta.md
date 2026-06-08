# PR 378 Verify Audit: Analytics Action CTA Primitive

VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 2
P3: 1
NEXT_ACTION: patch_same_pr
TOP_FIXES:

- Make the analytics chat context contract actually reach the chat seed, or remove the dead `analyticsContext` URL parameter and include the bounded context payload in the prompt.
- Add explicit Roasting-only and `both` entitlement coverage for the analytics CTA rail.
- Neutralize the ask CTA copy so Roasting-only members are not told they are opening “Parchment Intelligence Chat.”
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable_with_followups

## Scope reviewed

Reviewed artifacts in `.verify-pr/20260608T035826Z-feat-analytics-action-cta-primitive/`, the full diff, changed files in repo context, `notes/PRODUCT_VISION.md`, the analytics reframe plan, the red-team report, and ADR-003.

Changed files:

- `src/lib/analytics/actionContext.ts`
- `src/lib/components/analytics/AnalyticsActionCta.svelte`
- `src/routes/analytics/+page.svelte`
- `src/routes/analytics/page.svelte.test.ts`
- `src/routes/chat/+page.svelte`

## Validation

- `pnpm test -- src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS. Note: this command ran the full Vitest suite in this repo; all 70 test files and 641 tests passed.
- `pnpm check`: VALIDATION_BLOCKED_ENV on first run because `$env/static/*` keys were not exported in the clean worktree. Missing: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm check`: VALIDATION_PASS.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm lint`: VALIDATION_PASS.
- `git diff --check origin/main...HEAD`: VALIDATION_PASS.

## Executive assessment

The PR is directionally aligned with the analytics reframe. It adds a small reusable CTA component, keeps placements limited to `/analytics`, routes to existing surfaces, gates chat and supplier comparison honestly, and keeps watchlists disabled with explicit future-language. It does not add persistence, backend schemas, notification logic, saved-state claims, or unsupported success states.

The slice is independently mergeable in product terms: if the next PR never ships, analytics still gains an honest action rail that points to chat, catalog, supplier comparison, API/console, and a disabled watch preview.

The main weakness is that the new `AnalyticsChatContext` is partly ceremonial. The PR serializes it into `analyticsContext` in the URL, but the chat page ignores that parameter and only preloads the separate `prompt`. The prompt includes some context, but not the full bounded context object or `activeFilters`. That is not a blocker, because the user-visible chat seed still carries market read, scope, window, visible modules, entitlement, and the no-fake-persistence instruction. But it undermines the stated contract and should be tightened in the same PR.

## Findings

### P2: `AnalyticsChatContext` is serialized but not consumed by chat

Confirmed in `src/lib/analytics/actionContext.ts:62-79` and `src/routes/chat/+page.svelte:110-116`.

`buildAnalyticsChatHref()` emits both:

- `prompt`: a human-readable chat seed
- `analyticsContext`: `JSON.stringify(context)`

`readAnalyticsSeedFromSearchParams()` only reads `prompt`, and `/chat` only assigns that prompt to `inputMessage`. The structured `analyticsContext` parameter is never parsed, validated, or passed into the chat request. Meanwhile, `src/routes/analytics/+page.svelte:624-652` populates `activeFilters` with specific scoped counts and freshness, but `buildAnalyticsChatPrompt()` omits those details.

Why it matters: the implementation technically defines the interface before placing the ask CTA, but the live chat route does not use the interface as a contract. This makes the URL parameter dead data and leaves future developers thinking structured analytics context is wired when it is not.

Recommended fix:

- Either include a compact, bounded context block in the prompt, including `activeFilters`, and drop the unused `analyticsContext` parameter; or
- Parse and validate `analyticsContext` in `src/routes/chat/+page.svelte`, append it into the input seed, and add a focused test for the chat prefill behavior.

Merge impact: not a correctness blocker, but it is exactly the layer this PR is supposed to make honest.

### P2: Roasting-only and `both` entitlement states are not covered by focused tests

Confirmed in `src/routes/analytics/page.svelte.test.ts:406-475`.

The tests cover:

- anonymous/login state
- Parchment Intelligence viewer with chat context
- signed-in viewer without Intelligence access

They do not cover the explicit intent clause that Roasting users may access chat-style sourcing actions if existing route auth permits. The implementation appears to handle this through `canUseAnalyticsChat()` and `resolveAnalyticsEntitlement()`, but this is a product entitlement edge worth locking down.

Recommended fix:

- Add a test where `session` exists, `role: 'member'`, and `isParchmentIntelligence: false`.
- Assert the ask CTA links to `/chat`, serialized context has `entitlement: 'roasting'`, supplier comparison remains upgrade-gated, and watch remains disabled.
- Optionally add a `role: 'member'` plus `isParchmentIntelligence: true` test asserting `entitlement: 'both'`.

Merge impact: not blocking because the implementation path is straightforward and existing route auth supports it, but it is under-tested relative to the acceptance criteria.

### P3: Ask CTA copy overbrands the chat path for Roasting-only members

Confirmed in `src/routes/analytics/+page.svelte:989-997`.

The description always says “Open Parchment Intelligence Chat...” even when the user is a Roasting-only member with chat access but no Parchment Intelligence entitlement. The prompt itself serializes `entitlement: 'roasting'`, so the logic is honest; the copy is the mismatch.

Recommended fix:

- Use neutral copy such as “Open chat with the selected market scope...” or conditional copy for Intelligence vs Roasting.

Merge impact: low. This is a clarity polish, not a functional blocker.

## Positive coverage

- `src/lib/components/analytics/AnalyticsActionCta.svelte` is a small presentational primitive, not a new workflow system.
- `src/routes/analytics/+page.svelte:660-685` keeps unsupported users on login or upgrade paths rather than opening inaccessible chat.
- Supplier comparison links only to the existing gated module when `isParchmentIntelligence` is active.
- Watch is disabled, labeled as a future workflow, and explicitly says no saved state, alerts, or watch confirmations are created.
- API action routes to existing API surfaces: `/api` for public visitors and `/api-dashboard` for signed-in users.
- No backend writes, migrations, alert logic, or persistence claims were introduced.
- Tests assert no fake watch persistence and validate the Parchment Intelligence chat URL context.

## Product alignment

Aligned with `notes/PRODUCT_VISION.md` and the analytics reframe:

- Strengthens public product value by turning analytics into a decision/action surface.
- Avoids fake capture theater.
- Keeps anonymous/viewer users on login or upgrade affordances.
- Preserves ADR-003 by leaving deeper supplier comparison behind the Parchment Intelligence gate.
- Does not expand public analytics into power-user workflows.

## Mergeability

The PR is a valid mergeable slice. The boundary is not wrong. The recommended fixes are same-PR hardening, not a rescope or supersede case.
