# Pre-submission audit: Parchment roast chart data cutover

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

## Intent

Replace the active roast chart BFF's direct Supabase RPC reads with the released
owner-scoped `@purveyors/sdk` 0.25.0 `roasts.chartData` contract while preserving
the legacy browser response envelope, authentication behavior, and connected
chart consumers.

## Findings

No legitimate P0-P3 findings.

The route preserves its same-origin browser contract, uses the authoritative
hook-populated session state, forwards that session through the server-only
Parchment client, maps the SDK chart points and nullable metadata back into the
existing web envelope, and retains the legacy 500 response on upstream failure.
The roast page, GenUI block, and shared chart transformation pipeline remain
compatible with the mapped point fields and metadata defaults.

The SDK 0.25 type change also required a narrow compile-only error-envelope cast
in the API-key generation route. Its existing behavior and tests remain intact.

The slice is independently mergeable. It removes one active shared-data
Supabase boundary and depends only on the already published and deployed
Parchment contract.

## Validation

- `pnpm exec vitest run src/routes/api/roast-chart-data/route.test.ts src/lib/roast/roast-data.test.ts src/routes/api-dashboard/keys/keys.test.ts`: 73 passed
- `pnpm test`: 1,080 passed, 11 skipped
- `pnpm check` with compile-only static environment values: 0 errors, 0 warnings
- affected-file Prettier and ESLint: passed
- production build with compile-only static environment values: passed
- `git diff --check origin/main...HEAD`: passed

Repo-wide `pnpm lint` remains baseline-blocked by 18 unrelated pre-existing
Markdown formatting files. Every file changed by this branch passes Prettier
and ESLint directly.
