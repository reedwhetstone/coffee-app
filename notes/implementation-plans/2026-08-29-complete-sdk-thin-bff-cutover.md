# Complete coffee-app SDK/thin-BFF cutover

**Status:** Accepted<br>
**Date:** 2026-08-29<br>
**Owners:** Parchment API and coffee-app maintainers<br>
**Governing direction:** [ADR-007: Headless API extraction, web as reference client](../decisions/007-headless-api-extraction-web-as-reference-client.md)<br>
**Supersedes:** [2026-07-22 Supabase data-boundary retirement](./2026-07-22-coffee-app-supabase-data-boundary-retirement.md) as the terminal migration plan; that document remains useful as a historical capability map.

## Goal and terminal boundary

Finish ADR-007 literally. Coffee-app becomes a public reference client whose server contains only generic SDK consumption, browser identity/session plumbing, transport adaptation, and presentation support. Parchment owns every durable application and shared-product-data read or mutation, reusable business rule, authorization decision, model/provider credential, and AI orchestration loop.

The terminal direct-Supabase allowlist is limited to:

- Supabase Auth OAuth initiation and callback exchange;
- secure browser-session creation, refresh, identity hydration, sign-out, and server-side JWT forwarding;
- no product table or RPC access, including workspace, message, canvas, or user-memory persistence.

Coffee-app may retain transient browser and server presentation state, SvelteKit page composition, Stripe.js browser presentation, GenUI/canvas rendering, confirmation UX, and display/action-card schemas. It must not retain a service-role database client, direct product-table or RPC access, OpenRouter or another model-provider credential, model-facing tool definitions, prompt policy, domain matching rules, multi-step mutation logic, or a second product-authorization model.

A thin BFF may broker the session credential, enforce same-origin/CSRF controls, validate transport-level inputs, forward or relay requests and streams, map transport errors, and preserve web response shapes. It may not make product authorization decisions, execute reusable business behavior, orchestrate models/tools, or persist durable application state.

## Why this plan replaces the July boundary

The July 22 plan was a narrower shared-data retirement program. Its workspaces, memory, and billing carve-outs described that program's scope, not ADR-007's terminal architecture. Implementation has already overtaken part of it: billing and account deletion are Parchment-owned, while durable chat state, memory compaction, model orchestration, and provider credentials still remain in coffee-app. Reed's 2026-08-29 direction confirms that the whole application, not only shared catalog and inventory data, must be managed through the SDK/thin-BFF boundary.

No new architecture decision is required for that destination. ADR-007 already says that proprietary server behavior moves to Parchment and the chat UI consumes a streaming Parchment contract. This plan rebaselines the remaining implementation against that accepted direction.

## Verified current state

The closed-world source audit used coffee-app `origin/main` at `78d3d92fa407dfd2c47b113111895b818d1b848b`, which includes merged PR #551. It searched every non-test `src/**` Supabase table/RPC/auth call and client constructor, then traced reusable server behavior and active callers.

Active runtime code still touches 13 product tables and 3 product RPCs directly:

- market and catalog: `coffee_catalog`, `market_daily_summary`, `supplier_daily_stats`, and `get_supplier_price_ranges`;
- inventory sharing: `shared_links`, the share owner's `user_roles`, and cross-principal inventory/catalog/roast joins;
- roast mutations: `roast_profiles`, `roast_temperatures`, `roast_events`, and `artisan_import_log`;
- confirmed actions: `execute_chat_action`;
- legacy RAG: `match_coffee_chunks` plus catalog hydration;
- durable chat state: `workspaces`, `workspace_messages`, and `user_memory`.

The orphaned `beanIdentity.ts` module adds direct access to three identity tables and two RPCs but has no non-test runtime importer. It is deletion debt, not evidence that a new public contract is needed.

Coffee-app also still owns proprietary/reusable behavior outside those literal calls:

- analytics movement, process, percentile, supplier-health, and comparison projections;
- sourcing-brief criteria validation and lot matching;
- inventory-share authorization and cross-principal response construction;
- roast batch, live-curve, Artisan-log, and milestone mutation behavior;
- the confirmed-action dispatcher and its database RPC;
- chat prompts, provider selection, model-facing tool schemas and execution, entitlement-shaped tool assembly, catalog post-filtering, context pruning, model loops, summary generation, and memory compaction;
- a documented but apparently uncalled legacy RAG endpoint and deprecated compatibility tools.

The authenticated owner inventory/tasting path, sales, profit, API keys, API usage, principal resolution, billing, subscriptions, and account deletion are already Parchment/SDK-backed. They need final regression canaries, not replacement contracts.

Parchment `origin/main` at `73e02549e55d0aa3167d6ca7491cc6221a7c9882` exposes 69 OpenAPI paths and 80 operations. Generated SDK path types cover all 69 paths; named `ParchmentClient` helpers cover 77 operations, with only the service root and two provider webhooks intentionally raw. SDK 0.29.0 is current and coffee-app is pinned to it. Source coverage does not eliminate the demonstrated parity gaps below.

## Immediate inherited correction

The manual inventory batch lifecycle is not complete even though the earlier slice merged. Coffee-app still calls `createManualBatch` and terminal `getManualBatch`, and the beans form can treat a racing `404` as definitive and discard its UUID. SDK 0.29.0 already exposes `reserveManualBatch`, `commitManualBatch`, and `getManualBatchStatus`; status `unknown` is deliberately nonterminal.

The first implementation slice must consume that typed lifecycle and close the same recovery invariant for the already-shipped catalog reservation flow. The browser may persist an owner-scoped reservation envelope containing the operation UUID and the normalized request fields required to retry that exact operation. It must retain that UUID and normalized payload across `unknown`, `accepted`, `in_progress`, transport failures, and ambiguous outcomes, and rotate both only after `completed` or explicit `terminal_rejected`. A status lookup alone is not recovery when the reserve request may have been lost before reaching Parchment. It must not own a transaction queue or synthesize a completed resource from an identity-only mutation response. The catalog flow must receive the same treatment; it cannot be considered proven while `pendingCatalogReservation` remains memory-only and only the UUID reaches `sessionStorage`.

## Ownership and lifetime model

### Parchment-owned

- Durable catalog, market, procurement, inventory, tasting, roast, sales, profit, billing, API-control-plane, workspace, conversation, message, canvas, and user-memory state.
- Request-principal resolution, roles, plans, scopes, ownership, cross-principal grants, and entitlements.
- Durable operation lifecycles, payload-bound idempotency, replay/conflict semantics, retries, reconciliation, and audit evidence.
- Reusable projections, ranking, matching, aggregation, summary, compaction, and domain mutation behavior.
- Model/provider credentials, prompts and policy, model-facing tool schemas, tool selection/execution, provider calls, and streaming orchestration.
- Shared database schema and migration authority.

### Coffee-app-owned

- Supabase browser identity/session plumbing and secure forwarding of the resulting JWT.
- SvelteKit routing, same-origin and CSRF admission, generic SDK calls, stream relay, and response-shape adaptation.
- Page composition, URL state, copy, formatting, charts, display models, GenUI and canvas rendering, action-card presentation, user confirmation UX, stop/retry controls, and transient optimistic state.
- Public Stripe.js presentation and the already accepted purpose-bound account-deletion assertion integration.

### Request-lived versus durable

Thin-BFF request metadata and stream state are request-lived. Provider/model execution state is request- or operation-lived but Parchment-owned. Workspaces, conversations, messages, canvas snapshots, memory, confirmed-action ledgers, mutation reservations, share grants, and audit events are durable and Parchment-owned.

## Cross-cutting proof obligations

Every slice inherits these obligations unless its contract demonstrably cannot exercise one of them:

1. The Parchment implementation, OpenAPI contract, generated SDK types/helpers, production deployment, SDK publication, and a production capability canary are terminal before a coffee-app consumer PR removes its predecessor.
2. Header credentials take precedence over cookies where supported; browser BFF routes use the cookie session, `/v1/me` remains the sole product-principal authority, null plans resolve to viewer, and upstream failures fail closed.
3. Parchment rechecks ownership and entitlement at execution time. No raw API key, provider credential, bearer token, provider object, or private owner projection reaches browser page data.
4. Stable operation IDs and browser recovery envelopes are bound to normalized payloads. Same-ID/same-payload replay converges; same-ID/different-payload conflicts; ambiguous outcomes retain the owner-scoped identity and payload; definitive outcomes rotate them.
5. `unknown` means unresolved, never empty, absent, rejected, or terminal.
6. Collection consumers exhaust bounded stable pagination, deduplicate stable identities, validate upstream response shapes strictly, and preserve existing browser/page response envelopes.
7. Identity-only mutations are followed by canonical reads when the UI needs rich catalog, inventory, roast, or entitlement state.
8. There is no dual-write or direct-database fallback. Rollback is a coffee-app consumer revert while additive Parchment contracts remain deployed.
9. Externally reachable compatibility routes normally require production telemetry or an explicit observation window before deletion. For Phase 3D, Reed explicitly authorized a hard cutover on 2026-09-05 after the first-party caller graph closed and replacement canaries passed, accepting breakage for any unknown authenticated external caller.
10. Each cutover adds a narrow reintroduction guard for its retired resource. The terminal boundary check composes those guards; it is not a speculative provenance analyzer.
11. Parchment remains the only shared-schema migration authority. Database objects are not dropped until all supported consumers and operator paths are proven absent.

## Dependency order and atomic PR slices

Each numbered consumer slice starts only after its named upstream gate is deployed, published, and canaried. A slice may split further if review or rollout evidence shows a distinct authority, migration, rollback, or proof boundary, but it may not combine unrelated resources merely to reduce PR count.

### Phase 0: Rebaseline and correct the inherited inventory reservation lifecycle

#### 0A. Governing-plan rebaseline

Update current architecture and development-status documentation to record shipped Mallard slices, completed billing/account-deletion authority, the remaining ADR-007 destination, and this plan's supersession of the July terminal boundary. Preserve the July plan as history.

**Proof:** every claimed shipped resource maps to merged current code; every remaining direct caller maps to a later slice; no workspace/memory or billing carve-out is presented as the ADR-007 destination.

#### 0B. Coffee-app manual-batch and catalog reservation lifecycle correction

Replace legacy manual batch create/status consumption with SDK 0.29.0 reserve/commit/status, then close the same recovery invariant in the shipped catalog reservation flow. Persist an owner-scoped normalized reservation envelope, including the UUID and the request fields needed to retry that exact operation, and reconcile that envelope on reload/remount before creating another operation. Do not treat a status lookup as sufficient recovery when the reserve request may have been lost before reaching Parchment.

**Proof:** overlapping reserve/status requests, reload, component remount, cross-account isolation, rejection/edit/retry, exact-cent allocation, same-payload replay, changed-payload conflict, owner-scoped normalized-payload persistence for both manual and catalog reservations, and clearing only on `completed` or `terminal_rejected`.

### Phase 1: Finish shared market and procurement truth

#### 1A. Parchment market overview and public-evidence contract

Map each active analytics section to an existing Parchment resource. Add only the missing reusable daily overview/change, catalog-coverage, movement, process-distribution, and origin-price-distribution projections. Do not expose table-shaped summary endpoints.

**Proof:** golden fixtures against every anonymous/public analytics section, bounded pagination, deterministic percentile/process semantics, row-cap behavior, and latency budget.

#### 1B. Parchment entitled market-evidence and signal projection

Add the missing Parchment Intelligence projections for arrivals, delistings, comparison lots, supplier health/ranges, and display-ready signal catalog hydration. Prefer extending the existing market resource when its ownership and cache lifetime match; otherwise keep the entitled supplier projection separate from anonymous evidence.

**Proof:** anonymous teaser versus Intelligence authorization matrix, supplier/range golden fixtures, complete signal hydration without a service-role fallback, and strict visibility projection.

#### 1C. Coffee-app analytics and market consumer cutover

Consume the released SDK contracts, preserve current page shapes, then delete direct analytics/catalog/summary/RPC reads, local shared-domain quantile/process logic, signal admin hydration, and `supabase-admin.ts` if it has no remaining caller.

**Proof:** public and entitled page parity, full pagination, upstream failure behavior, no service-role client, source guard for retired tables/RPCs, and production Vercel-to-Parchment canaries.

#### 1D. Parchment sourcing-brief match authority

Reverify the existing procurement match contract before adding a route. Extend the canonical resource only for demonstrated gaps so it owns criteria validation, matching, counts, and stable matching lot IDs. Coffee-app retains URL/display mapping only.

**Proof:** current criteria matrix, malformed and unsupported criteria, catalog visibility, pagination/exhaustion, stable counts/IDs, and golden parity for catalog, dashboard, and chat consumers.

#### 1E. Coffee-app sourcing consumer cutover

Replace local criteria and lot-matching truth with the released SDK response across catalog, dashboard, and chat context. Remove the duplicated server matching modules once no supported caller remains.

**Proof:** all three consumers render equivalent results from one canonical response; source guard rejects local shared-domain match logic and direct catalog scans for sourcing.

### Phase 2: Finish owner and cross-principal domain mutations

#### 2A. Parchment inventory share-grant resource

Introduce a narrow share-grant contract for create, redeem/read, revoke if supported by current UX, expiry/validity, scoped resource authorization, owner visibility, and the permitted inventory/catalog/roast projection. Parchment, not coffee-app, authorizes cross-principal disclosure.

**Proof:** owner and cross-owner negatives, invalid/expired/revoked tokens, token entropy and non-enumerability, exact legacy response fixtures, catalog visibility, roast-summary limits, and owner role/entitlement changes after grant creation.

#### 2B. Coffee-app share consumer cutover

Turn `/api/share` and shared-token `/api/beans` behavior into thin SDK adapters. Remove `shared_links`, direct share-owner `user_roles`, `greenCoffeeUtils` cross-owner joins, and their database-derived types when unused.

**Proof:** current share UX parity, no direct owner-role lookup, no cross-owner database access, source guard, and production share create/redeem canary.

#### 2C. Parchment roast command parity

Reverify existing single-roast, nested temperature/event, Artisan, chart, and classification contracts. Add only demonstrated gaps: atomic multi-roast creation, delete-by-batch identity, and any live-curve replacement semantics required by active callers. Treat milestone backfill as a private operator migration or retire it; do not mix it into customer CRUD.

**Proof:** all-or-nothing batch create/delete, owner confinement, nested-row rollback, payload-bound replay/conflict, stocked-state triggers, Artisan replacement/clear, live-curve and milestone fixtures, and live-schema integration.

#### 2D. Coffee-app roast mutation cutover

Make `/api/roast-profiles` mutations thin SDK adapters, then delete direct roast/profile/temperature/event/import-log code. Retire the member-access milestone backfill route or replace it with the separately authorized operator capability. Do not port deprecated roast-tool calculations without a supported caller.

**Proof:** create/update/delete/batch/Artisan UI parity, profit refresh behavior, canonical post-mutation reads, source guard for roast tables, and production mutation canaries.

### Phase 3: Close confirmed actions and retire unsupported legacy behavior

#### 3A. Delete orphaned bean-identity code

Delete `beanIdentity.ts` and its tests after a final caller and production-surface check. If a real supported consumer is found, stop and plan a separately authorized admin identity resource with actor attribution and immutable transition history; do not publish an API merely to preserve dead code.

**Proof:** closed caller graph, no documented or telemetry-supported HTTP surface, and a guard against reintroducing direct identity tables/RPCs.

#### 3B. Parchment confirmed-action execution contract

Implement the closed discriminated action set for `add_bean_to_inventory`, `update_bean`, `create_roast_session`, `update_roast_notes`, and `record_sale`. Delegate to canonical inventory, roast, and sales services rather than wrapping the legacy `execute_chat_action` RPC. Parchment owns execution-time authorization and the durable operation ledger.

**Proof:** schema matrix for all five actions, owner/entitlement recheck, same-ID replay, changed-payload conflict, concurrent duplicate execution, partial-failure rollback, stocked-state invariants, exact response parity, and confirmation-bypass negatives.

#### 3C. Coffee-app confirmed-action cutover

Replace `/api/chat/execute-action` with one SDK call while retaining proposal cards, user confirmation, action-card rendering, and canonical refresh behavior locally. Remove the direct RPC and duplicated mutation dispatch.

**Proof:** end-to-end proposal/confirm/execute flows for all five actions, double-click/reload/retry, no pre-confirmation mutation, source guard, and production canaries.

#### 3D. Telemetry-backed legacy route retirement

Delete `/api/tools/coffee-chunks`, `/api/tools/roast-profiles`, `/api/tools/green-coffee-inv`, and `/api/tools/bean-tasting` after the first-party caller graph is closed and their canonical Parchment replacements are live. Reed explicitly accepted the immediate breaking-change risk for any unknown authenticated external caller on 2026-09-05; no time-based observation window is required. If a supported narrative-search consumer is later proven, plan a separately accepted provenance-aware Parchment knowledge-search contract; never restore `match_coffee_chunks` as a table-shaped proxy.

Deleting the legacy RAG route does not authorize deleting the shared provider credential while `/api/chat`, `/api/workspaces/[id]/summarize`, or `/api/memory/dream` still call it. Phase 3 removes the RAG route's credential consumption and direct RPC use; `OPENROUTER_API_KEY` remains until Phase 5C retires every remaining provider caller and production evidence verifies that none remain.

**Proof:** repository caller graph, explicit product-owner authorization for the hard cutover, production canaries for canonical replacements, structured catalog-chat regression, route-absence and direct-RPC guards, proof that the RAG route no longer consumes the provider credential, retention of `OPENROUTER_API_KEY` while the named provider callers remain active, removal of the shared credential only after Phase 5C retires all provider callers, and updated public documentation.

### Phase 4: Move durable application state behind Parchment

#### 4A. Parchment conversation-state and memory foundation

Make Parchment the runtime owner of workspaces/conversations, messages, canvas snapshots, summaries, and user memory. Reuse the existing shared database history rather than duplicating rows. Define canonical get-or-create, owner-scoped reads, idempotent message append, bounded history, canvas compare-and-set/update, clear/reset epoch, memory read/update, compaction inputs, archive/retention, and account-deletion semantics.

**Proof:** one canonical eligible workspace under concurrent creation, strict owner/RLS negatives, chronological latest-N history, stable `client_message_id` replay, overlap-prefix handling, monotonic fallback timestamps, bounded payloads, canvas optimistic concurrency, clear-chat atomicity, memory compare-and-set, archive/retention, and deletion-saga coverage.

#### 4B. Parchment OpenAPI/SDK application-state contract

Expose the minimum resource-shaped operations needed by the current web experience. Keep persistence and concurrency semantics explicit in OpenAPI and named SDK helpers. Summarization and memory compaction are Parchment operations, not raw table writes or client-provided trusted memory.

**Proof:** generated schema/helper drift checks, request/response validation, replay/conflict semantics, pagination limits, principal matrix, and production state lifecycle canaries.

#### 4C. Coffee-app workspace/message/canvas/memory cutover

Convert workspace, message, canvas, summary, memory, and dream routes into thin SDK adapters; convert chat SSR prefetch and canonical-workspace selection to SDK reads. Delete direct durable-state modules and database-derived state types. Preserve the current UI and client persistence protocol.

**Proof:** workspace readiness, reload/remount, message recovery, clear-chat behavior, active-scene/canvas persistence, memory edit/compaction, stop/retry, cross-account isolation, no silent persistence loss, no direct table access, and production browser canaries.

### Phase 5: Move AI orchestration and provider custody behind Parchment

#### 5A. Parchment streaming chat/agent runtime

Implement the active streaming runtime required by coffee-app. Parchment owns provider credentials, system policy, model-facing tool schemas, entitlement-shaped tool availability, canonical domain adapters, catalog filtering, sourcing enrichment, workspace/memory context resolution, prompt pruning, model/tool loops, summary and memory-compaction inference, and request-level limits. It emits typed stream events and proposal/display artifacts; confirmed mutations remain isolated behind Phase 3's execution contract.

Do not create a speculative second route solely because ADR-007 used both `/chat` and `/agent` as destination language. Add another public runtime entry point only for a proven caller with distinct semantics.

**Proof:** stream framing/versioning, session and API-key principal matrix where supported, cancellation/disconnect, backpressure, timeouts/retries, bounded tool rounds/calls, entitlement enforcement, server-resolved memory, action-proposal isolation, provider failure mapping, no confirmation bypass, and golden GenUI/display parity.

#### 5B. SDK streaming helper and production gate

Publish a typed streaming helper or typed raw-stream contract appropriate to the generated SDK. It must preserve browser credential custody through the BFF and expose stable event types without forcing coffee-app to know provider-specific frames.

**Proof:** SDK contract tests, partial-frame handling, abort propagation, protocol-version mismatch, production stream canary, and no provider detail or credential leakage.

#### 5C. Coffee-app chat thin-BFF cutover

Replace the local `/api/chat` model loop with a session-forwarding streaming adapter. Retain stream consumption, page context supplied as untrusted presentation context, GenUI/canvas rendering, proposal cards, confirmation UX, stop/retry controls, and display schemas. Delete OpenRouter credentials, local prompts, model-facing tools, provider adapters, domain scans, summary/dream inference, and orchestration policy.

**Proof:** all current chat journeys, page-context opt-in, workspace history/memory behavior, action proposal and confirmation, stop/retry/reconnect, stream error UX, mobile/desktop rendering, no provider credentials in coffee-app, and a source guard for orchestration/provider imports.

### Phase 6: Final contraction and terminal proof

#### 6A. Remove obsolete local backend surface

Remove the service-role Supabase client, unused shared database types, direct product-data modules, retired compatibility routes, orphaned environment variables, stale docs, and dependencies that no longer have an approved auth/presentation caller. Preserve the Supabase Auth client and minimal identity/session types only.

#### 6B. Compose the final source-boundary guard

Compose the resource-specific guards into one maintainable terminal rule. It must allow named Supabase Auth/session files and generic SDK/BFF adapters, and reject product `.from(...)`/`.rpc(...)`, service/admin clients, shared database-derived types, model-provider SDKs/credentials, local model-facing tool registries, and known retired resource identifiers outside fixtures/migrations owned elsewhere.

#### 6C. Run the terminal canary matrix

Verify current production revisions for Parchment, published SDK, CLI compatibility, and Vercel. Exercise anonymous demo/public catalog and analytics, authenticated member inventory/tasting/roast/sales/profit, Intelligence market/sourcing, sharing, confirmed chat actions, workspace/message/canvas/memory lifecycle, streaming chat, billing/subscription, API keys/usage, and account deletion evidence. Re-run the closed-world source audit on coffee-app `origin/main`.

The cutover is terminal only when the audit finds no non-auth direct Supabase product call, no locally owned reusable backend/domain or AI orchestration behavior, no provider credential, and no supported legacy route outside the documented thin-BFF surface.

## Cutover, rollback, and deletion policy

- Parchment changes are additive until their coffee-app consumers are stable in production.
- Consumer cutovers are hard cutovers per resource. There is no feature-flagged direct-database fallback and no dual write.
- A coffee-app rollback reverts only the consumer revision to its last SDK-backed predecessor where possible. It does not remove the additive Parchment contract or published SDK version.
- If a new consumer exposes contract insufficiency, stop deletion, correct Parchment/OpenAPI/SDK upstream, deploy/publish, and then resume the consumer. Do not patch shared truth back into coffee-app.
- Database privilege or object retirement occurs only after production evidence covers every supported web, CLI, SDK, operator, and external caller.

## Completion ledger

- [ ] Manual inventory batches use reserve/commit/status and preserve ambiguous operation identity.
- [ ] Market/analytics and sourcing matching contain no direct shared-data access or reusable domain truth.
- [ ] Inventory sharing is Parchment-authorized and contains no cross-principal database access.
- [ ] Roast writes, nested telemetry, batch operations, and milestone/operator behavior contain no direct product-table access.
- [ ] Confirmed chat actions use a typed Parchment execution ledger.
- [ ] Orphaned identity code and unsupported legacy routes are deleted or separately justified by proven callers.
- [ ] Workspaces, messages, canvas, summaries, and user memory use Parchment/SDK contracts.
- [ ] Streaming chat/model orchestration and provider credentials are Parchment-owned.
- [ ] Billing, account deletion, API-control-plane, sales, profit, tasting, and existing inventory contracts pass final regression canaries.
- [ ] Coffee-app retains only approved Supabase Auth/session plumbing, thin-BFF adapters, and presentation behavior.
- [ ] Resource guards and the final closed-world audit prevent boundary reintroduction.

## Explicit non-goals

- Removing or replacing Supabase Auth.
- Redesigning the coffee-app UI, chat UX, GenUI, canvas, or confirmation experience.
- Introducing MCP as part of this cutover.
- Moving shared logic into the CLI or importing CLI source into coffee-app.
- Publishing raw table-shaped endpoints or preserving direct-database fallbacks.
- Building Market Wire knowledge search merely to save the legacy RAG route.
- Re-platforming billing or account deletion again.
- Dropping shared database objects before cross-consumer and operator evidence is complete.
