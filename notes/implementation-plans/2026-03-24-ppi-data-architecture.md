# Purveyors Price Index (PPI) Data Architecture Plan

_Created: 2026-03-24_
_Status: Draft for review_

## Context

The PPI is the core data product powering purveyors.io's analytics page, Parchment API, and blog intelligence. It's derived from daily scrapes of 39+ US green coffee importers, producing ~1,200 active catalog listings. The current `price_index_snapshots` table was built ad hoc during the analytics sprint and has accumulated design debt: inconsistent aggregation tiers, no explicit rollup rows, missing statistical depth, and no supply-side metrics.

This plan redesigns the data layer to be commercial API-worthy, drawing from established commodity index methodologies (ICO Composite Indicator, BLS Producer Price Index, Zillow ZHVI) adapted for the specialty green coffee vertical.

## Design Principles

1. **Tiered aggregation with explicit rollups.** Following BLS PPI methodology: every index has a hierarchy from broad to narrow. Null dimension values explicitly mean "aggregated across," not "data missing." Each tier is an independent, pre-computed row.

2. **Median over mean as the headline metric.** Green coffee pricing has fat tails (Jamaica Blue Mountain at $114/lb, gesha lots at $55). The ICO uses weighted averages because they track commodity-exchange coffees; we track retail listings where outliers are meaningful but shouldn't dominate the headline. Median is the Zillow ZHVI approach: robust to composition changes and outliers.

3. **Distribution, not just central tendency.** IQR (p25/p75), standard deviation, and coefficient of variation are standard in any serious price index. They answer "how much agreement is there on what Ethiopia costs?" which is as important as "what does Ethiopia cost?"

4. **Supply signals alongside price signals.** Unique to our position: we see real-time inventory. How many beans are available, how fast they turn over, when new origins appear. This is data no commodity exchange produces because exchanges only see trades, not listings.

5. **Period-over-period change is a first-class metric.** Consumers of price data always want "what changed?" Pre-computing 7d and 30d deltas avoids N+1 queries and makes the API response self-contained.

---

## Phase 1: Fix `compute_price_index` RPC + Enrich Columns

**Goal:** Correct the aggregation logic and add statistical depth. No new tables.

### 1a. Three-tier aggregation

Replace the current single-pass `GROUP BY (origin, process, grade, wholesale)` with explicit tiers:

| Tier                   | Grouping                          | `process` | `grade` | Purpose                                     |
| ---------------------- | --------------------------------- | --------- | ------- | ------------------------------------------- |
| **1 (Origin rollup)**  | origin, wholesale                 | `NULL`    | `NULL`  | Line chart, bar chart, API headline prices  |
| **2 (Origin+Process)** | origin, process, wholesale        | value     | `NULL`  | Process-level breakdown (Washed vs Natural) |
| **3 (Full detail)**    | origin, process, grade, wholesale | value     | value   | PPI member deep-dive, granular API          |

Tier 1 always exists if the origin has ≥2 beans. Tiers 2 and 3 only exist where the dimension is non-null in the source data and the group has ≥2 beans. The `HAVING COUNT(*) >= 2` threshold remains (single-bean segments are statistically meaningless).

### 1b. New columns on `price_index_snapshots`

```sql
ALTER TABLE price_index_snapshots
  ADD COLUMN IF NOT EXISTS price_p25     numeric(10,2),  -- 25th percentile
  ADD COLUMN IF NOT EXISTS price_p75     numeric(10,2),  -- 75th percentile
  ADD COLUMN IF NOT EXISTS price_stdev   numeric(10,2),  -- standard deviation
  ADD COLUMN IF NOT EXISTS stocked_count integer,        -- total beans in this segment (= sample_size, but semantically distinct for supply tracking)
  ADD COLUMN IF NOT EXISTS aggregation_tier smallint NOT NULL DEFAULT 3;  -- 1=origin, 2=origin+process, 3=full detail
```

**Why `aggregation_tier`?** Explicit tier labeling eliminates the fragile `process IS NULL AND grade IS NULL` filter pattern. API consumers can filter by `aggregation_tier = 1` for rollups. It's self-documenting.

**Why `price_p25`/`price_p75`?** IQR is the standard measure of price dispersion in commodity indices. It's robust to outliers (unlike stdev) and gives the "real range" that 50% of offerings fall within. When a roaster asks "what should I expect to pay for Ethiopian Natural?", the IQR is the answer.

**Why `price_stdev`?** Coefficient of variation (`stdev/avg`) normalizes dispersion across origins. Ethiopia (avg ~$10) and Jamaica (avg ~$90) have incomparable absolute spreads but comparable relative spreads. CV is standard in financial data APIs.

### 1c. Updated `compute_price_index` RPC

The full SQL with three-tier aggregation, percentiles, and stdev. (See SQL in separate section below.)

### 1d. Backfill script update

Update `scripts/backfill-supply-index.ts` to also compute p25, p75, stdev, and set `aggregation_tier`. Re-run for the 26-week synthetic history.

---

## Phase 2: `market_daily_summary` Table

**Goal:** One row per day. The headline dashboard numbers and period-over-period changes.

```sql
CREATE TABLE IF NOT EXISTS public.market_daily_summary (
  snapshot_date       date PRIMARY KEY,

  -- Supply metrics
  total_stocked       integer NOT NULL,  -- total beans available across all suppliers
  total_suppliers     integer NOT NULL,  -- distinct suppliers with ≥1 stocked bean
  total_origins       integer NOT NULL,  -- distinct countries represented
  new_arrivals        integer NOT NULL DEFAULT 0,  -- beans newly stocked today (stocked_date = today)
  delistings          integer NOT NULL DEFAULT 0,  -- beans unstocked today (unstocked_date = today)

  -- Price headline (retail only, all origins)
  retail_median       numeric(10,2),
  retail_avg          numeric(10,2),
  retail_p25          numeric(10,2),
  retail_p75          numeric(10,2),
  retail_stdev        numeric(10,2),
  retail_min          numeric(10,2),
  retail_max          numeric(10,2),
  retail_sample_size  integer,

  -- Wholesale headline
  wholesale_median    numeric(10,2),
  wholesale_avg       numeric(10,2),
  wholesale_sample_size integer,

  -- Period-over-period changes (pre-computed for API speed)
  retail_median_7d_change   numeric(10,4),  -- (today - 7d ago) / 7d ago
  retail_median_30d_change  numeric(10,4),

  -- Audit
  created_at          timestamptz DEFAULT now()
);
```

**Computed by:** A new RPC `compute_market_summary(p_date)` that runs after `compute_price_index`. Reads from `coffee_price_snapshots` + `coffee_catalog` for the day's raw data, and from `market_daily_summary` for 7d/30d ago values.

**Use cases:**

- Analytics page header stats (currently computed live in `+page.server.ts` with 4 separate count queries)
- Blog "Coffee Intelligence Report" weekly numbers
- API `/v1/market/summary` endpoint
- LLM context (llms.txt could include "Today's PPI: $X.XX median, N suppliers, M origins")

---

## Phase 3: `supplier_daily_stats` Table

**Goal:** Per-supplier time series for the paid API tier and supplier health analytics.

```sql
CREATE TABLE IF NOT EXISTS public.supplier_daily_stats (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date    date NOT NULL,
  source           text NOT NULL,  -- supplier key (e.g. 'sweet_maria', 'royal_coffee')

  -- Inventory metrics
  stocked_count    integer NOT NULL,
  origins_count    integer NOT NULL,
  new_arrivals     integer NOT NULL DEFAULT 0,
  delistings       integer NOT NULL DEFAULT 0,

  -- Price metrics (retail only for this supplier)
  price_median     numeric(10,2),
  price_avg        numeric(10,2),
  price_min        numeric(10,2),
  price_max        numeric(10,2),
  price_p25        numeric(10,2),
  price_p75        numeric(10,2),

  -- Mix metrics
  wholesale_count  integer NOT NULL DEFAULT 0,
  retail_count     integer NOT NULL DEFAULT 0,

  -- Audit
  created_at       timestamptz DEFAULT now(),

  CONSTRAINT uq_supplier_stats_date UNIQUE (snapshot_date, source)
);
```

**Computed by:** `compute_supplier_stats(p_date)`, running after the price index.

**Use cases:**

- Supplier Health table on analytics (currently computed live)
- API `/v1/suppliers/{source}/history` endpoint
- Supplier comparison charts over time
- "Which supplier has the most price stability?" analysis

---

## Phase 4: Period-Over-Period Enrichment on PPI

**Goal:** Add pre-computed change metrics to `price_index_snapshots` for API convenience.

```sql
ALTER TABLE price_index_snapshots
  ADD COLUMN IF NOT EXISTS median_7d_change  numeric(10,4),
  ADD COLUMN IF NOT EXISTS median_30d_change numeric(10,4),
  ADD COLUMN IF NOT EXISTS supply_7d_change  numeric(10,4);  -- stocked_count change
```

Computed as a post-processing step in `compute_price_index`: after inserting today's rows, UPDATE them with deltas by joining against 7d-ago and 30d-ago rows for the same segment.

**Why pre-compute?** API consumers shouldn't have to make two requests (today + 7d ago) and compute the delta client-side. Every serious market data API (Bloomberg, Zillow, ICO) delivers change metrics inline.

---

## Phase 5: Index Normalization (Future)

**Goal:** True index values (base period = 100) for comparing across origins and time.

Following the ICO Composite Indicator approach:

- Select a base period (e.g., first 4 weeks of daily data)
- Each origin's index = (today's median / base period median) \* 100
- Composite index = weighted average of origin indices, weighted by stocked count (supply-weighted, like ZHVI)

This is the "Purveyors Composite Index" that becomes the headline number ("PPI: 103.2, up 1.4% this week").

**Deferred because:** We need 30+ days of daily data before a meaningful base period exists. The weekly synthetic backfill can seed it, but real daily data quality needs to stabilize first.

---

## Execution Order

| Phase                      | Effort | Dependencies                     | Ships                        |
| -------------------------- | ------ | -------------------------------- | ---------------------------- |
| **1a** Three-tier RPC      | Small  | None                             | Immediate (SQL migration)    |
| **1b** New columns         | Small  | None                             | Same migration as 1a         |
| **1c** Updated RPC         | Medium | 1a, 1b                           | Same PR                      |
| **1d** Backfill re-run     | Small  | 1c                               | After migration              |
| **2** market_daily_summary | Medium | 1c (uses same raw data patterns) | Week of Mar 31               |
| **3** supplier_daily_stats | Medium | None (independent table)         | Week of Mar 31               |
| **4** Period-over-period   | Small  | 2 (needs historical lookback)    | After 7 days of Phase 2 data |
| **5** Index normalization  | Large  | 30+ days of Phase 1 data         | May 2026                     |

---

## SQL: Updated `compute_price_index` RPC (Phase 1)

```sql
CREATE OR REPLACE FUNCTION public.compute_price_index(p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  WITH raw AS (
    SELECT
      ps.cost_lb,
      ps.wholesale,
      cc.country AS origin,
      cc.processing AS process,
      cc.grade,
      cc.source
    FROM public.coffee_price_snapshots ps
    JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
    WHERE ps.snapshot_date = p_date
      AND ps.stocked = true
      AND ps.cost_lb IS NOT NULL
      AND ps.cost_lb > 0
      AND cc.country IS NOT NULL
  ),

  -- Tier 1: Origin-level rollup (process=null, grade=null)
  tier1 AS (
    SELECT
      origin,
      NULL::text AS process,
      NULL::text AS grade,
      (wholesale = true) AS wholesale_only,
      1::smallint AS aggregation_tier,
      COUNT(DISTINCT source)::int AS supplier_count,
      ROUND(MIN(cost_lb)::numeric, 2) AS price_min,
      ROUND(MAX(cost_lb)::numeric, 2) AS price_max,
      ROUND(AVG(cost_lb)::numeric, 2) AS price_avg,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_median,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p25,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p75,
      ROUND(STDDEV(cost_lb)::numeric, 2) AS price_stdev,
      COUNT(*)::int AS sample_size
    FROM raw
    GROUP BY origin, (wholesale = true)
    HAVING COUNT(*) >= 2
  ),

  -- Tier 2: Origin + Process rollup (grade=null)
  tier2 AS (
    SELECT
      origin,
      process,
      NULL::text AS grade,
      (wholesale = true) AS wholesale_only,
      2::smallint AS aggregation_tier,
      COUNT(DISTINCT source)::int AS supplier_count,
      ROUND(MIN(cost_lb)::numeric, 2) AS price_min,
      ROUND(MAX(cost_lb)::numeric, 2) AS price_max,
      ROUND(AVG(cost_lb)::numeric, 2) AS price_avg,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_median,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p25,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p75,
      ROUND(STDDEV(cost_lb)::numeric, 2) AS price_stdev,
      COUNT(*)::int AS sample_size
    FROM raw
    WHERE process IS NOT NULL
    GROUP BY origin, process, (wholesale = true)
    HAVING COUNT(*) >= 2
  ),

  -- Tier 3: Full detail (origin + process + grade)
  tier3 AS (
    SELECT
      origin,
      process,
      grade,
      (wholesale = true) AS wholesale_only,
      3::smallint AS aggregation_tier,
      COUNT(DISTINCT source)::int AS supplier_count,
      ROUND(MIN(cost_lb)::numeric, 2) AS price_min,
      ROUND(MAX(cost_lb)::numeric, 2) AS price_max,
      ROUND(AVG(cost_lb)::numeric, 2) AS price_avg,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_median,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p25,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_lb)::numeric, 2) AS price_p75,
      ROUND(STDDEV(cost_lb)::numeric, 2) AS price_stdev,
      COUNT(*)::int AS sample_size
    FROM raw
    WHERE process IS NOT NULL AND grade IS NOT NULL
    GROUP BY origin, process, grade, (wholesale = true)
    HAVING COUNT(*) >= 2
  ),

  combined AS (
    SELECT * FROM tier1
    UNION ALL
    SELECT * FROM tier2
    UNION ALL
    SELECT * FROM tier3
  )

  INSERT INTO public.price_index_snapshots (
    snapshot_date, origin, process, grade,
    supplier_count, price_min, price_max, price_avg, price_median,
    price_p25, price_p75, price_stdev,
    sample_size, wholesale_only, synthetic, aggregation_tier
  )
  SELECT
    p_date, origin, process, grade,
    supplier_count, price_min, price_max, price_avg, price_median,
    price_p25, price_p75, price_stdev,
    sample_size, wholesale_only, false, aggregation_tier
  FROM combined
  ON CONFLICT (snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only, synthetic)
  DO UPDATE SET
    supplier_count = EXCLUDED.supplier_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    price_avg = EXCLUDED.price_avg,
    price_median = EXCLUDED.price_median,
    price_p25 = EXCLUDED.price_p25,
    price_p75 = EXCLUDED.price_p75,
    price_stdev = EXCLUDED.price_stdev,
    sample_size = EXCLUDED.sample_size,
    aggregation_tier = EXCLUDED.aggregation_tier;
END;
$$;
```

## SQL: Column Additions (Phase 1)

```sql
ALTER TABLE public.price_index_snapshots
  ADD COLUMN IF NOT EXISTS price_p25 numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_p75 numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_stdev numeric(10,2),
  ADD COLUMN IF NOT EXISTS aggregation_tier smallint NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.price_index_snapshots.price_p25 IS
  '25th percentile ($/lb). Lower bound of the interquartile range.';
COMMENT ON COLUMN public.price_index_snapshots.price_p75 IS
  '75th percentile ($/lb). Upper bound of the interquartile range.';
COMMENT ON COLUMN public.price_index_snapshots.price_stdev IS
  'Standard deviation of prices in the segment. Use stdev/avg for coefficient of variation.';
COMMENT ON COLUMN public.price_index_snapshots.aggregation_tier IS
  '1 = origin rollup (process=null, grade=null), 2 = origin+process (grade=null), 3 = full detail. '
  'Consumers should filter by tier for the granularity they need.';

-- Update existing synthetic rows to tier 1 (they were all origin-level rollups)
UPDATE public.price_index_snapshots
SET aggregation_tier = 1
WHERE synthetic = true AND process IS NULL AND grade IS NULL;
```

---

## Frontend Impact

After Phase 1, the analytics page query can replace `process=null, grade=null` filtering with `aggregation_tier = 1`:

```typescript
.from('price_index_snapshots')
.select('...')
.eq('aggregation_tier', 1)  // origin-level rollups only
```

This is cleaner, faster (can be indexed), and self-documenting.

The `price_p25` and `price_p75` values enable a proper IQR band on the line chart (much better than the min/max bands we tried earlier, which included outliers). The IQR band represents where 50% of offerings fall, which is the actual useful range for a buyer.

---

## API Impact

The Parchment API gets these endpoints naturally from this schema:

| Endpoint                                    | Source                             | Tier       |
| ------------------------------------------- | ---------------------------------- | ---------- |
| `GET /v1/prices/origins`                    | `aggregation_tier = 1`             | Free       |
| `GET /v1/prices/origins/{origin}`           | `aggregation_tier = 1, origin = X` | Free       |
| `GET /v1/prices/origins/{origin}/processes` | `aggregation_tier = 2, origin = X` | Member     |
| `GET /v1/prices/origins/{origin}/detail`    | `aggregation_tier = 3, origin = X` | PPI Member |
| `GET /v1/market/summary`                    | `market_daily_summary`             | Free       |
| `GET /v1/suppliers/{source}/history`        | `supplier_daily_stats`             | PPI Member |

Each tier maps to a subscription level. The data schema IS the API schema.

---

## Competitive Positioning

**What exists today in green coffee market data:**

- **ICO Composite Indicator**: Government-level, tracks exchange prices (C-market), not retail/specialty. Monthly reports. No API.
- **Algrano**: Marketplace pricing, but only for their own platform's transactions. Not cross-market.
- **Cropster Hub**: Roasting/sourcing platform. Has pricing data but not structured as a market index.
- **Daily Coffee News / SCA**: Editorialized analysis, not structured data.

**What PPI offers that nobody else does:**

- Cross-supplier retail green coffee pricing (39+ importers)
- Daily granularity (everyone else is monthly or quarterly)
- Tiered aggregation (origin → process → grade) with statistical depth
- Supply-side metrics (stocked counts, arrivals, delistings) alongside price
- Free tier with meaningful data (not just a teaser)
- RESTful API designed for programmatic consumption

The closest analog is Bloomberg for financial markets or Zillow for real estate: a structured, computable index over a fragmented market where pricing was previously opaque.
