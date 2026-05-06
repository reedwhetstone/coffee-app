# PR 01: Bounded Hard-Gated Similar API

**Branch suggestion:** `feat/bounded-hard-gated-similar-api`  
**Parent plan:** `2026-05-06-canonical-match-disambiguation-and-performance.md`  
**Purpose:** Fix the timeout-prone similarity query path and make the API distinguish canonical match candidates from similar coffee recommendations.

## PR goal

Replace score-only `likely_same` promotion with a fast, bounded, gate-first classification contract for `/v1/catalog/:id/similar`.

This PR should make the current member comparison feature trustworthy enough to keep building on: if a row fails basic identity compatibility, it may still be recommended as similar, but it must not be labeled as a same-coffee candidate.

## Why this slice comes now

- PR #332 shipped the first member comparison UI and revealed the right next problem: the system is conflating similarity with identity.
- The attached Supabase evidence showed `find_similar_beans_aggregated_v2` timing out on the first pull. Refresh working is not sufficient; the initial query shape must be corrected.
- Durable identity tables should not be added until identity eligibility is deterministic and the endpoint is fast enough for normal use.

## Mergeable-slice gate

This PR can pass verify and be mergeable even if no later identity schema, scraper pipeline, or CLI parity ships. It improves the current shipped member UI/API by making the result contract faster and less misleading.

## In scope

- Add a new similarity RPC version or safely replace the route's SQL path with bounded candidate retrieval.
- Avoid the current full candidate cross-join aggregation path for on-demand API requests.
- Add shared server classification logic, for example `classifyCatalogMatch()`.
- Add deterministic blocker reason codes for identity claims:
  - `processing_base_method_conflict`
  - `fermentation_type_conflict`
  - `country_conflict`
  - `decaf_conflict`
  - `blend_single_origin_conflict`
  - `harvest_year_conflict`
  - `insufficient_structured_process`
- Update `deriveMatchCategory()` semantics so embedding score is necessary but not sufficient for `canonical_candidate` / `likely same` language.
- Update `/v1/catalog/:id/similar` response shape with grouped output:
  - `groups.canonical_candidates`
  - `groups.similar_recommendations`
  - transitional flat `matches` if needed by current UI
- Update the member comparison UI copy enough to avoid conflating the groups.
- Add tests for hard blockers, insufficient evidence, and similar recommendation retention.

## Out of scope

- Bean identity tables.
- Accepted/rejected review queues.
- Scraper post-ingestion resolution.
- CLI parity.
- Public canonical identity pages.
- Perfect threshold tuning.
- Full UI redesign beyond the minimal grouping/copy needed to consume the safer contract.

## Files to change

Likely coffee-app files:

- `src/lib/server/catalogSimilarity.ts`
- `src/lib/server/catalogSimilarity.test.ts`
- `src/routes/v1/catalog/[id]/similar/+server.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts`
- Current member comparison component(s) introduced by PR #332
- `src/lib/types/database.types.ts`
- `supabase/migrations/*_bounded_similarity_candidates.sql`
- API docs or internal notes if the response shape changes visibly

## Implementation notes

### Bounded SQL direction

Prefer a new RPC, for example `find_similar_beans_aggregated_v3`, rather than mutating v2 in place again.

The function should:

1. Select target embeddings for `origin`, `processing`, and `tasting`.
2. For each target embedding, run a bounded vector search against matching `coffee_chunks.chunk_type` using `ORDER BY cc.embedding <=> target.embedding LIMIT candidate_pool`.
3. Join the resulting candidate ids to `coffee_catalog`.
4. Aggregate per coffee id and compute dimension scores.
5. Return enough structured fields for classification without a second full-table pass.

Avoid exact teaser counts if they require the same expensive full scan. Prefer `null`, an estimate, or a separate cheap bounded count until a better count path exists.

### Classification direction

Classification should happen in TypeScript first unless SQL needs it for filtering. SQL should retrieve candidates quickly; the service should decide whether a candidate can be called same-coffee.

Identity eligibility should be:

- `blocked` when a known hard conflict exists.
- `insufficient_evidence` when required structured fields are missing.
- `eligible` only when hard gates pass and similarity thresholds are met.

A blocked row can still be a `similar_recommendation`.

## Acceptance criteria

- The endpoint returns within normal request budgets for the previously timeout-prone comparison case.
- `Natural` vs `Washed` cannot be classified as a canonical match candidate when both values are structured.
- Known country conflicts cannot be classified as canonical match candidates.
- Missing structured process data cannot become high-confidence same-coffee solely from embeddings.
- Similar-but-blocked rows still appear as similar recommendations with clear reason codes.
- Response includes a classification version, e.g. `canonical-match-v1`.
- Current member UI copy distinguishes `Likely same coffee candidate` from `Similar recommendation`.
- Existing entitlement behavior remains intact.

## Test plan

Run local validation:

```bash
pnpm check --fail-on-warnings
pnpm run lint
pnpm exec vitest run \
  src/lib/server/catalogSimilarity.test.ts \
  src/routes/v1/catalog/[id]/similar/similar.test.ts
```

Add focused tests for:

- same processing base method with high scores => canonical candidate
- natural vs washed => similar recommendation with `processing_base_method_conflict`
- country mismatch => similar recommendation with `country_conflict`
- missing structured process => not canonical high-confidence identity
- grouped output contains both groups and preserves flat matches if retained
- stocked-only behavior is preserved

Live smoke after deploy:

```bash
curl -sS 'https://www.purveyors.io/v1/catalog/<id>/similar?mode=all&limit=10' \
  -H "Authorization: Bearer $PURVEYORS_API_KEY" \
  | jq '.meta, .groups | keys'
```

Then load the comparison UI for the coffee that produced the `2026-05-06 02:40:26 UTC` timeout and verify the first request succeeds without refresh.

## Risks

- The bounded candidate pool may miss some distant candidates. That is acceptable for interactive comparison. Offline scraper candidate generation can chase recall later.
- Conservative blockers may demote true matches when supplier metadata is wrong. That is preferable to poisoning canonical identity trust.
- Response grouping could create UI churn. Keep transitional `matches` until current consumers migrate.

## Exact follow-on dependency

PR 02 should build the calibration golden set against this new classification contract. Durable identity schema should wait until PR 01 and PR 02 are both in place.
