# Market Index Decision Surface — Backend & API Build Plan

**Date:** 2026-07-05
**Author:** OpenClaw (audit + build plan for Reed)
**Source of truth:** `notes/implementation-plans/market-index-decision-surface-plan.md` (PR #437, merged) + ADR-008
**Scope:** Backend + API infrastructure only (data model, computation job, backfill, `/v1` endpoints, CLI wrappers). Frontend (WP-3 coffee-app `/analytics` UI, chat/GenUI adapters) is handed to the designer/frontend dev and is out of scope here.

This is the execution plan Reed asked me to implement. It keeps the PR #437 **contracts** (§3 shared contracts, signal math, entitlement matrix) intact, but **re-routes the work packages to where the code actually lives** after auditing the four repos.

---

## 1. Audit findings (what I verified against the repos)

I read PR #437's plan, ADR-008, and the real code in `coffee-app`, `parchment-api`, `coffee-scraper`, and `purveyors-cli`. The contract layer is strong and internally consistent. Three findings change the build shape; five are smaller flags.

### F1 — The "daily job" and table DDL do NOT live in parchment-api (biggest)

The plan (§4) hands "two tables, one daily job + backfill" to a **parchment-api** agent. Reality:

- **Analytics DDL lives in `coffee-app/supabase/migrations/`.** `coffee_price_snapshots` and `price_index_snapshots` are defined in `coffee-app/supabase/migrations/20260321_price_snapshots.sql`. parchment-api has only app-level RPC SQL (`packages/api/sql/0001..0003`, mutation-audit/roast-write/artisan-import) — **no analytics schema, no migrations dir.**
- **The "daily job" is a Postgres function invoked by the scraper.** `compute_price_index(p_date date)` is plpgsql (same migration, line 186). It is called as an RPC from the **coffee-scraper** pipeline: `coffee-scraper/scrape/index.ts:66` registers `{ name: "Price Index", rpc: "compute_price_index" }`, and `scrape/utils/priceIndexHealth.ts:209` calls `client.rpc("compute_price_index", { p_date })`. parchment-api is a **read-only Hono API on Render with no scheduler.**

**Consequence:** computation (DDL + job + backfill) belongs in **coffee-app/supabase + coffee-scraper**, not parchment-api. parchment-api's real deliverable is the **three read endpoints** over the precomputed tables. WP-1 must be split across repos.

### F2 — The §3.6 response envelope does not match the parchment-api house style

§3.6 invents top-level `as_of` / `computed_at` / `thresholds` and **cursor pagination** (`limit`, `next_cursor`). The real house style (`routes/priceIndex.ts`, `priceIndex/resource.ts`) is:

```
{ data: [...],
  pagination: { page, limit, total, totalPages, hasNext, hasPrev },   // page-based, no cursor
  meta: { resource, namespace, version, auth, filters, access, source } }
```

Error envelope `{ error: { code, message } }` DOES match (`routes/errors.ts`). **Recommendation:** keep the house envelope for consistency with `/v1/price-index` and the SDK; nest `as_of`/`computed_at`/`thresholds` under `meta`; use page pagination, not cursor. (Decision D1.)

### F3 — `/v1/price-index/stats` is specced as compute-on-read; that fights the REST data path

Signals and metadata are precomputed into tables (good). But §4.5 says stats must be computed **per request from raw `coffee_price_snapshots`** (baseline windows, matched-lot moves, percentiles). parchment-api talks to Supabase via **service-role REST** (`supabase-js`; direct DB is IPv6-only and unreachable from our infra per TOOLS.md). Heavy multi-date window aggregation over REST per request is slow and awkward.
**Recommendation:** precompute a `price_index_move_stats` table via a `compute_price_move_stats()` RPC (same pattern as signals/metadata), and make the endpoint a thin reader. This keeps all three endpoints consistent and cheap. (Decision D2.)

### Smaller flags

- **F4 — Existing `/v1/price-index` is API-key + ppiAccess only** (bearer; `requireApiKeyPpiAccess`). The auth model _does_ support `anonymous | session | api-key` principals with `ppiAccess`/`apiPlan` (`auth/types.ts`), and `app.ts` sets `c.get("principal")` globally, so the fuller matrix is feasible with `AuthorizationError` (401 anon / 403 entitled). But the **anonymous `?summary=true` teaser and public metadata slice are new behaviors** not present on any existing endpoint. Confirm whether anon/session principals actually resolve on parchment-api in prod, or whether coffee-app should proxy the public slices through its own server (it already proxies price-index via `src/lib/server/priceIndexProxy.ts`). (Decision D3.)
- **F5 — Premium-table RLS must be service-role-read-only.** `coffee_price_snapshots` has `Public read` RLS + `GRANT SELECT ... TO anon`. The new `market_signals` / `metadata_index_snapshots` carry premium leverage; they must be **service-role read only** (no anon/authenticated grant) so entitlement is enforced only in the API layer and RLS can't leak. (Decision D4.)
- **F6 — `/v1/price-index/stats` overlaps existing `/v1/price-index` and CLI `purvey price-index`.** Different purpose (movement significance vs raw aggregate rows), but the naming collision is a UX/discoverability wart. Consider `purvey market stats` aliasing/deferring to the existing price-index command family. (Decision D5.)
- **F7 — `catalog_id` FK type.** `market_signals.catalog_id integer REFERENCES coffee_catalog(id)` is consistent with `coffee_price_snapshots.catalog_id`; no change needed.
- **F8 — Idempotency + backfill grain.** The plan already gets this right (delete-and-rewrite per date/period, metadata grain = period not date). Enforce it in the RPCs.

---

## 2. Corrected work breakdown (by repo)

| Package                       | Repo                | Deliverable                                                                                                |
| ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| **B-1 Schema**                | coffee-app/supabase | `market_signals`, `metadata_index_snapshots`, (recommended) `price_index_move_stats` + RLS/grants          |
| **B-2 Compute RPCs**          | coffee-app/supabase | `compute_market_signals()`, `compute_metadata_index()`, `compute_price_move_stats()` plpgsql fns           |
| **B-3 Job wiring + backfill** | coffee-scraper      | register RPCs in `scrape/index.ts` after Price Index step; health checks; one-off metadata backfill script |
| **B-4 API endpoints**         | parchment-api       | 3 `/v1` routes + resources + entitlement guards + SDK schema + OpenAPI + tests                             |
| **B-5 CLI**                   | purveyors-cli       | `purvey market` group + `src/lib/market.ts` exports + manifest + tests + minor version bump                |
| WP-3 (out of scope)           | coffee-app          | `/analytics` UI, chat/GenUI adapters, docs pages → designer/frontend dev                                   |

Integration order: **B-1 → B-2 → B-3 (verify staging data) → B-4 → B-5**. B-4 and B-5 can overlap once B-3 has data in staging.

---

## 3. B-1 — Schema (coffee-app/supabase/migrations)

Mirror `20260321_price_snapshots.sql` conventions (IF NOT EXISTS, COMMENTs, RLS block, grants). One migration file per table is fine; group is acceptable.

- **`market_signals`** — DDL exactly as §4.1 (identity PK, `signal_type`/`signal_window` CHECKs, `catalog_id` FK, denormalized `origin`/`process`/`market`/`source`/`score_value`/`current_price_lb`, `rank_score`, `evidence jsonb`, `uq_market_signal` unique key, two indexes). Add `rank_score_input` + `rank_signal_magnitude` columns (or keep them inside `evidence` and project in the endpoint — decide in B-2; plan requires exposing them in the response).
- **`metadata_index_snapshots`** — DDL exactly as §4.2, including the **expression unique index** `uq_metadata_index ON (period_start, grain, COALESCE(origin,''), market, dimension, bucket)` (table-level UNIQUE can't span COALESCE).
- **`price_index_move_stats`** (recommended, pending D2) — one row per `(snapshot_date, origin|NULL, process|NULL, market, window, baseline_weeks)` carrying `latest_move_pct`, `baseline_mean_move_pct`, `baseline_stddev`, `z_score`, `move_percentile`, `weeks_since_larger_move`, `classification`, `matched_lot_move_pct`, `matched_lot_count`, `move_driver`, `sample_size`, `supplier_count`, `available_baseline_weeks`, `note`. Expression unique index over the COALESCE'd origin/process tuple.
- **RLS/grants (F5):** `ENABLE ROW LEVEL SECURITY`; service-role write **and** read policies only; **no** `GRANT SELECT ... TO anon, authenticated`. Premium gating lives entirely in the API layer.

## 4. B-2 — Compute RPCs (coffee-app/supabase/migrations)

Plpgsql functions mirroring `compute_price_index(p_date)`: read snapshots, join `coffee_catalog`, write the precompute tables, **idempotent delete-and-rewrite** per date/period. All heavy math (trailing medians, p25, z-scores, percentiles, matched-lot moves) lives here — parchment-api stays thin (reinforces F1/F3).

1. **`compute_market_signals(p_date date)`** — implements §3.2 signal math + §3.3 evidence + §3.5/§4.1 emission rules:
   - `price_drop`: per-lot trailing 7d/30d medians from `coffee_price_snapshots`; emit one row per qualifying window (`signal_window` distinct rows).
   - `below_market`: segment p25 benchmark from stocked-lot join; requires ≥5 lots / ≥3 suppliers; **suppress when `country IS NULL`.**
   - `value_quality`: `score_value/cost_lb` z-score vs **per-origin+market** baseline (retail/wholesale never pooled); scored-baseline floor (≥5 scored lots/≥3 suppliers, ≥2 distinct positive ratios, stddev>0), else no row.
   - Coalesce process → `undisclosed`; denormalize origin/source as-is (NULL allowed, must not abort the pass). Compute `rank_score` per §4.1 (`rank_input * (1 + greatest(coalesce(score_value,84)-84,0)/10)`), expose `rank_score_input` + `rank_signal_magnitude`.
2. **`compute_metadata_index(p_date date)`** — recompute the week+month periods containing `p_date` for dimensions `process|disclosure|score`; mean-of-daily-shares aggregation; `undisclosed` bucket explicit; suppress origin-level rows `lot_count < 5`; market-wide rows always written; idempotent on `uq_metadata_index`.
3. **`compute_price_move_stats(p_date date, p_baseline_weeks int default 12)`** (pending D2) — segment + market-wide move stats from raw snapshots per §4.5, absolute-magnitude percentile/classification, matched-lot `move_driver`, `insufficient_baseline_history` handling.
4. **Backfill entry** — `compute_metadata_index` must be safe to call for any historical period (delete-and-rewrite), enabling the B-3 backfill to 2026-03-21. Signals are **not** backfilled.

## 5. B-3 — Job wiring + backfill (coffee-scraper)

- **Wire RPCs into `scrape/index.ts`** after the existing `"Price Index"` step: add `compute_market_signals`, `compute_metadata_index`, and (D2) `compute_price_move_stats` steps, each with the same `client.rpc(...)` + health-gate pattern as `priceIndexHealth.ts`. The scraper run **is** the daily job (F1).
- **Health checks** mirroring `priceIndexHealth.ts`: assert signals exist for the latest date and metadata rows cover the current period.
- **Backfill script** (one-off, TS) modeled on `coffee-app/scripts/backfill-supply-index.ts`: derive distinct week/month periods from snapshot dates since 2026-03-21, call `compute_metadata_index` per period idempotently. Not every date — grain is period/bucket.

## 6. B-4 — API endpoints (parchment-api)

For each endpoint: a `routes/*.ts` (zod `createRoute` + response schema, mirroring `routes/priceIndex.ts`) and a `src/market/*.ts` resource (`build*`, mirroring `priceIndex/resource.ts`), registered in `app.ts` via `app.openapi(...)`.

- **`GET /v1/market/signals`**, **`GET /v1/price-index/stats`**, **`GET /v1/market/metadata-index`** — params, response fields, and error semantics per §4.4/§4.5/§4.6, but with the **house envelope** (F2/D1): `{ data, pagination, meta }`, `as_of`/`computed_at`/`thresholds` under `meta`.
- **Entitlement guards** in `auth/authorize.ts`, reusing `AuthorizationError` (401 anon / 403 entitled) and `ppiAccess`. New helpers: `requireMarketIntelligence(principal)` for full access; explicit **public-summary** (`?summary=true` unfiltered counts) and **public-metadata-slice** (`dimension=process` + no origin + `market=retail` + `grain=month`) allow-list bypasses. Gated filters combined with `summary=true` by a non-`ppiAccess` caller → deny (401/403 per matrix), do not return filtered counts.
- **Resources are thin readers** of the precompute tables (no computation). `market=all` = union of stored retail/wholesale rows, no synthesized signal.
- **SDK + OpenAPI + docs:** extend `packages/sdk` schema, register OpenAPI, add the entitlement matrix + threshold semantics to docs.
- **Tests (the crux):** entitlement matrix incl. **direct-URL bypass** and `catalog:read` API key **without** `ppiAccess`; summary mode leaks no lot fields and rejects gated filters; benchmark/scored-baseline floors suppress thin segments; missing-origin lots emit `price_drop` but never `below_market`/`value_quality`; evidence shape is exactly §3.3 (nulls present); `rank_score*` non-null and ordered by intended input; absolute-magnitude classification symmetry; public metadata slice exact-tuple match only; backfill idempotency on `uq_metadata_index`.

## 7. B-5 — CLI (purveyors-cli)

- **`src/commands/market.ts`** — `signals | stats | metadata` subcommands per §5.1 (variadic `--type <t...>` collector; `--json` verbatim passthrough). Thin wrappers only (PADR-0011) — no computation.
- **`src/lib/market.ts`** — typed exports `marketSignals`, `marketSignalsSummary`, `marketStats`, `marketMetadataIndex` mirroring `src/lib/catalog.ts`; TS types for the §3.3 evidence object and §3.4 enums (names identical to API).
- **Manifest** (`src/lib/manifest.ts` / `src/commands/manifest.ts`): register the three commands with arg schemas, auth, output-mode notes.
- **Tests:** arg validation, 401/403 envelope handling, `--json` passthrough fidelity, unfiltered summary unauthenticated, filtered summary 403 without entitlement, metadata `--market` passthrough incl. denial of unauthenticated `--market all|wholesale`, recorded-fixture per endpoint.
- **Release:** minor version bump; include in the PR (per TOOLS.md CLI release process); coffee-app consumes via `@purveyors/cli` dep bump in WP-3.
- **F6 note:** flag the `purvey market stats` vs existing `purvey price-index` overlap to Reed before finalizing command names.

---

## 8. Open decisions for Reed (blocking before I start)

- **D1 — Response envelope:** adopt the parchment-api house `data/pagination/meta` style (recommended) vs PR #437's `as_of`/cursor style? _Recommend house style._
- **D2 — Stats endpoint:** precompute `price_index_move_stats` via RPC (recommended, consistent + cheap over REST) vs compute-on-read as §4.5 literally specs?
- **D3 — Public teasers:** does parchment-api serve anon `?summary=true` + the public metadata slice directly, or does coffee-app proxy them (as it already proxies `/v1/price-index`)? _Recommend coffee-app proxies public slices; parchment-api still enforces._
- **D4 — Premium RLS:** confirm `market_signals`/`metadata_index_snapshots` are **service-role read only** (no anon grant). _Recommend yes._
- **D5 — CLI naming:** `purvey market stats` vs existing `purvey price-index` overlap — keep both, alias, or rename?

Default if Reed doesn't weigh in: D1 house style, D2 precompute, D3 coffee-app proxy for public, D4 service-role-only, D5 keep both with a cross-reference in help text.

---

## 9. Persistence note

This doc is **local/unpushed** in `coffee-app` (a PR-gated product repo). It is a working build plan, not yet a PR. Say the word and I open a docs PR alongside the first implementation slice, or keep iterating locally.
