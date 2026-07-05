# Market Index Decision Surface — Implementation Plan & Handoff Spec

**Date:** 2026-07-05 (expanded for multi-repo handoff)
**Status:** Approved direction (ADR-008); ready for work-package handoff
**Implements:** ADR-008 (actionable insight, value signals, metadata index)
**Constraints:** ADR-003/005 (access levels), ADR-006 + parchment-api PADR-0011 (CLI owns portable tool surface, API owns proprietary behavior), ADR-007 (Parchment API owns intelligence computation; coffee-app is a reference client)

This document is written to be **handed off in pieces**. Each work package (WP) is self-contained: an implementing agent should be able to build its package from its section plus the Shared Contracts section, without reading the others.

- **WP-1 — parchment-api** (private repo): three endpoints, two tables, one daily job + backfill. §"WP-1".
- **WP-2 — @purveyors/cli**: `purvey market` command group + exported library functions. §"WP-2".
- **WP-3 — coffee-app** (this repo): Market Index UI chapters, chat/GenUI tools, docs. §"WP-3".

Integration order: WP-1 first (contracts live in staging), then WP-2 and WP-3 in parallel against staging.

---

## 1. Product goal (context for all packages)

Evolve the Market Index (`/analytics`) from a dashboard of market data into a **decision surface** organized around three insight families (ADR-008):

| Family              | Question it answers                        | v1 modules                                                                |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| **Value signals**   | "What should I consider buying right now?" | Newly discounted lots; lots priced below their market; value-for-quality  |
| **Market movement** | "What changed, and is it signal or noise?" | Significance framing of index moves; repricing vs mix-shift decomposition |
| **Metadata trends** | "How is the market itself changing?"       | Process-mix trend; disclosure-level trend; score-distribution trend       |

Non-negotiable product rules (apply to every package):

1. Every module/command/card answers a stakeholder question; evidence is always machine-readable and human-legible (no unexplained scores — PRODUCT_VISION).
2. Significance is **segment-level** (origin × process), never per-coffee: lots churn too fast for long baselines; the index series persists through basket turnover. Lot-level history is only used on short windows (7d/30d) inside value signals.
3. Access follows ADR-005: signal feeds and deep trends are Intelligence/paid-API leverage; anonymous surfaces get proof (counts, one designated public chart), never lot identity.
4. Cultivar/drying-method dimensions are **out of scope for v1** (await ADR-005 taxonomy normalization). Null metadata is reported as `undisclosed`, never silently dropped.
5. Do not market the "metadata index" anywhere until the first metadata module ships (ADR-008 rule 5).

## 2. Data foundation (already exists — no new collection)

All computation derives from existing Supabase tables (see `supabase/migrations/20260321_price_snapshots.sql` and `supabase/schema.sql`):

| Table                    | Grain                                                               | Key columns                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coffee_price_snapshots` | one row per (catalog_id, snapshot_date); history since 2026-03-21   | `cost_lb` (retail 1-lb price), `price_tiers` jsonb, `stocked`, `wholesale`                                                                                                                    |
| `price_index_snapshots`  | one row per (snapshot_date, origin, process, grade, wholesale_only) | `price_min/max/avg/median`, `supplier_count`, `sample_size`                                                                                                                                   |
| `coffee_catalog`         | current state per lot                                               | `processing_base_method`, `processing_disclosure_level`, `cultivar_detail`, `drying_method`, `grade`, `score_value`, `source`, `country`, `continent`, `stocked`, `cost_lb`, elevation fields |

Reconstruction trick used throughout: joining `coffee_price_snapshots` (which lots were stocked on a date) to `coffee_catalog` metadata yields **historical market composition**, enabling full backfill of the metadata index from 2026-03-21.

---

## 3. Shared Contracts (read by every work package)

### 3.1 Segments

A **segment** is `(origin, process, market)` where `origin` is the normalized country (`price_index_snapshots.origin`), `process` is the normalized process or `null` (= all processes), and `market` is `retail | wholesale | all` (mapping to `wholesale_only` semantics already used by `/v1/price-index`).

### 3.2 Signal types

```
price_drop     — lot's current cost_lb is >= drop_threshold_pct below its own trailing
                 median over `window` (7d|30d), computed from coffee_price_snapshots
below_market   — stocked lot's cost_lb < p25 of its segment's benchmark distribution
                 for the latest snapshot_date (benchmark = distribution of current
                 stocked-lot prices in the segment; price_index_snapshots supplies
                 median/min/max, p25 computed in the job)
value_quality  — lot's (score_value / cost_lb) is >= value_z_threshold standard
                 deviations above its origin's mean among scored, stocked lots
```

Defaults (configurable server-side, reported in responses): `drop_threshold_pct = 8`, `value_z_threshold = 1.5`, benchmark floor = segment must have ≥ 5 stocked lots from ≥ 3 suppliers or no signal is emitted.

### 3.3 Evidence object (attached to every signal)

```json
{
	"segment": { "origin": "Ethiopia", "process": "Washed", "market": "retail" },
	"segment_median": 7.85,
	"segment_p25": 6.9,
	"discount_vs_median_pct": -21.0,
	"price_percentile_in_segment": 12,
	"own_trailing_median_30d": 7.1,
	"drop_vs_own_median_pct": -12.7,
	"score_value": 87.5,
	"as_of": "2026-07-05"
}
```

Fields irrelevant to a signal type are `null`, never omitted (stable shape for agents). Web cards, CLI output, and chat tools must all render from this object — no surface computes its own evidence.

### 3.4 Movement classification

`classification`: `quiet | normal | notable | exceptional`, derived from `move_percentile` of the latest move within the trailing baseline distribution (defaults: <40 quiet, 40–84 normal, 85–96 notable, ≥97 exceptional). Thresholds are returned in the response envelope so no client hardcodes them.

`move_driver`: `repricing | mix_shift | mixed | insufficient_overlap`, derived from comparing the raw index move to the matched-lot move (lots present at both baseline and latest date): |raw − matched| ≤ 1.0 pt → `repricing`-dominant classification with matched sign; matched ≈ 0 and raw large → `mix_shift`; otherwise `mixed`; matched_lot_count < 8 → `insufficient_overlap`.

### 3.5 Entitlement matrix

| Caller                                        | `/v1/market/signals`                       | `/v1/price-index/stats`                             | `/v1/market/metadata-index`                                                             |
| --------------------------------------------- | ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Anonymous / Viewer (session, no PPI)          | 403; `?summary=true` allowed (counts only) | market-wide summary row only (public read headline) | 403 except the designated public slice: `dimension=process`, market-wide, `grain=month` |
| Parchment Intelligence (ppiAccess)            | full                                       | full                                                | full                                                                                    |
| API key: Green                                | 403 (`?summary=true` allowed)              | market-wide summary only                            | public slice only                                                                       |
| API key: Origin / Enterprise (`catalog:read`) | full                                       | full                                                | full                                                                                    |
| Admin                                         | full                                       | full                                                | full                                                                                    |

Server-side enforcement per ADR-005: deny gated params at the boundary; 401 unauthenticated where auth is required, 403 for insufficient entitlement; no premium metadata in denied responses. Include tests proving direct calls cannot bypass gates.

### 3.6 Response envelope conventions (parchment-api house style)

Every 200 response includes `as_of` (snapshot date used), `computed_at` (job timestamp), `thresholds` (the config actually applied), and pagination (`limit`, `next_cursor`) where applicable. API-key calls include `X-RateLimit-*` headers. Errors use the existing `/v1` error envelope (`{ error: { code, message } }`).

---

## 4. WP-1 — parchment-api (hand off to parchment-api agent)

Deliverables: two tables, one daily job (+ backfill script), three endpoints, docs, tests. Follow existing `/v1` route, auth, entitlement, and rate-limit middleware conventions in the repo.

### 4.1 Table: `market_signals` (new)

One row per active signal per day. Written by the daily job; endpoint 1 is a filtered read of the latest day.

```sql
CREATE TABLE market_signals (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date   date    NOT NULL,
  signal_type     text    NOT NULL CHECK (signal_type IN ('price_drop','below_market','value_quality')),
  signal_window   text    NOT NULL DEFAULT 'n/a' CHECK (signal_window IN ('7d','30d','n/a')),
  catalog_id      integer NOT NULL REFERENCES coffee_catalog(id) ON DELETE CASCADE,
  -- denormalized for filtering without a join
  origin          text,                    -- nullable: coffee_catalog.origin may be null
  process         text,
  market          text    NOT NULL CHECK (market IN ('retail','wholesale')),
  source          text,                    -- nullable: coffee_catalog.source is nullable (schema.sql:74)
  score_value     numeric,
  current_price_lb numeric(10,2) NOT NULL,
  rank_score      numeric NOT NULL,        -- ordering key: magnitude x quality prior
  evidence        jsonb   NOT NULL,        -- §3.3 shape, exactly
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_market_signal UNIQUE (snapshot_date, signal_type, signal_window, catalog_id, market)
);
CREATE INDEX idx_market_signals_date_type ON market_signals (snapshot_date DESC, signal_type);
CREATE INDEX idx_market_signals_origin ON market_signals (snapshot_date DESC, origin);
```

`signal_window` carries the trailing window a `price_drop` row was computed against (`7d` or `30d`); a single lot may qualify in one window but not the other, or carry different trailing medians per window, so both are stored as distinct rows and `/v1/market/signals?type=price_drop&window=7d|30d` filters on this column. `below_market` and `value_quality` are window-agnostic and use `n/a`. Keeping the column `NOT NULL` (with an `n/a` sentinel rather than NULL) keeps it usable inside the unique key without NULL-distinctness surprises.

`origin` and `source` are nullable because their `coffee_catalog` sources are nullable; the signals job denormalizes whatever is present (including NULL) rather than forcing a `NOT NULL` insert that would abort the daily pass on a lot with a missing origin/source. Filter on `origin IS NOT NULL` / `source IS NOT NULL` at query time where a non-null value is required.

`rank_score` recommendation: `abs(primary_discount_pct) * (1 + coalesce(score_value - 84, 0) / 10)` — magnitude weighted by quality above a specialty floor. Document whatever is shipped.

### 4.2 Table: `metadata_index_snapshots` (new)

One row per (period, origin-or-market-wide, dimension, bucket). Mirrors the `price_index_snapshots` pattern.

```sql
CREATE TABLE metadata_index_snapshots (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_start   date  NOT NULL,           -- week (Monday) or month (1st)
  grain          text  NOT NULL CHECK (grain IN ('week','month')),
  origin         text,                     -- NULL = market-wide
  market         text  NOT NULL CHECK (market IN ('retail','wholesale','all')),
  dimension      text  NOT NULL CHECK (dimension IN ('process','disclosure','score')),
  bucket         text  NOT NULL,           -- e.g. 'Washed', 'label_only', 'p50'
  lot_count      integer NOT NULL,
  share          numeric,                  -- NULL for dimension='score'
  stat_value     numeric,                  -- NULL except dimension='score' (bucket p25|p50|p75 -> value)
  supplier_count integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Table-level UNIQUE constraints cannot span expressions like COALESCE(origin,''),
-- so the market-wide (origin IS NULL) vs origin-level uniqueness is enforced by an
-- expression unique index instead (equivalent to UNIQUE NULLS NOT DISTINCT on PG15+).
CREATE UNIQUE INDEX uq_metadata_index
  ON metadata_index_snapshots (period_start, grain, COALESCE(origin,''), market, dimension, bucket);
```

Bucket rules: `process` buckets are normalized `processing_base_method` values plus `undisclosed` (null); `disclosure` buckets are the five ADR-004 levels plus `undisclosed`; `score` buckets are exactly `p25|p50|p75` with `stat_value` carrying the price-free score statistic and `lot_count` the scored-lot count. Suppress (do not write) origin-level rows where `lot_count < 5`; market-wide rows always written.

### 4.3 Daily job + backfill

Extend the existing daily aggregation entrypoint (same scheduling as `compute_price_index()`):

1. **Signals pass** — for the latest `snapshot_date`: compute per-lot trailing medians (7d/30d) from `coffee_price_snapshots`; compute per-segment current-price distributions (p25/median) across stocked lots; emit `market_signals` rows per §3.2 rules with §3.3 evidence. Emit `price_drop` rows once per qualifying `signal_window` (`7d` and/or `30d` independently — a lot that qualifies in both produces two rows carrying that window's median/discount); `below_market` and `value_quality` emit a single `signal_window='n/a'` row. Denormalize `origin`/`source` as-is (may be NULL); do not drop or fail a signal for a missing origin/source. Idempotent per (date): delete-and-rewrite the day's rows or upsert on the unique key (`snapshot_date, signal_type, signal_window, catalog_id, market`).
2. **Metadata pass** — for the period containing `snapshot_date`: recompute the current week and month rows by joining stocked `coffee_price_snapshots` rows for each date in the period to `coffee_catalog` metadata, then averaging daily composition across the period (document the chosen aggregation: mean of daily shares is acceptable; state it in the endpoint docs).
3. **Backfill script** — one-off: iterate all snapshot dates since 2026-03-21 to populate `metadata_index_snapshots` history. Signals are _not_ backfilled (they are a live feed; historical signals have no product use in v1).

Caveat to document: the metadata join uses **current** catalog metadata against historical stocked state; if a lot's metadata was edited after the fact, history reflects the corrected metadata. Acceptable for v1; note it in API docs.

### 4.4 Endpoint 1: `GET /v1/market/signals`

- **Auth/entitlement:** §3.5. `?summary=true` bypasses the gate and returns `{ as_of, total, by_type: { price_drop: n, below_market: n, value_quality: n } }` only.
- **Params:** `type` (repeatable; default all three), `origin`, `process`, `market` (`retail|wholesale|all`, default `retail`), `min_discount_pct` (number), `min_score` (number), `window` (`7d|30d`, default `30d`; affects `price_drop` only), `limit` (default 20, max 100), `cursor`.
- **Response:** envelope (§3.6) + `signals: [...]`, each item: `signal_type`, `signal_window` (`7d`/`30d` for `price_drop`, else `n/a`), `catalog_id`, `name`, `source`, `origin`, `process`, `market`, `score_value`, `current_price_lb`, `rank_score`, `evidence` (§3.3), `catalog_url` (`https://purveyors.io/catalog?...` deep link). Sorted by `rank_score` desc. The `window` param filters `price_drop` items to the matching `signal_window`.
- **Errors:** 400 invalid params (unknown type, bad window), 401/403 per matrix, 404 never (empty list is `signals: []`).
- **Tests:** entitlement matrix coverage incl. direct-URL bypass attempts; summary mode leaks no lot fields; benchmark floor suppresses thin segments; evidence shape is exactly §3.3 (nulls present).

### 4.5 Endpoint 2: `GET /v1/price-index/stats`

- **Auth/entitlement:** §3.5 — market-wide summary (no `origin`/`process` params) is public; segment queries require Intelligence/Origin+.
- **Params:** `origin`, `process`, `market` (default `retail`), `window` (`7d|30d`, default `7d`), `baseline_weeks` (default 26, max 52).
- **Grain:** segment-level only (§1 rule 2). No per-coffee mode.
- **Response per segment:** `segment`, `latest_move_pct`, `baseline_mean_move_pct`, `baseline_stddev`, `z_score`, `move_percentile`, `weeks_since_larger_move`, `classification` (§3.4), `matched_lot_move_pct`, `matched_lot_count`, `move_driver` (§3.4), `sample_size`, `supplier_count`, plus envelope with `thresholds`.
- **Computation:** moves computed on `price_median` of `price_index_snapshots` between `snapshot_date` and `snapshot_date - window`; baseline = distribution of same-window moves over trailing `baseline_weeks`; matched-lot move = median of per-lot `cost_lb` change among `coffee_price_snapshots` rows stocked at both endpoints of the window. Cache aggressively (daily data → daily cache key).
- **Tests:** classification thresholds respected and returned; `insufficient_overlap` at `matched_lot_count < 8`; public callers can hit market-wide but not segment queries; short-history segments (< baseline) return `classification: null` with an explanatory `note` field rather than fabricated stats.

### 4.6 Endpoint 3: `GET /v1/market/metadata-index`

- **Auth/entitlement:** §3.5 — public slice is exactly `dimension=process` + no `origin` + `grain=month`; everything else gated.
- **Params:** `dimension` (`process|disclosure|score`), `origin` (optional), `market` (default `retail`), `grain` (`week|month`, default `month`), `from`/`to` (ISO dates, default full history).
- **Response:** envelope + `series: [{ period, lot_count, supplier_count, buckets: [{ key, share, count }] }]`; for `dimension=score`, buckets are `[{ key: "p25"|"p50"|"p75", value, count }]`. Include `undisclosed` bucket explicitly.
- **Errors:** 400 for `dimension` values not yet supported (`cultivar`, `drying`) with message "awaiting taxonomy normalization" — reserve the values, reject them explicitly.
- **Tests:** entitlement slice boundaries (public slice exact-match only); suppression floor honored; `undisclosed` never dropped; backfilled history returns from 2026-03-21.

### 4.7 Docs

Add all three endpoints to the parchment-api OpenAPI/docs source, with the entitlement matrix and threshold semantics. coffee-app mirrors into `/docs/api/*` (WP-3).

---

## 5. WP-2 — @purveyors/cli (hand off to CLI agent)

Deliverables: a `market` command group, exported library functions, manifest registration, tests. Follow existing CLI conventions: commander-based commands in `src/commands/`, shared client in `src/lib/`, structured stdout (data) vs stderr (diagnostics), `--json` machine mode, error envelopes, and manifest metadata (`purvey manifest` is the machine contract; AGENTS.md documents auth rules per command family).

Per ADR-006/PADR-0011: the CLI owns the **portable tool surface only** — thin, stable wrappers over the WP-1 endpoints. No signal/statistics computation in the CLI (proprietary behavior stays server-side).

### 5.1 Commands

| Command                                                                                                                                                                                   | Wraps                       | Auth                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purvey market signals [--type <t>...] [--origin <o>] [--process <p>] [--market retail\|wholesale\|all] [--min-discount <n>] [--min-score <n>] [--window 7d\|30d] [--limit <n>] [--json]` | `/v1/market/signals`        | Authenticated session or API key with entitlement; on 403, exit with the standard entitlement error envelope and a one-line upgrade hint on stderr |
| `purvey market signals --summary`                                                                                                                                                         | `?summary=true`             | Works unauthenticated (public teaser parity)                                                                                                       |
| `purvey market stats [--origin <o>] [--process <p>] [--market …] [--window 7d\|30d] [--baseline-weeks <n>] [--json]`                                                                      | `/v1/price-index/stats`     | Market-wide works unauthenticated; segment queries require entitlement                                                                             |
| `purvey market metadata --dimension process\|disclosure\|score [--origin <o>] [--grain week\|month] [--from <date>] [--to <date>] [--json]`                                               | `/v1/market/metadata-index` | Public slice unauthenticated; rest entitled                                                                                                        |

Human output: compact tables with the evidence line rendered as a sentence (e.g. `Ethiopia Yirgacheffe  $6.20/lb  −21% vs segment median $7.85 (p12)  [below_market]`). `--json` emits the API response verbatim (no reshaping — agents rely on §3.3/§3.4 field names).

### 5.2 Library exports

Export typed functions for agent/tool reuse (consumed by coffee-app chat per ADR-006): `marketSignals(params)`, `marketSignalsSummary()`, `marketStats(params)`, `marketMetadataIndex(params)` from a `market` module, mirroring the pattern of the existing `catalog` module exports. Include TypeScript types for the §3.3 evidence object and §3.4 enums (single source: generate or hand-mirror from the API docs; keep names identical).

### 5.3 Manifest + tests

- Register the three commands in `purvey manifest` with arg schemas, auth requirements, and output-mode notes so agents can discover them.
- Tests: arg validation, 401/403 envelope handling, `--json` passthrough fidelity, summary mode unauthenticated, and a recorded-fixture test per endpoint response shape.
- Release: minor version bump; coffee-app consumes via `@purveyors/cli` dependency update (WP-3).

---

## 6. WP-3 — coffee-app (this repo)

Deliverables: three UI increments on `/analytics`, chat tool adapters, docs alignment. All UI follows BRAND.md (AccentSpine artifact cards, serif question-headings, chartColors.ts palette) and existing section patterns (`AnalyticsSectionHeader`, `analytics/sections/*`).

1. **P1 — Value signals chapter** (needs endpoint 1). New `ValueSignalsSection.svelte` at the top of `/analytics` under an `AnalyticsSectionHeader` titled "What should I consider buying?" — Intelligence users: signal cards (name, price, evidence sentence, `signal_type` badge, link to catalog deep link); others: count teaser from `?summary=true` + "Start Intelligence" CTA (`/subscription?plan=intelligence-monthly&intent=checkout`). Server load proxies via `parchmentClient` per ADR-007 proxy conventions (see `src/lib/server/priceIndexProxy.ts` as the pattern). Empty state: "No strong buy signals this morning — that's a signal too."
2. **P2 — Movement significance** (needs endpoint 2). Feed stats into `marketReadHeadline`/`marketReadDetail` composition in `analytics/+page.svelte` (`classification` + `move_driver` drive the sentence: repricing vs mix-shift phrasing); KPI tones map from `classification` instead of raw sign.
3. **P3 — Metadata index chapter** (needs endpoint 3 + backfill). New section under header "How is the market changing?": public proof chart = market-wide process-mix trend (stacked area, `PROCESS_COLORS`); gated modules = origin-level disclosure trend + score distribution band chart. Only after this ships: add "metadata index" positioning copy to `/analytics` + `/api` pages and BRAND.md naming if branded.
4. **P4 — Chat/GenUI tools** (needs WP-2 release). Thin adapters over the CLI `market` module exports in the chat tool registry (same pattern as `catalog_facets`/`catalog_rank` adapters): snake_case tool names (`market_signals`, `market_stats`, `market_metadata`), Zod schemas, session/access-context injection, `toModelOutput` compaction. Entitlement failures surface as upgrade guidance, not errors.
5. **Docs/discoverability** — `/docs/api` pages for the three endpoints, `llms.txt` update, API page plan-table updates (AGENTS.md docs-alignment rule: check `/api`, `/docs`, README together).

## 7. Sequencing & integration checkpoints

| Step                          | Owner         | Gate to next                                                                              |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| WP-1 tables + job + backfill  | parchment-api | staging data verified: signals exist for latest date; metadata history reaches 2026-03-21 |
| WP-1 endpoints + docs + tests | parchment-api | contract review against §3–§4 by coffee-app owner; entitlement tests green                |
| WP-2 CLI group + release      | CLI           | `purvey market signals --json` output matches §3.3 byte-for-byte on staging               |
| WP-3 P1–P3 UI                 | coffee-app    | Vercel preview review per module                                                          |
| WP-3 P4 chat tools            | coffee-app    | chat answers "show me buy opportunities on washed Ethiopias under $7" with evidence       |

## 8. Acceptance criteria (v1, cross-package)

- An Intelligence member sees ≥1 evidence-backed buy signal within 5 seconds of opening `/analytics` (when signals exist) and reaches the lot in one click.
- Anonymous/Green callers can obtain signal **counts** everywhere (web teaser, `--summary`, `?summary=true`) but never lot identity; direct API/URL attempts return 403 (tested).
- The market read never reports a raw percentage without significance context, and distinguishes repricing from mix-shift in copy.
- The metadata process-mix chart renders from `metadata_index_snapshots` history (not a live join) back to 2026-03-21.
- `purvey market signals --json`, the web cards, and chat tool outputs all carry the identical §3.3 evidence object.
- No public surface mentions the metadata index before P3 ships.
