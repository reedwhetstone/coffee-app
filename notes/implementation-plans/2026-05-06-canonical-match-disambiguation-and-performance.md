# Canonical Match Disambiguation and Similar Coffee Recommendations

**Date:** 2026-05-06  
**Status:** Proposed amendment to `2026-05-04-canonical-green-coffee-matching.md`  
**Trigger:** Post-PR #332 feedback and live Supabase timeout evidence  
**Recommended first PR:** `2026-05-06-canonical-match-disambiguation-and-performance-pr-01-bounded-hard-gated-similar-api.md`

## Feature or program

Reframe the green coffee matching work around two distinct products that currently share one beta similarity score:

1. **Canonical match candidates:** rows that may represent the same underlying coffee lot or identity. These require deterministic compatibility gates before embedding similarity can classify them as likely same.
2. **Similar coffee recommendations:** rows that are not identity candidates, but are useful substitutes, flavor neighbors, buying alternatives, or market comps.

PR #332 is an acceptable first visible increment: members can compare candidate rows, canonical price fields are present, and the UI has beta language. The next implementation step should correct the core semantics and the initial-load timeout before building durable identity tables.

## Why now

- Reed observed the key product flaw: a natural coffee is not a washed coffee. Embedding similarity can say they are related, but it must not make an identity claim when basic coffee facts conflict.
- The attached Supabase log shows `find_similar_beans_aggregated_v2` hit `canceling statement due to statement timeout` at `2026-05-06 02:40:26 UTC`. The query cross-joins target chunks against all matching chunks and orders after aggregation. That is too expensive for an on-demand UI action.
- Current `deriveMatchCategory()` treats `likely_same` as a soft score threshold: average >= 0.88, at least two chunk matches, origin >= 0.84, processing embedding >= 0.84. That is not enough. It uses semantic processing similarity, not deterministic processing compatibility.
- The current plan already contains calibration and identity-schema slices, but they assume the beta similarity contract is a reasonable substrate. Reed's feedback proves the substrate needs a hard-gated identity/recommendation boundary first.

## Strategy Alignment Audit

- **Canonical direction:** This strengthens `notes/PRODUCT_VISION.md` by making coffee intelligence more truthful. Matching should explain what Purveyors knows, what it merely suspects, and what it refuses to claim.
- **Product principle supported:** Truthful coffee data beats marketing copy. Similarity is allowed to be fuzzy; identity is not.
- **Cross-surface effect:** The classification rules should live in shared server logic and API output, then feed web, CLI, and agent consumers. The UI must not invent separate labels.
- **Public value legibility:** Member comparison becomes more trustworthy because it separates premium decision leverage into two lanes: same-coffee candidates and substitute recommendations.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-30-purveyors-proof-layer.md`, `2026-04-09-open-coffee-listing-standard.md`, and `2026-04-16-purveyors-copilot-network.md`. The proving slice is a trust-preserving identity classifier, not a full supplier proof passport or copilot workflow.
- **Scope check:** Excludes durable identity tables, scraper auto-linking, supplier claims, RFQs, and full canonical merged views until the similarity contract is fast and semantically safe.

## Audit of existing implementation plans

### Still valid

- `2026-05-04-canonical-green-coffee-matching.md` remains the right north-star program: similarity contract, member API, member UI, calibration, identity schema, scraper resolution, canonical merged view, then CLI/agent alignment.
- `pr-06-identity-schema-review-queue` is still necessary before accepted canonical identities exist.
- `pr-07-scraper-resolution-pipeline` is still the operational activation point and should stay conservative.
- `pr-08-canonical-merged-view` remains the full product payoff.

### Needs amendment

- `pr-04-threshold-calibration` should move earlier conceptually, but not as a standalone academic harness. First, the live contract needs hard gates and reason codes. Then calibration can tune thresholds against those gates.
- `pr-05-member-comparison-ui` shipped a useful first slice in PR #332, but the UI now needs better labels: `Likely same coffee candidate` only after hard gates pass; `Similar recommendation` when useful but not identity-safe.
- The existing plan's language around `likely_same` is too score-centric. It must become gate-first, score-second.

### Missing from the May 4 plan

- A performance slice for bounded candidate retrieval. The live timeout is not a UI bug; it is a query-shape problem.
- Explicit hard blockers for canonical identity claims.
- Response fields that explain why a candidate was downgraded from identity candidate to recommendation.
- A route/API contract that can return both sections separately without making clients infer semantics from score bands.

## Proposed behavior

### Classification model

Every returned row should include a classification object similar to:

```ts
type MatchKind = 'canonical_candidate' | 'similar_recommendation';
type IdentityEligibility = 'eligible' | 'blocked' | 'insufficient_evidence';

interface MatchClassification {
	kind: MatchKind;
	identity_eligibility: IdentityEligibility;
	confidence: 'high_beta' | 'medium_beta' | 'low_beta';
	blockers: Array<{
		code:
			| 'processing_base_method_conflict'
			| 'fermentation_type_conflict'
			| 'country_conflict'
			| 'decaf_conflict'
			| 'blend_single_origin_conflict'
			| 'harvest_year_conflict'
			| 'insufficient_structured_process';
		severity: 'hard' | 'soft';
		target_value: string | null;
		candidate_value: string | null;
	}>;
	evidence: string[];
}
```

### Hard gates for identity eligibility

Initial gates should be conservative:

- **Processing base method:** when both sides have `processing_base_method`, they must match for canonical identity. `Natural` and `Washed` is a hard blocker.
- **Fermentation type:** when both sides have explicit and incompatible fermentation types, block identity unless taxonomy says one is a parent/unknown value.
- **Decaf:** decaf and non-decaf should not be identity candidates.
- **Blend vs single-origin:** if detectable, blends should not be identity candidates for single-origin lots.
- **Country:** conflicting known countries should block identity. Missing country is insufficient evidence, not a hard false.
- **Harvest year / crop year:** when present and incompatible, block identity. When missing, do not block yet.
- **Structured process missing:** if processing fields are absent on either side, do not promote to high-confidence identity solely from embedding score. Return `insufficient_evidence` unless other high-confidence fields are available.

These gates do not remove a row from recommendations. They only prevent an identity claim.

### Similar recommendation model

A coffee can still be recommended when it fails an identity gate. Example: a washed Colombia can be a useful alternative to a natural Colombia for some browsing contexts, but the UI/API should label it as a **similar recommendation**, not a same-coffee candidate.

Recommended copy direction:

- Canonical candidate: `Likely same coffee candidate. Basic identity checks passed; verify supplier details before acting.`
- Similar recommendation: `Similar profile, not a same-coffee claim. Useful for substitution or market comparison.`
- Blocked identity: `Similar, but not the same coffee: processing method differs.`

### API shape

`GET /v1/catalog/:id/similar` should return grouped data:

```json
{
	"target": {},
	"groups": {
		"canonical_candidates": [],
		"similar_recommendations": []
	},
	"matches": [],
	"meta": {
		"classification_version": "canonical-match-v1",
		"query_strategy": "bounded-vector-candidates-v1"
	}
}
```

Keep `matches` for backward-compatible client iteration if useful, but make `groups` the preferred UI contract.

## Performance correction

The timeout query cross-joins target embeddings with candidate chunks and evaluates vector distance across the full matching chunk set before aggregation. Replace that with bounded candidate retrieval:

1. Fetch target embeddings for `origin`, `processing`, and `tasting`.
2. For each target chunk, use a lateral vector search ordered by distance with a bounded candidate pool, for example `LIMIT greatest(match_count * 40, 200)` capped to a safe maximum.
3. Aggregate only that candidate pool by coffee id.
4. Apply threshold and stocked filters after candidate retrieval where truthful.
5. Keep `count_similar_beans_aggregated_v2` separate and cheap, or return `null`/estimated teaser counts if exact counts require expensive full scans.

This keeps the UI on-demand fetch compatible with pgvector indexes and avoids full-table vector work on every first load.

## Program sequence

1. **PR 01: Bounded hard-gated similar API**

   - Fix query performance and classify identity candidates vs similar recommendations with explicit blockers.
   - Update API tests and current member UI labels enough to consume the new fields.
   - This is the recommended next implementation target.

2. **PR 02: Calibration golden set and copy audit**

   - Build a small fixture of known same, known not-same, and useful-similar pairs.
   - Tune thresholds only after hard gates exist.
   - Verify label copy does not overclaim identity.

3. **PR 03: Identity candidate review foundation**

   - Add durable candidate/rejected/accepted state only after the classifier is fast, gated, and calibrated.
   - Include review/audit events and rejected-candidate memory.

4. **PR 04: Scraper candidate proposal pipeline**

   - Let scraper propose candidate links post-ingestion without mutating canonical catalog rows.
   - Respect rejected candidates and only auto-link if calibration later supports it.

5. **PR 05: Canonical merged view**

   - Build accepted identity view and tiered cross-supplier comparison once accepted identities exist.

6. **PR 06: CLI and agent alignment**
   - Move `purvey catalog similar` and agent tools to the same classification contract.

## Acceptance criteria

### Program-level

- Same-coffee labels require deterministic compatibility gates, not embedding score alone.
- Similar recommendations remain visible and useful even when identity is blocked.
- API, UI, CLI, and agent consumers share the same classification fields and reason codes.
- Initial-load timeout is fixed by bounded vector candidate search, not hidden by frontend retry behavior.
- Identity storage and scraper auto-linking do not start until hard gates and calibration exist.

### First PR

- `Natural` vs `Washed` with known structured process values cannot produce `canonical_candidate`.
- Conflicting known countries cannot produce `canonical_candidate`.
- Missing structured process data yields `insufficient_evidence` rather than a high-confidence identity claim.
- Similar but blocked rows still appear under `similar_recommendations` with blocker reasons.
- The on-demand similar endpoint no longer runs the full cross-join aggregation path that timed out.
- Route/unit tests cover hard blockers, insufficient evidence, grouped output, and successful canonical candidate classification.

## Test plan

- Unit tests for `classifyCatalogMatch()` or equivalent:
  - natural vs washed hard blocker
  - same processing base method eligible path
  - country conflict hard blocker
  - missing structured process insufficient evidence
  - blocked identity still recommendation-eligible
- SQL or route tests for bounded candidate retrieval:
  - returns expected fields
  - respects `stocked_only`
  - honors `limit` without full-table aggregation
- Route tests for `/v1/catalog/:id/similar`:
  - grouped output exists
  - legacy `matches` order remains stable enough for current UI
  - invalid mode/threshold handling unchanged
- UI tests:
  - renders separate sections or badges for canonical candidates vs similar recommendations
  - displays blocker language for similar-not-same rows
- Live smoke after deploy:
  - load the same catalog comparison that previously timed out
  - verify first request returns without statement timeout

## Risks and rollback

- **Risk:** hard gates reduce likely-same recall. Accept that. False positives poison identity trust faster than false negatives hurt recommendations.
- **Risk:** bounded vector search can miss some distant-but-real matches. That is acceptable for on-demand UI and can be revisited with offline candidate generation.
- **Risk:** grouping response shape forces UI churn. Mitigate by keeping flat `matches` during transition.
- **Rollback:** keep the old score fields and current UI available; if v3 SQL misbehaves, route can fall back to v2 as similar-only with identity promotion disabled.

## Open questions for Reed

1. Should identity blockers be strictly hard for launch, or should the UI show an `ambiguous conflict` state when structured fields are low-confidence?
2. Should country mismatch always block identity, or should the first version allow regional data errors to become `needs review` rather than blocked?
3. Should similar recommendations be shown in the same drawer below canonical candidates, or as a separate tab so users do not conflate the two?
4. Should first PR prioritize API/server correctness only, or include the minimal UI section split in the same PR?
