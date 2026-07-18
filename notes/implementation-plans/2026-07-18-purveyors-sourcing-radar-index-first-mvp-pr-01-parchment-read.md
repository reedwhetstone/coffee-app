# Sourcing Radar MVP PR 1: Parchment Brief Radar Read

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `parchment-api`
**PR goal:** Add one read-only brief-to-index composition endpoint and SDK method, with freshness enforced by the API.

## Why this slice comes now

Saved brief ownership, criteria, deterministic matches, market signals, auth, entitlements, and SDK clients already exist. After the accepted publication reader cutover, Parchment has every primitive required to answer the pilot question without new persistence or scoring. Before estimating this PR, re-verify those primitives in `parchment-api` itself — the claim was audited from `coffee-app`, which computes brief matches locally, and the Parchment-side `/matches`, signal-serving, and entitlement primitives were not directly inspectable there.

This PR must not start until the active market publication contract is provenance-aware, fresh, and fail-closed. It remains independently useful to API consumers if coffee-app never adds a reference-client route.

## In scope

- `GET /v1/procurement/briefs/{id}/radar`.
- One SDK method and exported response types.
- Apply owned brief criteria before pagination.
- Intersect matching IDs with eligible `price_drop` and `below_market` rows from the accepted active publication.
- Order by strongest existing signal rank, then stable catalog ID.
- Return the brief, current match total, indexed rows, all applicable signal evidence, source URL, match reasons, publication identity, methodology, quality/coverage, `marketAsOf`, `computedAt`, age/status, freshness threshold, limitations, and cursor metadata.
- Lot-age context on every indexed row: crop year and/or first-observed/arrival date where the catalog has them, plus an explicit `ageContext: known | unknown` disclosure where it does not. A price drop without age context is not interpretable as value.
- `fresh | stale | unavailable` response states.
- Existing Parchment Intelligence entitlement, ownership, rate-limit, and error-envelope behavior.
- OpenAPI, SDK fixtures, and focused tests.

## Out of scope

- New tables, stored runs, cron, queues, notifications, or write endpoints.
- New signal computation, combined Radar score, LLM output, or client-specific ranking.
- `value_quality`, new-arrival, restock, delist, or newly matching events.
- Scraper/publication implementation.
- CLI commands, web UI, pricing, or entitlement changes.

## Contract invariants

- Brief criteria and ownership are resolved through the canonical procurement resource.
- Filtering and signal intersection happen before cursor pagination. The endpoint cannot fetch one matches page and filter it afterward.
- Indexed rows come only from the accepted active publication. Legacy “latest available” rows are not silently eligible.
- `stale` and `unavailable` responses contain zero indexed rows. They may include the current plain-match count and explicit limitations.
- The maximum accepted age is server-configured and disclosed. Clients do not recompute it.
- Signal fields and ranks are preserved verbatim. If a lot has both eligible signal types, the response retains both and orders by the strongest rank.
- Every indexed row carries lot-age context or an explicit `ageContext: unknown` disclosure. The API never labels a row an "opportunity" or "deal"; response vocabulary is anomaly/evidence-oriented.
- Supplier-stated score fields and `value_quality` are absent from the MVP contract.

## Likely files

- `packages/api/src/procurement/briefs.ts`
- `packages/api/src/routes/procurement.ts`
- a focused Radar resource/helper beside procurement or Market Index code
- route/resource tests under `packages/api/test/`
- OpenAPI/docs source
- `packages/sdk/src/client.ts`, exported types, and SDK tests
- package version/changelog files required by repository release policy

## Acceptance criteria

- An entitled owner can retrieve a deterministic Radar result for an active brief.
- Another user receives not-found/ownership-safe behavior consistent with existing brief routes.
- Anonymous and insufficiently entitled callers cannot bypass access through the direct URL.
- A fixture with eligible signals proves criteria are applied before pagination and ordering is stable.
- Fresh fixtures return evidence; stale, unavailable, low-quality, and missing-publication fixtures return no indexed rows.
- The response discloses publication identity, method, quality/coverage, timestamps, age/status, threshold, and limitations.
- A fixture with missing crop/arrival data returns `ageContext: unknown` rather than omitting the field or implying freshness.
- OpenAPI and SDK types match the runtime response.
- Existing `/matches` and Market Index responses do not change.

## Test plan

- Focused resource tests for match intersection, duplicate signal types, ordering, and cursors.
- Route tests for ownership, entitlements, rate-limit headers, invalid IDs, and status mapping.
- Adversarial tests proving stale legacy/latest rows cannot appear as fresh.
- SDK request/response fixture and type tests.
- Repository typecheck, unit suite for affected packages, build, lint, and docs validation per repository scripts.

## Risks and rollback

- **Risk:** a join after pagination hides stronger rows. Test the pre-pagination query boundary explicitly.
- **Risk:** “price signal” reads as “buy.” Keep response vocabulary evidence-oriented and return limitations.
- **Risk:** the signal surfaces past-crop clearance as value — importers discount aging lots to move them, so `price_drop`/`below_market` preferentially select old inventory. The lot-age context fields exist to make this interpretable; test that rows without age data disclose `unknown`.
- **Risk:** freshness logic forks from publication policy. Consume the canonical serving status rather than derive a second policy.
- **Rollback:** disable/remove the additive route and SDK method. Existing procurement matches and market reads remain unchanged.

## Exact follow-on dependency

PR 2 may begin after this contract is deployed to staging, its fresh/stale fixtures are stable, and one live owned brief has been reconciled manually against source and publication evidence.
