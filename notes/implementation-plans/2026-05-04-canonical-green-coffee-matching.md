# Canonical Green Coffee Matching and Identity Resolution Program

**Date:** 2026-05-04
**Status:** Proposed
**Program owner:** Purveyors catalog, API, CLI, scraper, and agent surfaces
**Access level:** Member tier for app users; paid API tiers for external machine access
**User feedback incorporated:** beta match language, real match-count teaser, 1 lb base comparison first, harvest-year children under parent identities, UI before CLI, and adaptive/non-destructive catalog overlays

## Feature or program

Build a full canonical green coffee matching system that starts from the shipped pgvector similarity layer, hardens it into a member-gated matching contract, then graduates high-confidence matches into canonical bean identities with a merged comparison view.

The product goal is simple: if the catalog has five supplier rows that appear to describe the same or functionally equivalent green coffee, Purveyors should make that visible, explain why, compare the price and availability across suppliers, and eventually maintain a stable canonical identity that can power alerts, API responses, CLI workflows, procurement briefs, and agent recommendations.

## Why now

Historical planning and current repo evidence line up unusually well:

- `notes/bean-similarity-project-plan.md` already identified the path from similarity search to canonical identity, but several contracts are now stale or incomplete.
- `supabase/migrations/20260321_similarity_infrastructure.sql` shipped `find_similar_beans` and `find_similar_beans_aggregated`, but they still expose `cost_lb` as the primary price field and grant direct RPC execution to `anon`.
- `purveyors-cli` already has `purvey catalog similar <id>`, and coffee-app tool wiring already exposes `find_similar_beans`, so the feature is not theoretical. CLI parity matters eventually, but member UI should come earlier than CLI polish for this program.
- ADR-005 now gives a clean entitlement answer: matching, comparison, semantic search, and optimization are member leverage, not anonymous catalog proof.
- PR #327 shipped catalog proof summaries, which gives the canonical merger view a trust vocabulary for process, provenance, freshness, and pricing without exposing raw supplier evidence.
- The Proof Layer moonshot argues for machine-readable coffee trust passports. Canonical matching is the practical proving slice: prove that Purveyors can turn messy supplier rows into a trusted cross-supplier decision object.

## Strategy Alignment Audit

- **Canonical direction:** This directly strengthens `notes/PRODUCT_VISION.md`: truthful normalized coffee data, API-first consistency, CLI as a first-class agent surface, and intelligence that helps roasters decide instead of browse.
- **Product principle supported:** The strongest fit is "data moat over feature sprawl." Canonical matching turns supplier ingestion, embeddings, pricing tiers, proof summaries, and availability tracking into a compound proprietary graph.
- **Cross-surface effect:** The same matching contract should serve web, `/v1/*`, CLI, and app tools. The route or service must be canonical; no parallel similarity thresholds in UI, CLI, and agents.
- **Public value legibility:** Anonymous users can see that matching exists as locked comparison affordances or proof copy, but the actual match list, price spread, canonical identity view, and exports are member/API leverage.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-30-purveyors-proof-layer.md`, `2026-04-16-purveyors-copilot-network.md`, and `2026-04-09-open-coffee-listing-standard.md`. The selected proving slice is not compliance or supplier publishing. It is identity-aware comparison with proof-backed field confidence.
- **Scope check:** Exclude supplier claim workflows, legal compliance claims, RFQ workflows, generic social sharing, and fully automated purchasing. Also exclude replacing the entire catalog schema in one PR.

## Historical context pulled forward

### Already shipped or partially shipped

- `coffee_chunks` exists with pgvector-backed embeddings and indexes.
- Similarity RPCs exist for per-chunk and aggregated bean matching.
- `purvey catalog similar <id>` exists in `purveyors-cli` and calls `find_similar_beans_aggregated` directly.
- `src/lib/services/tools.ts` wires a `find_similar_beans` tool through the CLI library.
- `/v1/catalog` is the canonical catalog API envelope and now supports optional proof summaries.
- Structured process fields and proof summaries exist, with ADR-004 and PR #327 as the current process/proof direction.
- `price_tiers` and `price_per_lb` are the canonical pricing surface for catalog rows. `cost_lb` remains compatibility only.
- `coffee_price_snapshots` exists and stores `price_tiers`; it can later support identity-level price history.

### Known gaps to correct before identity resolution

- Similarity RPC results still return `cost_lb` without canonical pricing fields.
- Direct Supabase RPC access is too broad for a premium member feature.
- The current similarity result has weak explainability: `avg_similarity` and `chunk_matches`, but not enough per-dimension detail for trust.
- No `/v1/catalog/:id/similar` or `/v1/bean-identities/*` endpoint exists.
- No member web UI exists for similar coffees or canonical comparison.
- No calibration harness defines the threshold difference between "similar profile" and "likely same bean."
- No `bean_identity` model or review queue exists on current `origin/main`.
- No pipeline exists to convert similarity candidates into accepted, rejected, or review-needed identity links.

## Scope in

- Hardening the similarity result contract around canonical pricing, dimensions, confidence, and proof-safe metadata.
- New member/API capability for bean matching and canonical identity comparison.
- Canonical `/v1/*` endpoints for similar listings and canonical identity views.
- CLI and agent alignment so machine consumers use the same contract.
- A calibration harness with known match, non-match, and ambiguous examples.
- A reversible canonical identity schema with audit trail and review state.
- A scraper-side resolution pipeline that proposes matches after ingestion and auto-links only above conservative thresholds.
- A member web surface for similar coffees, price spread, supplier comparison, and canonical merged metadata.
- Tests for entitlement, pricing contract, route shape, threshold behavior, and schema reversibility.

## Scope out

- Public anonymous access to full match lists, price comparison, or identity exports.
- Legal or regulatory certification language.
- Supplier claim flows and supplier-published direct feeds.
- Automatic purchasing, checkout, RFQs, or inventory procurement actions.
- Perfect identity resolution on day one.
- Deleting or rewriting historical catalog rows.
- Treating `cost_lb` as primary pricing.

## Proposed behavior

### Member web UX

- Catalog list cards show a locked teaser for anonymous or viewer users: "Member comparison available" with no premium results leaked.
- Member users get an action such as "Compare matches" or "Find equivalent lots" on each stocked catalog row.
- The comparison panel shows:
  - target coffee summary
  - likely same coffee candidates
  - similar profile candidates that are useful substitutes but not canonical matches
  - supplier, stock status, arrival or stocked date, source link, canonical 1 lb price, tiered price summary, and wholesale flag
  - price spread vs target
  - why matched: origin, process, tasting, and provenance signals
  - proof summary badges where available
- Once identities exist, a canonical identity page or drawer shows:
  - canonical label
  - accepted supplier listings
  - min, median, and max price by useful quantities such as 1 lb, 5 lb, and 50 lb when tiers allow it
  - merged metadata with field-level provenance, confidence, and conflicts
  - availability state and recent price movement where snapshots support it

### API behavior

- `GET /v1/catalog/:id/similar`

  - Member session or paid API tier required for match details.
  - Supports `threshold`, `limit`, `stocked_only`, and possibly `mode=similar|likely_same|all`.
  - Returns canonical catalog response fragments, canonical pricing, match scores, proof-safe explanation, beta/confidence copy, and access metadata.
  - Denies anonymous callers with `401`; denies authenticated non-member users with `403` for details.
  - Can support a non-sensitive teaser count for non-members, for example `similar_match_count`, without returning supplier/price details.

- `GET /v1/catalog/:id/canonical`

  - Member session or paid API tier required.
  - Before identity records exist, may return a provisional beta view built from high-confidence similarity candidates with `identity_status: provisional`.
  - After identity records exist, returns the accepted identity and member listings.
  - Harvest year should be modeled as child or season records under a parent identity/series, not as destructive overwrites of the parent identity.

- `GET /v1/bean-identities/:identityId`
  - Added after identity schema lands.
  - Returns stable identity-level data for accepted links only.

### CLI and agent behavior

- `purvey catalog similar <id>` should use the canonical endpoint when API-key auth is present, preserving direct session behavior only when needed.
- Add machine-readable output fields for price tiers, per-dimension scores, match category, and proof summaries.
- Add a later `purvey catalog canonical <id>` command once identity views exist.
- App tools should call the same service or endpoint as CLI/API rather than hand-rolling thresholds.

## Data model direction

### Candidate tables

- `bean_identities`

  - `id`
  - `canonical_name`
  - `identity_key` or slug
  - normalized country, region, producer, farm, washing station, cultivar, processing base method, fermentation type, harvest year when known
  - `confidence`
  - `status`: `provisional`, `active`, `merged`, `deprecated`
  - timestamps

- `bean_identity_links`

  - `id`
  - `bean_identity_id`
  - `coffee_catalog_id`
  - `status`: `candidate`, `accepted`, `rejected`, `superseded`
  - `confidence`
  - `match_method`: `manual`, `auto_high_confidence`, `pipeline_candidate`, `imported`
  - dimension scores and proof summary snapshot
  - audit fields: created by, reviewed by, reviewed at, notes
  - partial unique index so a catalog row can have only one active accepted identity link

- `bean_identity_candidates`

  - optional if candidate links become too noisy for the main link table
  - stores candidate pairs or candidate-to-identity proposals with threshold state and reason codes

- `bean_identity_events`
  - append-only audit trail for create, link, unlink, merge, split, reject, and threshold changes

### Canonical merged metadata

Do not overwrite catalog rows. The canonical view should compute or cache a merged profile that preserves provenance:

- prefer explicitly disclosed values over inferred values
- prefer fields with evidence/proof summaries over bare strings
- expose conflicts rather than averaging them away
- keep null distinct from unknown and from explicit none
- use member-only explanation for field-level confidence when it becomes valuable

### Pricing

Use `price_tiers` as the primary price contract. `price_per_lb` is the list-level comparable summary when present. `cost_lb` can remain as a compatibility fallback but must never be the first field new matching code chooses. Start the comparison UI with a 1 lb base because it is the simplest universal baseline. Design the service shape so later UI can compare both suppliers' tier arrays side by side and compute alternate quantities without schema churn.

For identity-level comparison, compute:

- `price_at_1_lb` as the launch baseline
- `price_at_5_lb` when tiers allow it
- `price_at_50_lb` when tiers allow it
- min, median, max, and target delta
- wholesale eligibility based on tier minimums and `wholesale`

## API or data impact

- Additive migrations only.
- New APIs are member/API-gated from the first PR that exposes match details. Non-member teasers can expose only counts or locked state, never supplier/price match details.
- Existing `/v1/catalog` stays backward compatible.
- Similarity RPCs may get new versions or additive return columns; direct grants should move away from `anon` once the route is official.
- Type generation must update `src/lib/types/database.types.ts` after migrations.
- Cross-repo work is required in `coffee-scraper` for the resolution pipeline and in `purveyors-cli` for CLI parity.

## Program sequence

1. `2026-05-04-canonical-green-coffee-matching-pr-01-similarity-contract.md`
   - Fix similarity result contract, canonical pricing, per-dimension scores, beta/confidence labels, and DB types.
2. `2026-05-04-canonical-green-coffee-matching-pr-02-member-similar-api.md`
   - Add `/v1/catalog/:id/similar` with member/API entitlement, limits, route tests, and optional locked teaser count.
3. `2026-05-04-canonical-green-coffee-matching-pr-05-member-comparison-ui.md`
   - Add member web comparison UX using the endpoint, with 1 lb baseline and room for tier side-by-side comparison.
4. `2026-05-04-canonical-green-coffee-matching-pr-04-threshold-calibration.md`
   - Build evaluation harness and document threshold bands before any durable auto-linking.
5. `2026-05-04-canonical-green-coffee-matching-pr-06-identity-schema-review-queue.md`
   - Add reversible identity schema, parent/harvest-year child modeling, and admin/review-safe surfaces.
6. `2026-05-04-canonical-green-coffee-matching-pr-07-scraper-resolution-pipeline.md`
   - Add post-scrape candidate generation and conservative auto-linking in coffee-scraper.
7. `2026-05-04-canonical-green-coffee-matching-pr-08-canonical-merged-view.md`
   - Add canonical merged view API and member UI.
8. `2026-05-04-canonical-green-coffee-matching-pr-03-cli-agent-alignment.md`
   - Align CLI and app tools after the web/member surface has proven the data contract.

## Dependencies and stop points

- PR 1 is required before any product surface. It fixes the stale pricing and explanation contract.
- PR 2 is the first real data surface and is a valid stop point: members/API users can call beta similarity even if no identity model ships.
- PR 3 in the revised order, the member UI, is the first visible product payoff and should not wait for CLI parity.
- Calibration is required before auto-linking or identity claims. Do not auto-create identities from uncalibrated thresholds.
- CLI parity is useful, but explicitly lower priority than getting the member UI surface live.
- PR 6 creates identity storage but should not auto-link until PR 7.
- PR 7 is the operational activation point.
- PR 8 is the full merged-view product payoff.

## Acceptance criteria

- Matching APIs and UI details are unavailable to anonymous users and non-member viewers except for explicit upgrade teasers and safe match counts.
- All result shapes expose `price_per_lb` and `price_tiers` and do not treat `cost_lb` as primary pricing.
- Similarity results include enough explanation to distinguish "same bean likely" from "similar profile," and all surfaces present the score as beta confidence rather than absolute truth.
- CLI, API, web, and tool consumers share thresholds and response semantics.
- Identity links are reversible and audited.
- Auto-linking is disabled until calibration demonstrates acceptable precision for the high-confidence band.
- Canonical merged views preserve conflicts and provenance rather than flattening uncertainty, and they layer adaptively on top of catalog rows without altering or destroying core catalog data.
- Tests cover direct API access, capability denial, successful member/API access, pricing fields, threshold validation, and identity link constraints.

## Test plan

- Unit tests:
  - price tier helper calculations
  - match category derivation
  - capability helper additions
  - canonical merge field selection and conflict handling
- Route tests:
  - `/v1/catalog/:id/similar` `401` anonymous
  - `403` viewer without member/API capability
  - `200` member session
  - `200` paid API key with row and rate metadata
  - param validation for threshold, limit, mode, and stocked-only
- DB tests or SQL smoke checks:
  - similarity function returns canonical price fields
  - no accepted duplicate identity link for a single catalog row
  - identity event audit rows written for link changes
- UI tests:
  - teaser does not leak match data
  - member comparison drawer renders price tiers, proof badges, and explanation
  - empty state for no embeddings or no confident matches
- CLI tests:
  - JSON contract includes canonical fields
  - API-key mode uses endpoint contract
  - session mode remains compatible or clearly deprecated
- Pipeline tests in coffee-scraper:
  - candidate creation
  - high-confidence auto-link with conservative thresholds
  - ambiguous candidate remains review state
  - rejected candidates are not recreated every run without new evidence

## Risks and rollback

- **False positives in identity resolution:** Mitigate by separating similarity from accepted identity, calibrating thresholds, and keeping auto-link conservative. Rollback by disabling auto-link and reverting active links through audit events.
- **Premium data leakage:** Mitigate by route-level capability checks and tests. Rollback by disabling the route flag or capability.
- **Costly vector queries:** Start on-demand, cap limits, add caching only after observed need.
- **Price contract regression:** Enforce `price_tiers` and `price_per_lb` in tests before surfacing the feature.
- **Supplier relationship risk:** Avoid public accusations or quality rankings. Frame as buyer-side matching confidence, not supplier quality judgment.
- **Overclaiming proof:** Keep language to "likely," "candidate," "accepted identity," and "evidence summary." Avoid certification or compliance language.

## Open questions for Reed

1. Confirmed direction to encode: same farm/process/cultivar across harvest years should use children or seasonal records under a parent identity/series.
2. Should `viewer` users see any actual match result count, or only a locked teaser?
3. Confirmed launch baseline: start with 1 lb. Follow-on UI can compare both suppliers' price tiers side by side and add quantity selection later.
4. Should high-confidence auto-linking ever happen without manual review in the first month, or should all identity links start as review-only until trust is established?
5. Confirmed sequencing: prioritize member web UI early once the endpoint returns useful beta match data; CLI can trail.

## Recommendation

Ship this as a program, not a one-off UI feature.

The strongest first implementation move is PR 1 plus PR 2 as a single vertical slice if capacity allows: harden the DB contract and expose a member/API-gated beta similarity endpoint with safe teaser counts. That gives immediate data for the early UI, fixes a real `cost_lb` contract mismatch, and creates the canonical surface every later member UI, identity, CLI, agent, and scraper workflow can reuse.
