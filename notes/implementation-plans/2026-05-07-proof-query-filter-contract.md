# Proof Query Filter Contract

**Date:** 2026-05-07  
**Planning mode:** Planning only, no code changes in this PR  
**Selected improvement:** Add capability-gated proof query filters to `GET /v1/catalog` after the proof coverage endpoint in PR #335 lands.  
**Recommended shape:** One atomic coffee-app PR, dependent on PR #335 merge.  
**Recommended branch:** `feat/catalog-proof-query-filters`

## Problem description

Purveyors now exposes per-row proof summaries through `GET /v1/catalog?include=proof`, and coffee-app PR #335 is already open to add `GET /v1/catalog/proof-coverage` for aggregate proof coverage. The remaining platform gap is that proof summaries are visible but not queryable.

A buyer or agent can inspect whether a returned coffee has process, provenance, freshness, and pricing proof signals, but cannot ask the API for rows that satisfy those trust conditions. Worse, plausible query params currently look successful while doing nothing.

## Live API evidence, 2026-05-07

Commands used the live `PURVEYORS_API_KEY` from `~/.env`; the key value was not written into this plan.

- `GET /v1/catalog?include=proof&limit=5` with the API key returned `HTTP 200`, `pagination.total = 1071`, and rows containing `proof.version = "proof-summary-v1"` with `overall`, `families.process`, `families.provenance`, `families.freshness`, `families.pricing`, and limitations including `not_certification`, `raw_evidence_not_included`, and `supplier_verification_not_performed`.
- `GET /v1/catalog?include=wat&limit=2` returned `HTTP 400`, so the include contract now fails closed.
- `GET /v1/catalog/proof-coverage?stocked=true` returned `HTTP 404` in production, while open coffee-app PR #335 (`feat/catalog-proof-coverage-endpoint`) implements that endpoint with green checks and marks proof filters out of scope.
- `GET /v1/catalog?proof_process=disclosed&include=proof&limit=5` returned `HTTP 200` with `pagination.total = 1071`, the same total as the unfiltered proof request. This proves candidate proof-filter params are currently silent no-ops rather than validated contract.
- Anonymous `GET /v1/catalog?processing_base_method=Washed&limit=5` returned `HTTP 401` with `deniedParams: ["processing_base_method"]` and `requiredCapability: "canUseProcessFacets"`, showing the existing access-control pattern needed for proof filters.
- Invalid API-key auth returned `HTTP 401`, preserving fail-closed auth behavior.
- `GET /api/catalog-api?limit=25` returned `HTTP 200` with `Deprecation: true`, `Link: </v1/catalog>; rel="successor-version"`, and `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`, so legacy alias coverage must remain in tests.
- `purvey --version` is `0.14.0`, and `purvey auth status` reports unauthenticated in this cron environment. That does not block this API work, but it reinforces that agent workflows need reliable HTTP/API-key contracts rather than assuming local CLI session state.

## Root cause analysis

The current proof architecture is row-local and projection-oriented:

1. `include=proof` adds proof summaries after catalog rows are selected.
2. The API has no first-class proof predicate model for query validation.
3. ADR-005 capability gates exist for process facets, but no equivalent `canUseProofFilters` capability exists yet.
4. Unknown proof-looking params are ignored by the broader catalog query parser, so machine callers can mistakenly believe they filtered by disclosure quality.

This was the correct sequencing. Proof visibility needed to ship before proof search leverage. Now that row-level proof is real and proof coverage is being implemented in PR #335, the next useful platform slice is a narrow, validated, capability-gated proof query contract.

## Proposed fix

Add a small proof-query layer to `GET /v1/catalog` that validates and applies proof-summary predicates before pagination, while preserving public proof visibility through `include=proof`.

Suggested query vocabulary:

- `proof_overall=strong|partial|limited|not_available`
- `proof_min_families=1|2|3|4`
- `proof_process=disclosed|partial|not_available`
- `proof_provenance=identified|partial|not_available`
- `proof_freshness=recently_stocked|dated|not_available`
- `proof_pricing=tiered|listed|not_available`

The implementer should ship only labels that are already emitted by `proof-summary-v1` and can be filtered with truthful pagination. If one label family is not stable enough, omit it rather than creating fuzzy semantics.

## Scope in

- Add validated proof query params to the canonical `/v1/catalog` resource.
- Add a catalog capability such as `canUseProofFilters`.
- Permit proof filters for member/admin sessions and paid API tiers; deny anonymous, viewer, and API Green callers.
- Keep `include=proof` independent and still available for public proof inspection.
- Apply proof predicates before pagination, or otherwise return truthful `pagination.total`, `totalPages`, and row counts.
- Preserve `/api/catalog-api` delegation behavior until sunset.
- Update docs to distinguish proof visibility from proof search leverage.
- Add tests for valid, invalid, denied, and legacy-alias behavior.

## Scope out

- Proof coverage endpoint implementation; that is PR #335.
- New proof scores or new proof-summary labels.
- Saved searches, alerts, exports, Procurement Brief generation, or ranking/recommendation logic.
- Raw supplier evidence, `processing_evidence`, supplier quotes, certification, compliance, or verified-supplier claims.
- CLI implementation. This API contract should land first; CLI can follow once the HTTP behavior is stable.
- Broad unknown-query rejection across all catalog params. This PR should validate the new proof params without expanding into an API-wide strict-mode migration.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                             | Vision | Data moat / decision quality | Cross-surface | Public / access ladder | Foundation unlock | Total | Feasibility gate                                                                                                                                        | Decision     |
| ----------------------------------------------------- | -----: | ---------------------------: | ------------: | ---------------------: | ----------------: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Capability-gated proof query filters                  |      5 |                            5 |             4 |                      3 |                 3 |    20 | Medium. Depends on PR #335 merge and truthful pre-pagination filtering.                                                                                 | Selected     |
| Procurement Brief / saved sourcing brief follow-up    |      5 |                            5 |             4 |                      3 |                 3 |    20 | Already active in PR #354 (`feat/sourcing-brief-match-api`), so selecting it would duplicate in-flight work.                                            | Defer        |
| Canonical similar API CLI/agent alignment             |      5 |                            4 |             4 |                      2 |                 3 |    18 | Already covered by open planning PR #356.                                                                                                               | Defer        |
| Open Coffee Listing Standard direct-feed schema pilot |      5 |                            5 |             4 |                      3 |                 3 |    20 | Higher upside, but supplier/direct-feed behavior is too large for today's independently shippable API slice without a claimed-supplier pilot decision.  | Defer        |
| Public docs correction for CLI auth drift             |      3 |                            1 |             3 |                      2 |                 1 |    10 | Real friction: local CLI is unauthenticated despite workspace notes. But this is operational/docs hygiene, not the strongest product-leverage API move. | Defer        |
| Pure response-size/performance cleanup                |      2 |                            2 |             2 |                      1 |                 2 |     9 | Useful later. Does not beat trust/query leverage unless API latency or payload costs become acute.                                                      | Reject today |

## Strategy Alignment Audit

- **Canonical direction:** This aligns directly with `notes/PRODUCT_VISION.md`: truthful coffee data beats marketing copy, the data moat matters more than feature sprawl, API-first is product strategy, and public proof should graduate into paid decision leverage without forking behavior by surface.
- **API-first contribution:** The selected work makes proof semantics a shared platform contract in `/v1/catalog` rather than a web-only badge or caller-owned post-processing convention. API, web, CLI, and agent consumers can rely on the same labels and denial behavior.
- **Public value legibility:** Public users can already inspect proof summaries with `include=proof`. Proof filters turn that visibility into sourcing leverage, so gating them to member sessions and paid API tiers matches ADR-005's access ladder.
- **Cross-surface consistency:** The web catalog, `/v1/catalog`, `/api/catalog-api`, docs, and future CLI agent workflows can share one vocabulary: proof visibility is allowed broadly; proof search is a capability-gated query surface.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-30-purveyors-proof-layer.md`. The independently shippable API/platform proving slice is not the full disclosure passport product; it is the first paid query contract for proof-summary labels that already exist. `brain/moonshots/2026-04-07-procurement-brief.md` and `brain/moonshots/2026-04-16-purveyors-copilot-network.md` also remain relevant, but their current proving slices are already represented by PR #354 and planning PR #356. `brain/moonshots/2026-04-09-open-coffee-listing-standard.md` did not clear the bar today because supplier-direct publication needs a separate claim/feed pilot decision before API implementation.
- **Scope discipline:** This plan intentionally excludes proof coverage PR #335, supplier verification, raw evidence rooms, compliance claims, direct-feed publishing, saved briefs, sourcing recommendations, CLI changes, and broad API strict-mode cleanup.

## Specific files likely to change

- `src/lib/catalog/proofSummary.ts` if shared label predicates need exports.
- `src/lib/catalog/proofQuery.ts` for query parsing and row predicates.
- `src/lib/catalog/proofQuery.test.ts`.
- `src/lib/server/catalogAccess.ts` and `src/lib/server/catalogAccess.test.ts` for `canUseProofFilters`.
- `src/lib/server/catalogResource.ts` and `src/lib/server/catalogResource.test.ts`.
- `src/routes/v1/catalog/catalog.test.ts`.
- `src/routes/api/catalog-api/catalog-api.test.ts`.
- `src/lib/docs/content.ts` and `src/lib/docs/content.test.ts`.

If pre-pagination filtering cannot be implemented safely at the resource layer without loading too many rows, the implementer should stop and rescope to a database-queryable subset instead of filtering after pagination and returning misleading totals.

## Acceptance criteria

- Supported proof params are explicitly validated. Invalid labels return `HTTP 400` with the existing structured invalid-query shape.
- Anonymous, viewer, and API Green callers cannot use proof filters. They receive structured `401` or `403` responses with `requiredCapability: "canUseProofFilters"` and `deniedParams`.
- Member/admin sessions and paid API tiers can use proof filters.
- `include=proof` remains allowed independently of proof filters and preserves public proof visibility.
- Filtering happens before pagination, with truthful `pagination.total`, `totalPages`, `hasNext`, and row counts.
- `/api/catalog-api` preserves canonical behavior through delegation until the Dec. 31, 2026 sunset.
- Docs explain proof filters as disclosure-quality search tools, not certification, compliance, or supplier verification.
- Tests prove proof-filter requests do not expose raw evidence fields.

## Verification commands

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/catalog/proofQuery.test.ts \
  src/lib/server/catalogAccess.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/routes/api/catalog-api/catalog-api.test.ts \
  src/lib/docs/content.test.ts
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/proof-filter.headers \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&include=proof&limit=5' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '(.data | length > 0) and all(.data[]; .proof.families.process.label == "disclosed")'

curl -sS -o /tmp/proof-filter-invalid.json -w '%{http_code}' \
  'https://www.purveyors.io/v1/catalog?proof_process=magic&limit=5' \
  -H "Authorization: Bearer $API_KEY" \
  | grep -qx '400'

curl -sS -o /tmp/proof-filter-anon.json -w '%{http_code}' \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&limit=5' \
  | grep -Eq '401|403'
```

## Risk assessment

- **Pagination truth risk:** Filtering proof summaries after the current page would lie about totals. Mitigation: implement pre-pagination filtering or narrow the first PR to queryable labels only.
- **Capability drift risk:** Process facets, proof visibility, and proof filters could diverge in access semantics. Mitigation: centralize capability resolution and test direct API requests, not just UI controls.
- **Overclaiming risk:** Proof filters can sound like certification. Mitigation: docs and response limitations must keep the language to disclosure-quality signals.
- **Performance risk:** Proof predicates derived from helper output may require more row materialization than normal catalog filters. Mitigation: cap scope, reuse PR #335 coverage/query helpers where possible, and measure query cost before widening labels.
- **In-flight dependency risk:** PR #335 is open, mergeable, and green but not merged at planning time. Implementation should start after #335 merges or branch from it intentionally if Reed wants the chain accelerated.

## Stop points

- If PR #335 is not merged, do not implement proof filters on `origin/main` unless the implementation branch explicitly depends on `feat/catalog-proof-coverage-endpoint`.
- If truthful pre-pagination filtering requires a larger catalog query rewrite, stop and write a smaller follow-up plan for database-queryable proof labels.
- If label vocabulary has drifted from `proof-summary-v1`, update the proof summary contract first rather than adding filters over unstable labels.
