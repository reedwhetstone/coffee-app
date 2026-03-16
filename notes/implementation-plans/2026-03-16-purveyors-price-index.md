# Implementation Plan: Purveyors Price Index (PPI)

**Date:** 2026-03-16  
**Priority:** High — first revenue-generating data product  
**Effort:** 2–3 weekends  
**Revenue potential:** $35K+/year at modest adoption

---

## What We're Building

A specialty green coffee price index product — the first daily-resolution, origin/process/grade-segmented green coffee pricing dataset available commercially. Existing alternatives:

- **SCRPI (Emory/Transparent Trade Coffee):** Quarterly cadence, retail-focused, manually collected
- **ICO Indicator Prices:** Bulk commodity (Arabica/Robusta futures), not specialty-specific
- **IndexBox:** Enterprise commodity data, no specialty green bean granularity
- **FRED Import Price Index:** Aggregate import data, no origin/process breakdown

We already have 34 suppliers scraped daily with price_tiers, origin, process, and grade in `coffee_catalog`. The moat is data we're already collecting.

---

## Product Tiers

| Tier       | Price   | Access                                                      |
| ---------- | ------- | ----------------------------------------------------------- |
| Free       | $0      | 7-day lookback, 3 origins, 100 req/day                      |
| Member     | $29/mo  | Full history, all origins/processes, CSV export, 1K req/day |
| Enterprise | $199/mo | Full API access, webhooks on price changes, 10K req/day     |

Stripe integration already exists. Tier auth already exists (`validateApiRequest`, `getUserApiTier`).

---

## Data Foundation Audit (Pre-Build)

Before writing the endpoint, verify:

1. **Schema completeness**: How many `coffee_catalog` rows have non-null `origin`, `process`, `grade`, AND `price_tiers`? Run against prod:

   ```sql
   SELECT
     COUNT(*) as total,
     COUNT(origin) as has_origin,
     COUNT(process) as has_process,
     COUNT(grade) as has_grade,
     COUNT(price_tiers) as has_price_tiers,
     COUNT(*) FILTER (WHERE origin IS NOT NULL AND process IS NOT NULL AND price_tiers IS NOT NULL) as full_coverage
   FROM coffee_catalog;
   ```

2. **Historical depth**: Does `coffee_catalog` have `scraped_at` or `created_at` timestamps that enable lookback queries? If not, the index requires a new append-only price history table (see Phase 1).

3. **Origin normalization**: Origins are scraper-supplied strings. "Ethiopia", "Ethiopian", "Yirgacheffe, Ethiopia" are the same origin but will fragment the index. A normalization layer is required before the index is meaningful.

4. **Grade normalization**: "Grade 1", "G1", "1st Grade" — same problem as origins.

---

## Architecture

### New DB Table: `price_index_snapshots`

```sql
CREATE TABLE price_index_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL,
  origin text NOT NULL,           -- normalized
  process text,                   -- normalized (washed, natural, honey, etc.)
  grade text,                     -- normalized (G1, G2, etc.)
  supplier_count int NOT NULL,    -- how many suppliers had this combo
  price_min numeric(10,2),        -- lowest price_tiers[0].price seen
  price_max numeric(10,2),        -- highest price_tiers[0].price seen
  price_avg numeric(10,2),        -- mean across suppliers
  price_median numeric(10,2),     -- median across suppliers
  sample_size int NOT NULL,       -- number of SKUs in this bucket
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_price_index_date ON price_index_snapshots(snapshot_date);
CREATE INDEX idx_price_index_origin ON price_index_snapshots(origin);
CREATE INDEX idx_price_index_combo ON price_index_snapshots(origin, process, snapshot_date);
```

This table is populated once daily by a backfill job after the scraper runs.

### Normalization Tables

```sql
CREATE TABLE origin_aliases (
  alias text PRIMARY KEY,
  canonical text NOT NULL
);
-- e.g. 'ethiopian' -> 'Ethiopia', 'yirgacheffe' -> 'Ethiopia (Yirgacheffe)'

CREATE TABLE process_aliases (
  alias text PRIMARY KEY,
  canonical text NOT NULL
);
-- e.g. 'washed', 'fully washed', 'wet process' -> 'Washed'
```

Seed manually from current scraper data. ~50-100 entries covers 90%+ of cases.

---

## Build Phases

### Phase 0: Data Audit + Normalization Seed (0.5 days)

- Run coverage query against prod
- Export distinct origin/process/grade values from catalog
- Write normalization seed data (SQL INSERTs for alias tables)
- If `scraped_at` doesn't exist on `coffee_catalog`, add it via migration (nullable, no existing data impact)

### Phase 1: Snapshot Backfill Job (0.5 days)

Build `src/lib/server/priceIndex.ts`:

```typescript
// Run after scraper, once per day
export async function snapshotPriceIndex(date: Date) {
	// 1. Fetch today's catalog data with non-null price_tiers + origin
	// 2. Normalize origin/process/grade via alias tables
	// 3. Group by (origin, process, grade)
	// 4. Compute min/max/avg/median price across group
	// 5. Upsert into price_index_snapshots
}
```

Wire this to run after the scraper completes (can be a Supabase scheduled function or an endpoint called by the scraper cron).

### Phase 2: API Endpoint (1 day)

New route: `src/routes/api/price-index/+server.ts`

Query params:

- `origins` — comma-separated list (required if not enterprise)
- `process` — optional filter
- `grade` — optional filter
- `from` / `to` — date range (free tier: max 7 days; member/enterprise: unlimited)
- `format` — `json` (default) or `csv` (member+ only)

Response shape:

```json
{
	"meta": {
		"origins": ["Ethiopia", "Colombia"],
		"from": "2026-01-01",
		"to": "2026-03-16",
		"data_points": 156
	},
	"data": [
		{
			"date": "2026-03-16",
			"origin": "Ethiopia",
			"process": "Washed",
			"grade": "G1",
			"price_min": 6.25,
			"price_max": 9.8,
			"price_avg": 7.45,
			"price_median": 7.2,
			"supplier_count": 8
		}
	]
}
```

Reuse existing: `validateApiRequest`, `checkRateLimit`, `logApiUsage`, `getUserApiTier`.

Add new tier enforcement: free tier caps `from` to `now() - 7 days` and limits `origins` to 3.

### Phase 3: Webhook Support (Enterprise, Phase 2+)

- `price_index_webhooks` table: user_id, url, origins[], threshold_pct (trigger when avg moves >X%)
- Daily job after snapshot: compare to prior day, fire webhooks if threshold crossed
- Defer to Phase 2+ — don't block initial launch

### Phase 4: Blog Teaser Page (0.5 days)

`/blog/price-index` — public page with:

- Embedded chart: top 5 origins, 30-day price trend (uses public aggregate, no auth required)
- "Powered by Purveyors" attribution
- CTA to sign up for member API access
- Updated daily

This is the top-of-funnel / SEO surface. Builds the brand before there's significant paid adoption.

### Phase 5: Stripe Billing Tier (0.5 days)

- Add `price_index_member` and `price_index_enterprise` Stripe products
- Wire to user_roles upgrade on checkout
- Free tier is the existing viewer role with new rate limits applied

---

## Stripe + Billing Notes

- Stripe is already integrated (see `src/routes/api/stripe/`)
- Existing `user_roles` table maps users to tiers
- Adding new roles `api_member` and `api_enterprise` is the path of least resistance
- Or: add a `subscriptions` table keyed to Stripe subscription IDs for more flexibility
- Decision needed: per-product billing (price index only) vs. platform subscription (all API features)

---

## Open Questions for Reed

1. **Historical depth:** Do we have `scraped_at` on `coffee_catalog` rows today? If not, the index starts from whenever we add the snapshot job — no retroactive history. Worth adding the timestamp migration immediately regardless.

2. **Normalization quality:** The index is only as useful as the normalization layer. ~100 origin aliases is manageable manually, but needs initial seed work. This is the unsexy work that makes the product defensible.

3. **Pricing:** $29/$199 is a starting point. Could go lower ($9/$99) to maximize adoption and build the dataset reputation faster, then raise prices as the brand establishes. What's your instinct?

4. **Billing model:** Price index as standalone product, or bundle it with a broader "Purveyors Data Platform" subscription that eventually includes tasting notes API, roast analytics, etc.?

5. **Blog teaser timing:** Launch the public chart page before or after the paid API is ready? Earlier is better for SEO and brand, but needs at least 30 days of snapshot data first.

---

## Acceptance Criteria

- [ ] `price_index_snapshots` table created and migrated in prod
- [ ] Origin/process normalization aliases seeded (>90% of current catalog covered)
- [ ] Snapshot job runs daily after scraper, populates table
- [ ] `/api/price-index` endpoint returns correct data with tier enforcement
- [ ] Free tier: 7-day cap + 3-origin limit enforced
- [ ] Member tier: full history + CSV export
- [ ] Enterprise tier: full access + API key limits extended
- [ ] Rate limiting applied (reuse existing infrastructure)
- [ ] Usage logged to `api_usage` table (reuse existing)
- [ ] Public blog teaser page with embedded chart
- [ ] Stripe billing wired for member/enterprise upgrade

---

## Competitive Positioning

When we publish: "Daily specialty green coffee pricing by origin, process, and grade — from 34 US importers and roasters. Updated every morning. Free tier available."

Nobody else has this. The SCRPI is quarterly. ICO is bulk commodity. IndexBox doesn't have specialty green granularity. This is a real gap.

---

## Blog Post This Creates

"We Built a Real-Time Specialty Coffee Price Index" — data journalism piece showing the index in action: how Ethiopian Yirgacheffe G1 washed prices moved over the past 6 months, how price drops correlate with harvest cycles, which origins are most volatile. This is the launch post that drives signups.
