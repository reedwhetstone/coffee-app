# Bean Similarity & Entity Resolution — Project Plan

_Created: 2026-03-19_
_Status: Planning_
_Priority: #1 data target — bridges marketplace to supply chain analysis_

## Problem

"Ethiopia Yirgacheffe Washed Grade 2" from Burman, "Ethiopian Yirgacheffe Grade 2 Washed" from Sweet Maria's, and "Yirgacheffe Natural Gr.2 Washed Process" from Bodhi Leaf are probably the same origin lot, same washing station, same harvest — just sold through different importers with different naming conventions. Today they're 3 separate catalog entries with no connection.

## Why It Matters

Bean similarity is the foundation for:

- **Price comparison**: same bean, N suppliers, N prices
- **Purveyors Price Index (PPI)**: track price of a canonical bean over time
- **Supply chain intelligence**: which importers carry this lot, when does it arrive, when does it sell out
- **Marketplace unlock**: "alert me when this bean is available from a cheaper supplier"
- **Blog content**: data-driven supply chain analysis backed by real cross-supplier matching

## Architecture

### Layer 1: Similarity Search (no new tables)

Use existing `coffee_chunks` embeddings (pgvector) to find similar beans across suppliers. The embeddings already encode tasting profile, origin story, and processing method — not just name string matching.

**What exists today:**

- `coffee_chunks` table with pgvector embeddings
- 5 chunk types per bean: profile, tasting, origin, commercial, processing
- `embeddingService.ts` generates and stores chunks
- Embeddings use OpenRouter (Qwen3-Embedding-8B, essentially free)

**What's needed:**

- Supabase RPC function: given a `coffee_catalog.id`, return top N similar beans via cosine similarity on origin + processing chunks
- CLI command: `purvey catalog similar <id>` — returns ranked matches with similarity scores
- Threshold calibration: ~0.85 = "likely same bean", 0.70-0.85 = "similar profile", <0.70 = different

### Layer 2: Canonical Bean Identity (new table)

A `bean_identity` table representing "this physical lot of coffee":

```sql
CREATE TABLE bean_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  region TEXT,
  farm_or_station TEXT,
  variety TEXT,
  processing TEXT,           -- normalized: washed, natural, honey, anaerobic
  harvest_year INT,
  grade TEXT,                -- normalized
  altitude_range TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- FK on coffee_catalog
ALTER TABLE coffee_catalog ADD COLUMN bean_identity_id UUID REFERENCES bean_identity(id);

-- Index for lookups
CREATE INDEX idx_catalog_bean_identity ON coffee_catalog(bean_identity_id);
```

Multiple `coffee_catalog` rows link to one `bean_identity`. This makes price comparison trivial: query all catalog entries sharing a `bean_identity_id`.

### Layer 3: Resolution Pipeline (scraper post-processing)

Runs after each scrape:

1. For each new/updated catalog entry, compute embedding similarity against existing beans
2. If similarity > 0.85 AND key fields match (country, processing, grade): auto-link to existing `bean_identity`
3. If 0.70-0.85: flag for human review (or LLM-assisted resolution)
4. If no match: create new `bean_identity`
5. LLM assist for edge cases: name normalization, variety inference, washing station identification

### Layer 4: UI + API Surface

- Bean detail page: "Available from N suppliers" with price comparison
- Catalog search: filter by `bean_identity` to see all listings of the same bean
- CLI: `purvey catalog similar <id>`, `purvey catalog identity <id>`
- API: similarity endpoint for external consumers

## Where Each Piece Lives

| Component                         | Repo                      | Why                                   |
| --------------------------------- | ------------------------- | ------------------------------------- |
| `bean_identity` table + migration | Supabase (via coffee-app) | Data model change                     |
| Similarity RPC function (SQL)     | Supabase                  | pgvector lives in Postgres            |
| Resolution pipeline               | coffee-scraper            | Runs post-scrape, has raw data access |
| `purvey catalog similar` command  | purveyors-cli             | Agent/human interface                 |
| Bean identity UI                  | coffee-app                | "Same bean from other suppliers"      |

## Why NOT a Column on coffee_catalog

- Similarity is relational (bean A is similar to beans B, C, D at different scores)
- A simple column would be a FK to `bean_identity`, not a score
- The similarity score itself is computed on-demand via pgvector, not stored
- Storing all pairwise scores would be N^2; computed search is O(N) with pgvector indexes

## What Makes This Better Than String Matching

- Embeddings encode semantic meaning: "Finca La Laja, Veracruz" = "La Laja Estate, Tlaltetela" even when names differ completely
- Origin chunk embeddings capture washing station + altitude + region context
- Processing chunk embeddings normalize "fully washed" = "wet processed" = "washed"
- Tasting embeddings catch "jasmine, citrus, honey" profiles that confirm same-origin beans
- Combined similarity across chunk types gives much higher confidence than any single field

## CRITICAL PREREQUISITE: Stop Deleting Unstocked Embeddings

**Current behavior:** `embeddingService.ts` deletes all `coffee_chunks` for beans that go out of stock. This destroys historical data needed for similarity matching.

**Required change (scraper PR, do first):**

- Remove the `cleanupUnstockedEmbeddings()` function or make it no-op
- Embeddings should persist regardless of stock status
- A bean going out of stock at one supplier doesn't reduce its value for matching, price history, or identity resolution
- The `stocked` field on `coffee_catalog` already tracks availability; embeddings don't need to mirror this

**Impact of not fixing:** Every scrape cycle deletes chunks for unstocked beans, permanently losing the embedding data needed for cross-supplier matching. The longer this runs, the more historical data we lose.

## Phased Implementation

### Phase 0: Stop Embedding Deletion (scraper, 1 hour)

- Remove/disable `cleanupUnstockedEmbeddings()` in `embeddingService.ts`
- Ensure embedding backfill runs for all sources (already does as of PR #101)
- **Do this immediately — every scrape cycle loses data**

### Phase 1: Similarity Search (CLI + SQL, 1-2 days)

- Write Supabase RPC function for pgvector cosine similarity across origin chunks
- Add `purvey catalog similar <id>` CLI command
- Test with known same-beans across suppliers
- Calibrate similarity thresholds with real data
- No new tables needed; uses existing `coffee_chunks`

### Phase 2: Bean Identity Table (migration + scraper, 2-3 days)

- Create `bean_identity` table and FK on `coffee_catalog`
- Build initial clustering: run similarity across all catalog entries, group into identities
- LLM-assisted golden record creation (normalize country, processing, variety)
- Backfill `bean_identity_id` on existing catalog rows

### Phase 3: Resolution Pipeline (scraper, 2-3 days)

- Post-scrape hook: auto-resolve new beans against existing identities
- Confidence-based auto-link vs human review queue
- Edge case handling: seasonal lots, blend components, experimental processing
- Logging and audit trail for resolution decisions

### Phase 4: UI + API (coffee-app, 2-3 days)

- Bean detail: "Available from N suppliers" card with price comparison
- Cross-supplier price history chart
- Catalog filter: "Show all listings of this bean"
- API endpoint for external consumers
- Blog: data-backed supply chain analysis using real matching data

## Open Questions

1. How to handle seasonal lots? Same farm, same variety, different harvest year = same identity or new?
2. Blends: some catalog entries are blends (e.g., "Sweet Classic Espresso"). Do these get an identity?
3. How granular should `bean_identity` be? Farm-level? Region-level? Washing station?
4. Should we expose similarity scores to users, or just "same bean / similar bean" buckets?
5. Rate of false positives at 0.85 threshold — need to calibrate with known matches
