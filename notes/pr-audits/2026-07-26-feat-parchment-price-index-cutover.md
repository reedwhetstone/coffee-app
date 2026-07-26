# Pre-submission red-team re-review: `feat/parchment-price-index-cutover`

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
- `pnpm vitest run src/lib/server/agentPriceIndex.test.ts src/lib/services/tools.test.ts src/routes/api/chat/route.test.ts`: VALIDATION_PASS
- `git diff --check origin/main...HEAD`: VALIDATION_PASS
- `pnpm exec eslint src/lib/server/agentPriceIndex.ts src/lib/server/agentPriceIndex.test.ts src/lib/services/tools/index.ts src/lib/services/tools/shared.ts src/routes/api/chat/+server.ts src/routes/api/chat/route.test.ts src/lib/services/tools.test.ts`: VALIDATION_PASS
- `pnpm test`: VALIDATION_PASS
- `pnpm check`: VALIDATION_PASS
- `pnpm build`: VALIDATION_PASS
- Production `/v1/price-index` `order=desc`, `order=asc`, and lowercase-natural canaries: VALIDATION_PASS

## Gate result

No legitimate P0, P1, P2, or P3 findings remain. The branch is independently
mergeable if no follow-up slice ships.

The initial gate's P1 entitlement/cache mismatch and P2 stale API-key-only
documentation are resolved:

- `src/lib/services/tools/index.ts:81-102` now exposes `price_index_read` and the
  other PPI market tools only when `ppiAccess` is true. Member-only sessions keep
  Mallard tools without receiving PPI market tools; PPI-only and bundle sessions
  receive the PPI tools; the viewer tool set remains minimal.
- `src/routes/api/chat/+server.ts:123-134`, `src/routes/api/chat/+server.ts:238-264`,
  and `src/routes/api/chat/+server.ts:292-295` keep member-only prompts free of
  PPI market tool names and guidance while advertising those tools to PPI-only
  and bundle sessions.
- `src/lib/server/agentPriceIndex.ts:74-125` contains no process-global cache.
  Every invocation calls `client.priceIndex.list`, so a prior caller's successful
  authorization cannot substitute for the current call's upstream authorization.
- `src/lib/docs/content.ts:292`, `src/lib/docs/content.ts:399-402`, and
  `src/lib/docs/content.ts:1652-1658` describe the live resource as an
  authenticated Parchment Intelligence contract supporting entitled first-party
  sessions and customer API keys.

## What the branch actually does

The chat route creates a request-bound session-mode `ParchmentClient` at
`src/routes/api/chat/+server.ts:638` and closes the price-index adapter over that
client at `src/routes/api/chat/+server.ts:663`. The adapter clamps the lookback
and limit, creates a UTC ISO `from` boundary, requests page one in explicit
newest-first order, forwards the supported origin/process/wholesale filters, and
maps the generated SDK response into the existing app-owned tool result shape.
SDK errors become tool errors, and repeat calls always traverse the request-bound
client.

The package manifest and lockfile both resolve `@purveyors/sdk` 0.15.0. The SDK
contract provides the `order` query and the nested `PriceIndexItem` response
shape used by the adapter.

## Entitlement and prompt trace

- **Mallard-only (`memberAccess=true`, `ppiAccess=false`):**
  `createChatTools` returns the Mallard tool set without any PPI market tools,
  and `_buildSystemPrompt` uses the Mallard-only tool inventory plus common
  non-PPI guidance.
- **PPI-only (`memberAccess=false`, `ppiAccess=true`):**
  `createChatTools` returns the Parchment sourcing/portfolio set plus all injected
  PPI market tools, and the prompt advertises and explains those tools.
- **Bundle (`memberAccess=true`, `ppiAccess=true`):**
  `createChatTools` returns Mallard plus PPI market tools, and the prompt appends
  the distinct Parchment Intelligence market-tool section.
- **Viewer (`memberAccess=false`, `ppiAccess=false`):**
  the tool factory returns only catalog search, catalog facets, and presentation.
  The production chat route additionally rejects this state in
  `src/lib/server/auth.ts:103-119`, so an unentitled viewer cannot reach model
  execution.

Tests at `src/lib/services/tools.test.ts:27-100` cover all four tool combinations.
Prompt tests at `src/routes/api/chat/route.test.ts:33-112` cover PPI-only,
Mallard-only, and bundle behavior; the viewer path is blocked before prompt
construction by the route authorization invariant.

## Direct-query boundary and direction

The retired reader has no Supabase client or direct
`price_index_snapshots` query. Repository search leaves the direct application
read only in `src/routes/analytics/+page.server.ts`, and
`notes/ARCHITECTURE.md:99-105` explicitly preserves that analytics read as
migration debt.

This slice advances Accepted ADR-007 and the API-first product direction:
Parchment owns the shared query and authorization behavior, the generated SDK is
the integration contract, and coffee-app retains only request context, tool
registration, prompt entitlement shaping, and its app-owned result shape. It
also preserves ADR-015's PPI-gated market-intelligence direction without
expanding anonymous or Mallard-only access.

## Validation assessment

The independent focused run passed 33 tests across the reader, tool allowlist,
and chat route suites. Diff whitespace and targeted ESLint also passed. Parent
validation supplied the broader passing evidence: 969 tests passed with 11
skipped, `pnpm check` reported zero errors and warnings, the production build
passed, and live ordering/filter canaries passed. No validation signal conflicts
with the audited implementation.
