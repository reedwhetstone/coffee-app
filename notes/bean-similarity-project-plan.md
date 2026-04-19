# Bean Similarity, Canonical Identity, and Delivery Surfaces — Project Plan

_Created: 2026-03-19_  
_Updated: 2026-03-31_  
_Status: Active planning (some pieces already shipped)_  
_Priority: High; this is the core bridge between marketplace listings, supply chain intelligence, and product differentiation_

## Problem

"Ethiopia Yirgacheffe Washed Grade 2" from Burman, "Ethiopian Yirgacheffe Grade 2 Washed" from Sweet Maria's, and "Yirgacheffe Washed Gr.2" from Bodhi Leaf are likely the same (or closely related) physical coffee lots. Today they exist as disconnected catalog rows.

We need a system that:

- Finds similar coffees across suppliers reliably
- Graduates high-confidence matches into a canonical identity model
- Serves the results cleanly through v1 API, CLI, web app UI, and chat tools
- Does not regress to legacy price fields (`cost_lb`) as the primary pricing source

## Why It Matters

Bean similarity and identity resolution unlock:

- Cross-supplier price comparisons for "the same bean"
- Time-series pricing and availability for canonical beans (PPI)
- Supply chain intelligence (arrivals, delistings, importer behavior)
- Marketplace features (cheaper alternatives, restock alerts)
- High-leverage blog content that is defensible (real matching, not hand-wavy)

## Current State (as of 2026-03-31)

### Ingestion and embeddings (coffee-scraper)

- Embeddings are generated and stored in `coffee_chunks`.
- Embedding generation runs as part of scrape ingestion:
  - New stocked products: embeddings generated shortly after insert
  - Backfill: missing embeddings for stocked products are backfilled in small batches
- Stock status does not control whether embeddings are retained.
  - Status: embedding cleanup for unstocked coffees is intentionally disabled in the scrape pipeline.
  - Remaining risk: the `cleanupUnstockedEmbeddings()` function still exists in `scrape/embeddingService.ts`; it must be made impossible to re-enable accidentally.

### Similarity infrastructure (Supabase/Postgres)

- `coffee_chunks` is pgvector-backed and indexed.
- General vector search RPCs exist (chunk-level and catalog-level).
- Dedicated bean-to-bean similarity RPCs exist (added as a migration in this repo):
  - `find_similar_beans` (per-chunk match rows)
  - `find_similar_beans_aggregated` (aggregated across origin + processing + tasting)

### Delivery surfaces

- CLI: `purvey catalog similar <id>` exists and calls `find_similar_beans_aggregated`.
- Web chat tools: `find_similar_beans` is wired in `coffee-app/src/lib/services/tools.ts` via the CLI library.
- Web app UI: no user-facing "similar beans" surface yet.
- API:
  - `/v1/catalog` is canonical and returns `price_per_lb`, `price_tiers`, and `cost_lb`.
  - Similarity is not yet exposed as a first-class `/v1/...` HTTP endpoint.

### Known contract mismatch (pricing)

The similarity RPCs currently surface `cost_lb` but do not surface canonical pricing fields (`price_per_lb`, `price_tiers`). This is now a correctness issue because we explicitly treat `price_per_lb` / `price_tiers` as the primary price contract across API surfaces.

## Target End State

1. Similarity search is always available:

- Fast retrieval of top-N similar beans
- Returns per-dimension scores and an overall score
- Returns canonical price fields consistently

2. Canonical identity exists for high-confidence matches:

- Multiple catalog rows link to one `bean_identity`
- Identity creation and linkage is traceable and reversible

3. Delivery surfaces are excellent:

- v1 API endpoint(s) that wrap the similarity system behind unified auth and tier gating
- Web app UI that makes similar listings actionable
- CLI commands that mirror the API and support debugging
- Chat tools that can explain and cite why beans are similar

## Architecture Layers

### Layer 1: Similarity Search (no new identity tables required)

Use existing `coffee_chunks` embeddings to find similar beans across suppliers.

Deliverables for this layer:

- RPC returns canonical price fields and match explanations
- v1 HTTP endpoint wraps RPC and enforces auth + tier limits
- CLI and chat tools call v1 endpoint (or call RPC through the same library) consistently

### Layer 2: Canonical Bean Identity (new tables)

Introduce a `bean_identity` entity representing the canonical physical lot concept.

Key requirement:

- This is not “store similarity scores”; it is “store identity relationships” so that product queries are stable.

### Layer 3: Resolution Pipeline (scraper post-processing)

After each scrape:

- Match new and updated beans against existing identities
- Auto-link when confidence is high and field constraints agree
- Produce a review queue when ambiguous
- Create new identities when no match exists

### Layer 4: UI + API Surface

- UI:
  - Catalog detail page: “Also available from other suppliers”
  - Supplier comparison and price spread
  - Explainability: “Matched on origin + processing + tasting”
- API:
  - v1 endpoints that return structured similarity and identity information

## The Missing Work (detailed plan)

This section enumerates the “what else are we missing?” items and turns them into concrete steps.

### 0) Make embedding retention non-regressable (P0)

Goal: ensure we never accidentally re-enable deletion of embeddings for unstocked coffees.

Steps:

- In coffee-scraper:
  - Make `cleanupUnstockedEmbeddings()` a no-op OR delete it entirely.
  - Add a test that asserts scrape ingestion does not delete rows from `coffee_chunks` when a catalog row transitions stocked → unstocked.
  - Add a comment in the embedding service header that embeddings are part of the warehouse layer and must persist regardless of stock.

Acceptance criteria:

- No code path in coffee-scraper deletes embeddings based on stock status.

### 1) Fix similarity RPC pricing contract (P0)

Goal: similarity results must speak in canonical pricing.

Steps:

- Update `find_similar_beans` and `find_similar_beans_aggregated` to include:
  - `price_per_lb`
  - `price_tiers`
  - Keep `cost_lb` as a legacy fallback only
- Ensure the SQL functions select from `coffee_catalog`:
  - `c.price_per_lb`
  - `c.price_tiers`
  - `c.cost_lb`
- Update the CLI `SimilarBean` type and output expectations to match the updated RPC.

Acceptance criteria:

- `purvey catalog similar <id>` output contains `price_per_lb` and `price_tiers`.
- No surface treats `cost_lb` as the default price when canonical fields exist.

### 2) Add explainability and per-dimension scoring (P1)

Goal: similarity is actionable only if users can understand why.

Steps:

- Extend the aggregated similarity RPC (or add a second RPC) to return:
  - `origin_similarity`
  - `processing_similarity`
  - `tasting_similarity`
  - `avg_similarity`
  - `chunk_matches`
- Optionally return the top matching chunk excerpts for each dimension (short, safe snippets).

Acceptance criteria:

- UI and CLI can show a compact explanation: “Origin 0.92, Processing 0.88, Tasting 0.81.”

### 3) Access control and tier gating (P1)

Goal: similarity should be served through the same principal model as v1 resources.

Steps:

- Create `GET /v1/catalog/:id/similar` in coffee-app:
  - Uses `resolvePrincipal()` (API key or OAuth session)
  - Enforces:
    - Max limit per tier
    - Minimum threshold defaults per tier
    - Optional `stocked_only` behavior
  - Calls the RPC internally
- Decide whether to keep direct RPC grants to `anon`:
  - Recommendation: remove `anon` execution rights for similarity RPCs once the v1 endpoint is the official path.

Acceptance criteria:

- Similarity can be used by external API-key clients and logged-in users.
- Anonymous callers do not have unlimited similarity access.

### 4) Canonical endpoint alignment for delivery surfaces (P1)

Goal: all clients call the canonical surface.

Steps:

- CLI:
  - Option A (preferred): call `/v1/catalog/:id/similar` instead of calling Supabase RPC directly.
  - Option B: keep RPC calls but share a single library function that matches v1 semantics.
- Chat tools:
  - Route `find_similar_beans` tool through the same underlying implementation as CLI.

Acceptance criteria:

- There is exactly one place to define:
  - default threshold
  - max limit
  - tier gating
  - response shape

### 5) Threshold calibration and evaluation harness (P1)

Goal: stop guessing at 0.70 and 0.85; measure it.

Steps:

- Create a small “golden set” dataset:
  - 50 known match pairs
  - 50 known non-match pairs
  - 20 ambiguous pairs
- Add a script (repo-local) that:
  - Runs similarity on the set
  - Produces precision/recall at multiple thresholds
  - Captures false positives and false negatives for review
- Decide on threshold buckets:
  - “Same bean likely”
  - “Similar profile”
  - “Not similar”

Acceptance criteria:

- Threshold choices are documented and tied to measured results.

### 6) Embedding versioning and refresh strategy (P1)

Goal: avoid silent drift when chunk formats or models change.

Steps:

- Add `embedding_model` and `embedding_version` to `coffee_chunks.metadata` (or explicit columns).
- When generation code changes chunk templates or model:
  - write a new version
  - allow old and new to coexist temporarily
  - provide a controlled re-embed job

Acceptance criteria:

- It is always possible to answer: “What model generated these embeddings?”
- A re-embed does not break similarity queries mid-deploy.

### 7) Performance and caching strategy (P2)

Goal: UI should not run expensive vector queries repeatedly.

Options:

- Option A: on-demand only (start here)
- Option B: introduce a cache table `coffee_similarity_cache`:
  - key: `target_coffee_id`, `threshold`, `limit`, `stocked_only`, `embedding_version`
  - value: top-K results + computed at timestamp
  - TTL and invalidation on:
    - embedding changes
    - significant catalog row changes

Acceptance criteria:

- Catalog detail page loads similarity matches quickly.

### 8) Web app UI surfaces (P1)

Goal: make similarity visible and useful.

Steps:

- Catalog detail page:
  - “Similar beans across suppliers” module
  - Shows supplier, price (canonical), similarity score, and why
  - One-click filter: “show all similar”
- Catalog list:
  - Optional “find alternatives” action per row

Acceptance criteria:

- A user can start on a bean and quickly find the closest alternatives and cheaper listings.

### 9) Canonical identity model (bean_identity) and resolution pipeline (P2)

Goal: graduate from “similar” to “same.”

Steps:

- Create `bean_identity` table plus `coffee_catalog.bean_identity_id` FK.
- Define identity granularity rules:
  - harvest year handling
  - micro-lot vs region-level
  - blends and espresso blends
- Implement pipeline:
  - auto-link high confidence
  - review queue for mid confidence
  - new identity creation for no-match
- Store an audit trail:
  - how a link was created
  - what evidence was used
  - ability to revert

Acceptance criteria:

- For a canonical identity, we can query all supplier listings of that same bean deterministically.

## Suggested Execution Order (ship value early)

1. P0: Fix similarity RPC pricing contract (add `price_per_lb`, `price_tiers`)
2. P0: Make embedding retention non-regressable (remove or no-op cleanup)
3. P1: Add `/v1/catalog/:id/similar` with unified auth and tier gating
4. P1: Add explainability fields (per-dimension scores)
5. P1: Add UI module on catalog detail page
6. P1: Build calibration harness and document thresholds
7. P1: Add embedding versioning
8. P2: Add caching if needed
9. P2: Implement `bean_identity` + resolution pipeline

## Open Questions

- Do we treat seasonal lots (same farm, same variety, new harvest year) as the same identity or a new identity linked to a “parent”?
- How do we treat blends? Are they identities, or do they link to multiple identities?
- What is the minimum explainability we need for trust? Per-dimension scores, or also chunk excerpts?
- Should similarity be public, API-key gated only, or partially free?

## References

- Similarity infra migration: `supabase/migrations/20260321_similarity_infrastructure.sql`
- Existing RAG chunk RPC: `match_coffee_chunks` in `supabase/migrations/001_full_schema.sql`
- Chat tool wiring: `src/lib/services/tools.ts` (`find_similar_beans`)
- CLI command: `purvey catalog similar` in `purveyors-cli/src/commands/catalog.ts`
