# Catalog browse summaries

This is the first-party consumer of [Parchment summary projection #297](https://github.com/reedwhetstone/parchment-api/pull/297),
following [the performance audit](https://github.com/reedwhetstone/parchment-api/pull/292).
Deploy the API first. Older APIs safely ignore the optional query and return
full rows; the UI only demand-loads details when `summarySignals` is present.

Catalog SSR and interactive filter refreshes request `projection=summary`.
Member summaries preserve the card's displayed identity, pricing, tasting preview,
AI description, score, and proof without carrying full farm/roast/process
narratives for every visible row. Public/viewer projections are unchanged.
Presence flags keep fallback score/confidence identical when narratives are
omitted, including for records without a persisted score.

Opening a summary card calls the existing credential-aware BFF catalog endpoint
with exactly one catalog ID, all stock states, full projection and proof.
The selected card shows loading or retry state until complete data arrives.
Closing/unmounting aborts unfinished work; completed detail belongs to that card
instance and is reused on reopen. Other CoffeeCard consumers retain existing
behavior because demand loading is opt-in. No cross-user cache is introduced.

The API counterpart includes a synthetic long-narrative payload guard below one
fifth of the original size. This does not establish production latency or byte
percentiles, and it does not eliminate Supabase-to-API text transfer. API-side
proof and metadata-presence calculation still needs those inputs.

## Validation

Focused tests cover actual summary requests from SSR and interactive refresh,
no detail request for collapsed cards, initial deep-link hydration, successful
open/reopen, retry after failure, cancellation on close, exact-ID/full-detail
response validation, and score parity. `pnpm check` and `pnpm build` pass using
placeholder public environment values for local validation (no live Supabase
access). Live authenticated browser behavior and production performance remain
post-deployment checks, not claimed here.
