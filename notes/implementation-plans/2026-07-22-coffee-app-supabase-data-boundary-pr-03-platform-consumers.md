# PR 03: Coffee-app platform-data consumer cutover

## PR goal

Move market analytics, watchlist/portfolio, procurement context, price-index
readers, and API-usage pages from Supabase to the released Parchment SDK.

## Why this slice comes now

PR 02 makes the required shared contracts canonical. This slice removes the
largest remaining read-only divergence without touching Mallard writes.

## In scope

- Analytics and dashboard catalog/market/supplier reads
- `agentPriceIndex.ts` and remaining local similarity consumers
- tracked-lot list/toggle/enrichment for catalog, beans, dashboard, analytics,
  and chat context
- sourcing-brief summaries in dashboard/chat
- API dashboard usage/key summaries and local API-key validation compatibility
  paths that can now delegate to Parchment
- Deletion of replaced shared query/RPC code and boundary-manifest entries

## Out of scope

- Inventory/roast/sales/tasting writes
- Bean identity, confirmed chat actions, workspace persistence, or billing

## Files to change

- `src/routes/analytics/+page.server.ts`
- dashboard, beans, catalog tracking, chat, and API-dashboard server loaders
- `src/lib/server/{agentPriceIndex,catalogSimilarity,trackedLots,briefMatchSummary,apiAuth}.ts`
- `src/lib/data/api-usage.ts`
- affected adapters, tests, and boundary manifest

## Acceptance criteria

- A shared-data Supabase client is never used by the affected surfaces.
- Public/member/Intelligence behavior and current page data shapes are preserved.
- Parchment errors, timeouts, and entitlements map consistently.
- Replaced direct table/RPC access is deleted.

## Test plan

- SDK adapter and page-loader parity tests
- public-demo/session/Intelligence negative and positive cases
- watchlist ownership and toggle behavior
- API usage date-window and per-key summaries
- coffee-app check, focused tests, lint/format, and build

## Risks

- Analytics fan-out can regress latency. Use the canonical aggregate contracts
  from PR 02 and preserve independent streaming only where it improves UX.

## Follow-on dependency

None. This remains valuable if Mallard cutovers are delayed.
