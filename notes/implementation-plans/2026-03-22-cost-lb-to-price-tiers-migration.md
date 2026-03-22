# Implementation Plan: Derive cost_lb from price_tiers[0].price

**Date:** 2026-03-22
**Priority:** High (data integrity + bug elimination)
**Scope:** coffee-scraper, coffee-app, purveyors-cli, Supabase RPC functions
**Approach:** Phase 1 = DB migration + code changes. Phase 2 = deprecate cost_lb column entirely (future).

---

## Problem

`cost_lb` is a flat field that gets overwritten with wrong values (Royal Coffee total bag price bug, potential issues with other sources). `price_tiers[0].price` is the structured, validated source of truth for per-lb pricing. All code that reads `cost_lb` should read `price_tiers[0].price` instead.

## Strategy

1. **Backfill**: Copy `cost_lb` → `price_tiers` for rows that have `cost_lb` but no `price_tiers`
2. **Code**: Replace all `cost_lb` reads with `price_tiers[0].price` across all codebases
3. **Snapshots**: Update price snapshot recording to use `price_tiers[0].price`
4. **RPC**: Update `compute_price_index` to use `price_tiers` instead of `cost_lb`
5. **Keep column**: Don't drop `cost_lb` yet; stop writing to it in Step 3, keep writing on insert for backward compat

---

## Step 0: SQL to run in Supabase Dashboard (Reed)

### 0a. Backfill: rows with cost_lb but no price_tiers

```sql
-- Preview first
SELECT id, name, source, cost_lb, price_tiers
FROM coffee_catalog
WHERE price_tiers IS NULL
  AND cost_lb IS NOT NULL
  AND public_coffee = true
LIMIT 20;

-- Then apply
UPDATE coffee_catalog
SET price_tiers = jsonb_build_array(
  jsonb_build_object('min_lbs', 1, 'price', cost_lb::numeric)
)
WHERE price_tiers IS NULL
  AND cost_lb IS NOT NULL;
```

### 0b. Fix Royal Coffee bad cost_lb (39 rows)

```sql
-- Preview
SELECT id, name, cost_lb, price_tiers->0->>'price' AS tier_price
FROM coffee_catalog
WHERE source = 'royal_coffee'
  AND cost_lb > 99
  AND price_tiers IS NOT NULL
  AND (price_tiers->0->>'price')::numeric > 0
  AND (price_tiers->0->>'price')::numeric < 50;

-- Apply
UPDATE coffee_catalog
SET cost_lb = (price_tiers->0->>'price')::numeric
WHERE source = 'royal_coffee'
  AND cost_lb > 99
  AND price_tiers IS NOT NULL
  AND (price_tiers->0->>'price')::numeric > 0
  AND (price_tiers->0->>'price')::numeric < 50;
```

### 0c. Update compute_price_index RPC to use price_tiers

```sql
CREATE OR REPLACE FUNCTION public.compute_price_index(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.price_index_snapshots (
    snapshot_date,
    origin,
    process,
    sample_count,
    price_min,
    price_max,
    price_avg,
    price_median
  )
  SELECT
    target_date,
    ps.country AS origin,
    COALESCE(ps.processing, 'Unknown') AS process,
    COUNT(*) AS sample_count,
    MIN((ps.price_tiers->0->>'price')::numeric) AS price_min,
    MAX((ps.price_tiers->0->>'price')::numeric) AS price_max,
    ROUND(AVG((ps.price_tiers->0->>'price')::numeric)::numeric, 2) AS price_avg,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (ps.price_tiers->0->>'price')::numeric) AS price_median
  FROM public.coffee_price_snapshots ps
  WHERE ps.snapshot_date = target_date
    AND ps.stocked = true
    AND ps.price_tiers IS NOT NULL
    AND (ps.price_tiers->0->>'price')::numeric > 0
  GROUP BY ps.country, COALESCE(ps.processing, 'Unknown')
  HAVING COUNT(*) >= 2
  ON CONFLICT (snapshot_date, origin, COALESCE(process, 'Unknown'))
  DO UPDATE SET
    sample_count = EXCLUDED.sample_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    price_avg = EXCLUDED.price_avg,
    price_median = EXCLUDED.price_median;
END;
$$;
```

### 0d. Update find_similar_beans RPC to use price_tiers

```sql
-- Check the current function definition first, then update the cost_lb references
-- to use (price_tiers->0->>'price')::numeric in the SELECT and ORDER BY clauses.
-- (Need to inspect current function body to provide exact replacement SQL)
```

---

## Step 1: coffee-scraper changes (PR on fix/royal-coffee-cost-lb-step3 branch)

### scrape/utils/database.ts

**recordPriceSnapshots()** — line ~495:

- Change `.not("cost_lb", "is", null)` → `.not("price_tiers", "is", null)`
- Change `cost_lb: bean.cost_lb` → `cost_lb: bean.price_tiers?.[0]?.price ?? bean.cost_lb`

### scrape/types/interfaces.ts

- Keep `cost_lb` in ScrapedData interface (still written on insert)

### scrape/audit/checks/formatValidation.ts

- The cost_lb vs price_tiers consistency check can be simplified or removed
- It was a band-aid for this exact problem

### scrape/updatePrices.ts

- Line 96: `.update({ cost_lb: price })` — this is the updatePrices script; should also stop writing cost_lb or derive from price_tiers

---

## Step 2: coffee-app changes (separate PR)

### src/routes/analytics/+page.server.ts

All queries selecting `cost_lb` need to switch:

- Lines 189-204: Origin price range chart — change `.select('country, cost_lb')` and `.not('cost_lb', ...)` to use price_tiers
- Lines 242-246: Supplier health table — same pattern
- Lines 252-279: Supplier comparison — same pattern
- Lines 313, 325: Arrivals/delistings — same pattern

**Helper function** (add to top of file):

```typescript
/** Extract per-lb price from price_tiers, falling back to cost_lb for legacy rows */
function getPerLbPrice(row: {
	price_tiers?: Array<{ price: number }> | null;
	cost_lb?: number | null;
}): number | null {
	if (row.price_tiers?.length && typeof row.price_tiers[0].price === 'number') {
		return row.price_tiers[0].price;
	}
	return row.cost_lb ?? null;
}
```

Then all queries add `price_tiers` to their `.select()` and use `getPerLbPrice(row)` instead of `row.cost_lb`.

### src/routes/analytics/+page.svelte

- Lines 679, 763: Change `bean.cost_lb` to use the server-provided price (already computed)

### src/routes/beans/BeanForm.svelte

- Line 199: `catalogBean.cost_lb` fallback — change to `catalogBean.price_tiers?.[0]?.price ?? catalogBean.cost_lb`

### src/routes/beans/BeanProfileTabs.svelte

- Lines 487, 639, 1076, 1081: References to `cat.cost_lb` and `selectedBean.coffee_catalog?.cost_lb` — switch to price_tiers

### src/routes/api/catalog/+server.ts

- Lines 49-50, 85-86: `cost_lb_min`/`cost_lb_max` filter params — these query against the `cost_lb` column. Need to change to a computed filter or add a DB view/index.
  - **Simplest**: Keep the API param names but filter on `price_tiers->0->>'price'` cast to numeric
  - Or: Create a generated column in Supabase: `ALTER TABLE coffee_catalog ADD COLUMN price_per_lb numeric GENERATED ALWAYS AS ((price_tiers->0->>'price')::numeric) STORED;`

### src/lib/server/greenCoffeeUtils.ts

- Line 33, 89: `cost_lb` in type and select — add `price_tiers` to select, derive price

### src/lib/data/inventory.ts

- Line 109: `cost_lb` in inventory type — keep for backward compat but consumers should use price_tiers

---

## Step 3: purveyors-cli changes (separate PR)

### src/lib/catalog.ts

- Line 25, 45: `cost_lb` in CatalogItem type — keep field, add helper
- Line 137: `items.map(i => i.cost_lb)` — change to `i.price_tiers?.[0]?.price ?? i.cost_lb`
- Lines 174, 178: `.gte('cost_lb', ...)` / `.lte('cost_lb', ...)` — filter on price_tiers or keep cost_lb filter with generated column
- Lines 205, 208: `.order('cost_lb', ...)` — same consideration
- Line 253: `.select('id, country, continent, cost_lb, stocked')` — add `price_tiers`

### src/lib/inventory.ts

- Lines 48, 64: Select strings include `cost_lb` — add `price_tiers`

### src/lib/interactive/forms.ts

- Line 145, 165, 175: Bean selection display — derive from price_tiers

### src/commands/catalog.ts

- Line 254: Display `bean.cost_lb` — change to `bean.price_tiers?.[0]?.price ?? bean.cost_lb`

---

## Step 4: Supabase generated column (optional but recommended)

```sql
-- Add a generated column for easy querying/ordering
ALTER TABLE coffee_catalog
ADD COLUMN price_per_lb numeric
GENERATED ALWAYS AS ((price_tiers->0->>'price')::numeric) STORED;

-- Index it for fast filtering
CREATE INDEX idx_coffee_catalog_price_per_lb ON coffee_catalog (price_per_lb);
```

This lets all existing `.gte('cost_lb', ...)` / `.order('cost_lb', ...)` queries switch to `.gte('price_per_lb', ...)` without JSON parsing on every query. Also makes the analytics queries faster.

---

## Execution Order

1. **Reed runs SQL 0a + 0b** — backfill price_tiers, fix Royal Coffee cost_lb
2. **Reed runs SQL 0c** — update compute_price_index RPC
3. **(Optional) Reed runs SQL Step 4** — generated column for query perf
4. **PR: coffee-scraper** — Step 1 changes (extend existing PR #131)
5. **PR: coffee-app** — Step 2 changes
6. **PR: purveyors-cli** — Step 3 changes
7. After all merged: cost_lb is write-only on insert, read from price_tiers everywhere

---

## What NOT to do yet

- Don't drop the `cost_lb` column (too many legacy references)
- Don't remove cost_lb from the snapshot table (it's historical data)
- Don't change the API response schema (cost_lb still returned, just derived differently internally)
