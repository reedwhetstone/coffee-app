# Price Snapshot Strategy Research — Purveyors Price Index (PPI)

_Created: 2026-03-21_
_Author: OpenClaw (sub-agent research task)_
_Status: Research complete — ready for implementation_

---

## Executive Summary

**Recommendation:** Two-table approach with scraper-owned write logic.

1. `coffee_price_snapshots` — raw per-bean daily price history written by the scraper after each source run. This is the ground truth layer.
2. `price_index_snapshots` — pre-aggregated PPI data computed from the raw table after all sources complete each day. This is the query layer.

Also: add `scraped_at timestamptz` to `coffee_catalog` immediately (per the master plan's Phase 0.1 urgency note). Every day without it is a day of history we cannot retroactively reconstruct.

---

## Code Findings

### How the Scraper Writes to `coffee_catalog`

Reading `scrape/utils/database.ts`, the `updateDatabase(source)` function runs in 9 steps:

| Step | Action | Columns written |
|------|--------|-----------------|
| 1 | Collect URLs from site | — |
| 2 | Mark no-longer-stocked items | `stocked=false`, `unstocked_date=now()`, `last_updated=now()` |
| 3 | **Update prices for in-stock items** | `cost_lb`, `stocked=true` only — NO `last_updated` |
| 4 | Check for new URLs | — |
| 5 | Insert new products | `last_updated=now()`, `stocked_date=now()`, all fields |
| 7 | Embedding generation/backfill | `coffee_chunks` table only |
| 8 | Data hygiene (continent, grade fixes) | `continent`, `grade`, `appearance` |
| 9 | Re-scrape incomplete products | Various fields + `last_updated=now()` |

**Critical finding:** When updating existing product prices (Step 3), `last_updated` is NOT set. Only `cost_lb` and `stocked` are written. This means `last_updated` cannot be used to determine when a price last changed. It's updated on: new inserts, unstocking events, and data-quality re-scrapes — but not routine price updates.

### Current `coffee_catalog` Schema

From `supabase/migrations/001_full_schema.sql`:

```
id          integer (PK, auto-increment)
name        text NOT NULL
cost_lb     numeric              -- current price per lb
last_updated date                -- NOT timestamptz; NOT updated on price changes
stocked     boolean
stocked_date date
unstocked_date date
source      text
country     text
continent   text
region      text
processing  text
grade       text
link        text (unique)
... (full description fields, tasting notes, etc.)
```

**Missing columns (exist in prod but not in 001 migration):**
- `price_tiers jsonb` — multi-tier pricing, e.g. `[{"min_lbs": 1, "price": 7.50}, {"min_lbs": 50, "price": 5.20}]`
- `wholesale boolean` — true when minimum tier > 5 lbs
- `price_tiers` and `wholesale` are confirmed live in prod per TOOLS.md (added via dashboard or separate migration)

**Absent columns that matter for PPI:**
- `scraped_at timestamptz` — does not exist. Phase 0.1 of the master plan flags this as urgent.
- `price_index_snapshots` table — does not exist yet.

### What `cost_lb` Represents

From `scrape/utils/priceTierExtractor.ts` and `columnDefinitions.ts`:

- `cost_lb` is **always a per-pound price** (not total price, not a bulk rate)
- For multi-tier sources, `cost_lb` is the price at the 1-lb tier specifically
- `price_tiers` holds the full tier array sorted by `min_lbs` ascending
- `isWholesale()` checks `tiers[0].min_lbs > 5` — if the smallest available unit is > 5 lbs, it's wholesale

This means `cost_lb` is always comparable across suppliers for a 1-lb purchase. Clean for indexing.

### `last_updated` Is Unreliable for Price History

`last_updated` has type `date` (not `timestamptz`). It's set on new inserts and unstocking but **not** on regular price updates. You cannot reconstruct price history from it.

---

## Architecture Options

### Option A: Application-Level Snapshot Table (Recommended)

The scraper writes a snapshot row per bean after each source run. The scraper owns the write logic.

```
coffee_price_snapshots
  - catalog_id (FK to coffee_catalog)
  - snapshot_date (date)
  - cost_lb (the per-lb price at scrape time)
  - price_tiers (full tier JSONB at scrape time)
  - stocked (stocked state at scrape time)
  - wholesale (boolean at scrape time)
  - UNIQUE(catalog_id, snapshot_date)
```

**Pros:**
- Explicit and simple
- Scraper owns the logic (Reed's directive)
- Deduplication with `ON CONFLICT DO NOTHING` is trivial
- No DB magic to debug
- Queryable directly, no transformation needed

**Cons:**
- Requires scraper code change (1 new function + 1 call at end of `updateDatabase()`)
- Storage grows at ~87 MB/year (see projections below — completely negligible)

### Option B: PostgreSQL Trigger on `coffee_catalog`

A trigger on `UPDATE` fires when `cost_lb` changes and writes to a history table.

**Pros:**
- Zero scraper code change
- Captures any update, even outside the scraper

**Cons:**
- Violates Reed's directive (scraper should own write logic)
- Trigger fires on EVERY UPDATE including hygiene fixes, embedding backfill metadata, unstocking — needs careful filtering
- Harder to debug in Supabase environment
- Triggers are hidden DB side effects; harder to understand the data flow
- Supabase's PostgREST layer can sometimes cause unexpected trigger interactions
- **Verdict: Ruled out**

### Option C: Supabase Realtime / Webhooks

Use Supabase Realtime publication changes or database webhooks to capture `coffee_catalog` updates.

**Pros:**
- No DB migration, no scraper changes

**Cons:**
- High complexity for low value at this scale
- Realtime is designed for push-to-client, not for ETL pipelines
- Webhook retry/ordering guarantees are weaker than direct DB writes
- Still need a receiver service to process and store the events
- **Verdict: Overkill and fragile**

### Option D: Reconstruct from `last_updated` + git history

Use the `last_updated` timestamp on `coffee_catalog` to infer when prices changed, possibly combined with git diffs.

**Pros:**
- No migration needed
- No code changes needed

**Cons:**
- `last_updated` is NOT updated on price changes (confirmed from code — Step 3 in `updateDatabase()` only writes `cost_lb` and `stocked`)
- `last_updated` type is `date`, not `timestamptz` — sub-day precision impossible
- Git history doesn't contain DB state
- **Verdict: Impossible with current schema. Can't work.**

---

## Recommended Architecture

### Two Tables: Raw + Aggregated

**Table 1: `coffee_price_snapshots`** (raw per-bean history)

Written by scraper after each source run. One row per bean per day, regardless of whether price changed (daily snapshot, not change-only). Deduplication via `UNIQUE(catalog_id, snapshot_date)` + `ON CONFLICT DO NOTHING`.

**Table 2: `price_index_snapshots`** (aggregated PPI)

Computed from the raw table once per day after all sources complete. Matches the schema defined in the master plan. This is the table the API queries.

### Why Daily Snapshot (Not Change-Only)

The tempting optimization is to only record a row when the price changes. This saves storage but complicates every query:

```sql
-- Change-only: "what was the price on March 15?"
SELECT cost_lb FROM coffee_price_snapshots
WHERE catalog_id = 1182 AND snapshot_date <= '2026-03-15'
ORDER BY snapshot_date DESC LIMIT 1;

-- Daily snapshot: same query
SELECT cost_lb FROM coffee_price_snapshots
WHERE catalog_id = 1182 AND snapshot_date = '2026-03-15';
```

The change-only approach also breaks aggregations when you want "all beans active on March 15" — you'd need to reconstruct the state as of that date for each bean independently.

**At our scale, storage is not the constraint.** See projections below.

### Storage Projections

```
coffee_price_snapshots:
  - ~1,200 active beans × 365 days/year = 438,000 rows/year
  - ~200 bytes per row (8 numeric/bool columns + JSONB price_tiers ~100 bytes)
  - ~87 MB/year
  - 10 years of history: ~870 MB — negligible

price_index_snapshots:
  - ~200 distinct (origin, process, grade) combos × 365 days/year = 73,000 rows/year
  - ~120 bytes per row (8 numeric columns + text fields)
  - ~8 MB/year
  - 10 years: ~80 MB — negligible

Total: ~100 MB/year for both tables. Zero concern for Supabase storage.
```

### Where in the Scraper Pipeline

`database.ts` runs `updateDatabase(source)` per source. Integration point:

**New Step 10** at the end of `updateDatabase()` (after Step 9 re-scrape):

```typescript
// Step 10: Record daily price snapshot for all stocked beans in this source
try {
  await recordPriceSnapshots(source.name);
} catch (error) {
  logger.addLog('Warning', source.name, `Price snapshot failed: ${formatError(error)}`);
  // Non-fatal: don't abort the run if snapshot fails
}
```

The `recordPriceSnapshots(sourceName)` function:
1. Fetches all stocked beans for this source from `coffee_catalog`
2. Batch inserts into `coffee_price_snapshots` with today's date
3. Uses `ON CONFLICT (catalog_id, snapshot_date) DO NOTHING` — safe to call multiple times

**Aggregation trigger:**
After all sources complete (in `index.ts` after `Promise.all()`), call `snapshotPriceIndex(today)` which reads `coffee_price_snapshots` and upserts to `price_index_snapshots`.

### TypeScript Integration (Pseudocode)

```typescript
// In database.ts — add after Step 9

export async function recordPriceSnapshots(sourceName: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!; // 'YYYY-MM-DD'

  const { data: stockedBeans, error: fetchError } = await supabase
    .from('coffee_catalog')
    .select('id, cost_lb, price_tiers, stocked, wholesale')
    .eq('source', sourceName)
    .eq('stocked', true);

  if (fetchError) throw fetchError;
  if (!stockedBeans || stockedBeans.length === 0) return;

  const rows = stockedBeans.map(bean => ({
    catalog_id: bean.id,
    snapshot_date: today,
    cost_lb: bean.cost_lb,
    price_tiers: bean.price_tiers,
    stocked: bean.stocked,
    wholesale: bean.wholesale ?? false,
  }));

  // Batch insert — ON CONFLICT DO NOTHING ensures idempotency
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('coffee_price_snapshots')
      .insert(rows.slice(i, i + BATCH), { onConflict: 'catalog_id,snapshot_date' });
    if (error) throw error;
  }

  logger.addLog('Step 10: Price Snapshot', sourceName,
    `Recorded ${stockedBeans.length} price snapshots for ${today}`);
}
```

And in `index.ts`, after the `Promise.all()` resolves:
```typescript
// After all sources complete:
const { error } = await supabase.rpc('compute_price_index', {
  p_date: new Date().toISOString().split('T')[0]
});
```

---

## Deduplication Strategy

**`UNIQUE(catalog_id, snapshot_date)`** on `coffee_price_snapshots` + `ON CONFLICT DO NOTHING`.

This means:
- If a source scrapes twice in one day (re-run, re-audit), only the first snapshot is kept
- No duplicates possible
- The first scrape's prices are canonical for that day (this is fine — price changes within a day are rare and not relevant to a daily index)

For `price_index_snapshots`: `UNIQUE(snapshot_date, origin, process, grade)` + `ON CONFLICT DO UPDATE` (upsert) — so if the aggregation is re-run the same day with fresh data, it overwrites with the latest values.

---

## What to Snapshot Per Row

The raw `coffee_price_snapshots` table should capture:

| Column | Why |
|--------|-----|
| `catalog_id` | Link back to bean identity |
| `snapshot_date` | The date dimension |
| `cost_lb` | Retail 1-lb price — comparable across all suppliers |
| `price_tiers` | Full tier array — needed for "price at your quantity" queries |
| `stocked` | Availability at snapshot time — availability patterns = market insight |
| `wholesale` | Wholesale flag — needed to segment retail vs wholesale in PPI |

What NOT to snapshot per row:
- `source` — can be joined from `coffee_catalog`
- `country`/`continent`/`origin`/`processing`/`grade` — static attributes, join from `coffee_catalog`
- `name`, `description*`, `cupping_notes` etc. — not price data

The `price_index_snapshots` (aggregated) should match the master plan schema plus a `wholesale_only` flag to separate retail vs wholesale supplier aggregations.

---

## `scraped_at` Column — Priority Action

The master plan flags adding `scraped_at timestamptz` to `coffee_catalog` as urgent Phase 0.1 work. This column should be updated on every `updateDatabase()` run for every bean:

- On insert: `scraped_at = now()` (first time bean was seen)
- On price update (Step 3): `scraped_at = now()` (last time bean was confirmed live)
- On unstock: `scraped_at = now()` (last confirmed absence)

With `scraped_at` populated, we can reconstruct when each bean was "seen" by the scraper even before `coffee_price_snapshots` exists. It doesn't give us historical prices, but it does give us scrape timestamps going forward.

The migration must include `ALTER TABLE coffee_catalog ADD COLUMN IF NOT EXISTS scraped_at timestamptz`.

---

## Option Comparison Matrix

| | App-Level Snapshot (Rec.) | DB Trigger | Supabase Realtime | `last_updated` reconstruct |
|---|---|---|---|---|
| Scraper owns writes | ✅ Yes | ❌ No | ❌ No | ✅ (but no writes) |
| Implementation complexity | Low | Medium | High | Impossible |
| Debuggability | High | Low | Low | N/A |
| Query simplicity | High | High | High | N/A |
| Storage efficiency | Daily full snapshot | Change-only (lower) | Depends | N/A |
| Deduplication | UNIQUE constraint | Need NEW vs OLD compare | Idempotency gap | N/A |
| Supabase compatible | ✅ | ✅ (with caution) | ✅ | ❌ |
| Works with current schema | Needs new table | Needs new table | Needs receiver | ❌ |

---

## Web Research Summary

**PostgreSQL temporal/history patterns (community consensus):**
- The "temporal tables" feature (SQL:2011 standard) is natively implemented in SQL Server and MariaDB; PostgreSQL requires manual implementation via triggers or application code
- For audit trails: triggers work but add hidden side effects and fire on all updates (including no-data-change updates), requiring `NEW.field != OLD.field` filtering
- Community preference for application-level history tables when the write path is controlled and known (our case: scraper owns all writes)
- For time-series price data specifically: append-only tables with a timestamp dimension are the universal pattern (Timescale, QuestDB, standard PostgreSQL all recommend this)

**Commodity price index schema patterns:**
- Two-layer architecture is standard: raw ticks/observations → aggregated indices
- Separation enables: re-aggregation with different normalization, historical corrections, flexible segmentation
- IMF, ICO, and FRED all store raw prices separately from computed indices

**Key insight from research:** At our scale (1,200 beans, daily cadence), the simplest approach is always correct. Complex architectures (triggers, realtime) solve problems we don't have. The per-bean daily snapshot table is how every serious time-series data product starts.

---

## Implementation Order

1. **Now (today):** Apply `20260321_price_snapshots.sql` migration — creates `coffee_price_snapshots`, `price_index_snapshots`, `compute_price_index()` function
2. **In scraper (next PR):** Add `recordPriceSnapshots(sourceName)` function to `database.ts`; call at end of `updateDatabase()`; call `compute_price_index` in `index.ts` after all sources complete
3. **In coffee-app (Phase 1.2):** Build `priceIndex.ts` service that queries `price_index_snapshots`; wire to scraper post-run or Supabase scheduled function

The scraper PR is estimated at ~60 lines of TypeScript — one new function + two call sites.

---

## Open Questions

1. **Backfill:** We have no historical price data before today. Accept this reality. The master plan already accounts for it: "write the PPI launch post when 30 days of data exists."
2. **Unstocked beans in snapshots:** Current recommendation captures only stocked beans. Worth discussing: should we record a final snapshot row when a bean goes unstocked (with `stocked=false`)? This would let us reconstruct when each bean was last seen and at what price.
3. **price_tiers in snapshot:** JSONB storage for `price_tiers` adds ~100 bytes per row. For 10-year projections this is negligible. But if Phase 2 API needs "price at 50 lb quantity" for a given date, we'd need it. Include it.
4. **`wholesale` flag in PPI aggregation:** The master plan's `price_index_snapshots` schema doesn't segment retail vs wholesale. Consider adding a `wholesale_only boolean` column so the API can return "what's the wholesale price for Ethiopian G1" separately from retail.
