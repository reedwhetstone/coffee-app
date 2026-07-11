# PR 378 Postpatch Verify Audit: Analytics Action CTA Primitive

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- None.

CONFIDENCE: high
SCOPE_ASSESSMENT: independently_mergeable

## Scope reviewed

Reviewed the assigned PR context artifacts in `.verify-pr/20260608T044323Z-pr-378/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`

Reviewed product and architecture context:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/003-public-analytics-three-chart-free-gate.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md`
- `notes/implementation-plans/2026-05-09-analytics-intelligence-red-team.md`

Inspected changed implementation files in repo context:

- `src/lib/analytics/actionContext.ts`
- `src/lib/analytics/actionContext.test.ts`
- `src/lib/components/analytics/AnalyticsActionCta.svelte`
- `src/routes/analytics/+page.svelte`
- `src/routes/analytics/+page.server.ts`
- `src/routes/analytics/page.svelte.test.ts`
- `src/routes/chat/+page.svelte`
- `src/routes/chat/+page.server.ts`
- `src/routes/chat/page.svelte.test.ts`

Also spot-checked the existing chat/server gates that this slice relies on:

- `src/hooks.server.ts`
- `src/routes/api/chat/+server.ts`
- `src/lib/server/auth.ts`
- `src/lib/services/tools.ts`

## Validation

Commands run:

- `git status --short --branch`: VALIDATION_PASS. Worktree was on `pr-378` with no pre-existing local modifications.
- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `pnpm exec vitest run src/lib/analytics/actionContext.test.ts src/routes/analytics/page.svelte.test.ts src/routes/chat/page.svelte.test.ts`: VALIDATION_PASS. 3 files and 23 tests passed. One analytics test intentionally logs a mocked chunk-load failure while asserting the error-state path.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm check --fail-on-warnings`: VALIDATION_PASS. 0 errors and 0 warnings.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy OPENROUTER_API_KEY=dummy pnpm lint`: VALIDATION_PASS. Prettier and ESLint passed.

## Intent coverage assessment

The implementation satisfies the stated PR 04 intent.

### Honest action CTA primitive

`src/lib/components/analytics/AnalyticsActionCta.svelte` is a small presentational CTA primitive. It does not introduce a workflow system, persistence, background writes, new API routes, schemas, or hidden state. Current placements route only to existing surfaces:

- Ask routes to `/chat` when the user already has chat access.
- Catalog routes to `/catalog`.
- Compare routes to `#supplier-comparison` only for Parchment Intelligence users, otherwise login or subscription.
- API routes to `/api` for public visitors and `/api-dashboard` for authenticated users.
- Watch is disabled with explicit preview language.

### AnalyticsChatContext is bounded and used before chat CTAs

`src/lib/analytics/actionContext.ts` defines `AnalyticsChatContext` with scoped fields for origin, process, supplier, view mode, movement window, active filters, visible modules, and entitlement. `src/routes/analytics/+page.svelte` constructs it from existing analytics state before building the chat CTA href.

The final chat URL does not carry a dead `analyticsContext` parameter. Instead, `buildAnalyticsChatPrompt()` turns the bounded context into a user-visible prompt with the selected market scope, movement window, latest index date, listing/supplier/origin counts, visible evidence, and access level. This is consistent with the plan's requirement that chat receive honest scoped context rather than decorative or hidden state.

### No fake persistence or saved/watch success

The watch action is disabled and says no saved state, alerts, or watch confirmations are created. The chat prompt also tells the assistant not to claim that anything has been saved or watched. No saved search, alert, watchlist, intent table, notification, migration, backend write, or success state appears in the diff.

### Public and Parchment Intelligence gates are preserved

The action rail keeps anonymous users on login/API/catalog surfaces. Signed-in viewers without Intelligence or Roasting get upgrade copy for ask/compare and no chat prompt href. Supplier comparison remains gated by `isParchmentIntelligence`; the anchor target exists only in the Parchment Intelligence branch and non-Intelligence users are routed to login or subscription instead.

Roasting-only chat access is consistent with the existing program-level chat access decision: `/chat` and `/api/chat` allow `ppiAccess || member`, and chat tools remain tier-filtered. The CTA does not unlock supplier comparison for Roasting-only users.

### Test coverage matches acceptance criteria

Focused coverage exists for:

- anonymous CTA surfaces and disabled watch state;
- Parchment Intelligence chat prompt seeding;
- signed-in viewer upgrade path;
- Roasting-only chat access without supplier comparison unlock;
- users with both Intelligence and Roasting access;
- no separate `analyticsContext` URL parameter;
- prompt content and no raw context serialization;
- chat prompt extraction, seed replay prevention, CSR re-navigation behavior, and typed-input preservation;
- chat page prefill for chat-entitled users and no input for users without chat access.

## Product alignment

This slice aligns with `notes/PRODUCT_VISION.md`, ADR-003, ADR-005, and the analytics reframe plan. It makes `/analytics` more action-oriented while respecting the public proof versus paid leverage boundary. It strengthens the path from analytics to existing decision surfaces without inventing unsupported backend-backed workflow semantics.

The PR is independently mergeable: if no later PR ships, `/analytics` still gains an honest action rail, bounded chat handoff, clear upgrade/login states, and disabled future-language for unsupported watch behavior.

## Findings

No P0, P1, P2, or P3 issues found.

## Recommendation

Merge PR #378.
