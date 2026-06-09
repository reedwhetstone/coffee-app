# PR 378 Reverify Audit: Analytics Action CTA Primitive

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 0
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:

- Format `notes/pr-audits/2026-06-08-pr378-analytics-action-cta.md` so the full repo lint gate passes.

CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_after_small_lint_patch

## Scope reviewed

Reviewed the refreshed artifacts in `.verify-pr/20260608T040826Z-feat-analytics-action-cta-primitive/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`

Also reviewed:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/003-public-analytics-three-chart-free-gate.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md`
- `notes/implementation-plans/2026-05-09-analytics-intelligence-red-team.md`
- `notes/pr-audits/2026-06-08-pr378-analytics-action-cta.md`
- Changed code in `src/lib/analytics/actionContext.ts`, `src/lib/components/analytics/AnalyticsActionCta.svelte`, `src/routes/analytics/+page.svelte`, `src/routes/analytics/page.svelte.test.ts`, and `src/routes/chat/+page.svelte`
- Existing chat auth/tool gates in `src/hooks.server.ts`, `src/routes/chat/+page.server.ts`, `src/routes/api/chat/+server.ts`, `src/lib/server/auth.ts`, and `src/lib/services/tools.ts`

## Validation

- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `pnpm test -- src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS. Vitest ran the repo suite: 70 test files and 643 tests passed.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm check`: VALIDATION_PASS.
- `pnpm exec prettier --check src/lib/analytics/actionContext.ts src/lib/components/analytics/AnalyticsActionCta.svelte src/routes/analytics/+page.svelte src/routes/analytics/page.svelte.test.ts src/routes/chat/+page.svelte`: VALIDATION_PASS.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm lint`: VALIDATION_FAIL. Prettier reports `notes/pr-audits/2026-06-08-pr378-analytics-action-cta.md` is not formatted. The command exits before ESLint.

## Previous findings rechecked

### Resolved: analytics context no longer uses a dead `analyticsContext` URL parameter

Confirmed in `src/lib/analytics/actionContext.ts:49-73` and `src/routes/chat/+page.svelte:110-116`.

`buildAnalyticsChatPrompt()` now writes the bounded `AnalyticsChatContext` directly into the seeded prompt under `Context JSON`, including `activeFilters`. `buildAnalyticsChatHref()` emits only `source=analytics` and `prompt=...`; it does not emit the old dead `analyticsContext` parameter. The chat page reads the prompt with `readAnalyticsSeedFromSearchParams()` and preloads it only when `canUseChat` is true.

The analytics page provides the active context at `src/routes/analytics/+page.svelte:624-652`, including current market scope, movement window, latest index date, stocked listing count, supplier count, origin count, visible modules, and entitlement.

Focused test coverage exists at `src/routes/analytics/page.svelte.test.ts:436-474`, including `url.searchParams.has('analyticsContext') === false` and `activeFilters` expectations.

### Resolved: Roasting-only and both-entitlement CTA states are covered

Confirmed in `src/routes/analytics/page.svelte.test.ts:476-512`.

The Roasting-only test verifies that a signed-in `member` without Parchment Intelligence receives a `/chat` ask link with `entitlement: 'roasting'`, does not unlock supplier comparison, and still sees watch disabled. The both-entitlement test verifies `entitlement: 'both'` and supplier comparison module visibility.

The route contract also supports the behavior. `/chat` is allowed for `ppiAccess || member` in `src/hooks.server.ts:142-150`, `/api/chat` uses `requireChatAccess` from `src/lib/server/auth.ts:121`, and `createChatTools()` returns member tool access for Roasting users while preserving the Parchment-only tool subset for Intelligence-only users.

### Resolved: ask CTA copy no longer overbrands the Roasting path

Confirmed in `src/routes/analytics/+page.svelte:989-996`.

The analytics CTA description now uses neutral copy: “Open chat with the selected market scope...” rather than “Parchment Intelligence Chat.” The `Ask with this context` label is entitlement-neutral.

Note: the `/chat` destination still has existing page-level headings that say “Parchment Intelligence Chat.” That is outside this PR's changed surface and appears pre-existing. It may be worth a later product-language cleanup, but it is not a same-PR blocker for this CTA primitive.

## New finding

### P1: full lint gate fails because the newly added prior audit report is not Prettier-formatted

Confirmed by running the full lint command with required dummy environment exports:

`PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm lint`

Result:

- `prettier --check .` reports `notes/pr-audits/2026-06-08-pr378-analytics-action-cta.md`
- The command exits with code 1 before ESLint runs

Why it matters: this branch is not merge-ready if CI runs the repo lint gate. The source files touched by the PR pass targeted Prettier, and `pnpm check` passes, so this looks like a small report-formatting issue rather than an implementation defect.

Recommended fix:

- Run Prettier on `notes/pr-audits/2026-06-08-pr378-analytics-action-cta.md`, commit the formatting change, then rerun `pnpm lint`.

Merge impact: blocks merge readiness until patched because a standard validation command fails.

## Product and mergeability assessment

The same-PR patches resolved the substantive P2/P3 issues from the prior audit without introducing new product or entitlement defects.

The PR remains aligned with `notes/PRODUCT_VISION.md`, ADR-003, ADR-005, and the analytics reframe plan:

- It keeps `/analytics` action-first without adding persistence, alerts, saved watchlists, notification logic, schemas, or fake success states.
- It routes to existing surfaces only: chat, catalog, supplier comparison, and API/console.
- It preserves anonymous and viewer login/upgrade treatment.
- It allows Roasting-only users to use chat-style sourcing actions when existing chat auth permits.
- It keeps supplier comparison gated to Parchment Intelligence.
- It embeds bounded analytics context honestly into the user-visible chat seed.

The PR slice is independently mergeable after the lint formatting fix. The boundary is not wrong; no rescope or supersede is needed.
