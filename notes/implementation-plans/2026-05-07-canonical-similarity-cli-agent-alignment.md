# Canonical Similarity CLI and Agent Alignment

**Date:** 2026-05-07  
**Status:** Proposed  
**Selected program:** Move `purvey catalog similar` and chat/agent similarity tooling onto the canonical `/v1/catalog/:id/similar` contract.  
**Recommended first PR:** `2026-05-07-canonical-similarity-cli-agent-alignment-pr-01-cli-canonical-similar-command.md`

## Feature or program

Purveyors just turned catalog similarity from a loose embedding score into a safer product contract: bounded query execution, deterministic identity gates, grouped `canonical_candidates` vs `similar_recommendations`, explicit blocker reasons, proof summaries, and classification metadata.

The CLI and chat tool still lag that contract. `purvey catalog similar` currently calls the old Supabase RPC path and returns a flat `SimilarBean[]` shape. The app chat tool imports the CLI schema/function and returns the same old score-oriented response. That creates exactly the drift the product vision says to avoid: the web/API knows when a coffee is a same-lot candidate vs a merely useful substitute, while CLI and agent consumers still see only semantic similarity.

This program closes the loop. The canonical similarity contract should be the shared machine contract across API, CLI, and app-owned agent tools.

## Why now

- `origin/main` now includes the canonical similarity API and the post-timeout fixes that made it product-safe enough to consume.
- PRs around proof projection, catalog access, and similarity calibration have strengthened `/v1/catalog` and `/v1/catalog/:id/similar` as the correct shared API surface.
- The CLI repo recently shipped proof output work, proving the right pattern: the CLI should consume canonical `/v1` response shapes, not recompute or fork web/API semantics.
- The next product risk is trust drift. Agents that recommend a natural coffee as a same-lot candidate for a washed target will lose credibility faster than a UI-only bug.
- This is smaller and more immediately compounding than starting a new procurement or supplier-network surface today.

## Product Vision + moonshot opportunity scan

### Active strategy themes

1. **Data moat as contract, not just collection.** The blog and product vision keep returning to the same point: software is replicable; normalized, trustworthy, longitudinal coffee intelligence is the moat.
2. **API-first is product strategy.** ADR-002 and `notes/API_notes/API-strategy.md` say external API, CLI, web, and agents should converge on shared machine contracts.
3. **CLI is first-class agent infrastructure.** `notes/PRODUCT_VISION.md` explicitly treats CLI commands, subpath exports, manifests, output modes, and error envelopes as agent-facing product surfaces.
4. **Proof before leverage, leverage behind access.** ADR-005 says public surfaces can prove value, while decision workflows and advanced query power should live behind membership or API tiers.
5. **Agent trust requires explicit boundaries.** Recent blog outlines on AI-first product and write-boundary safety reinforce that agents need inspectable reasoning and safe action boundaries, not opaque magic.
6. **Moonshots are useful when they have a concrete proving slice.** Procurement briefs, the copilot network, the open listing standard, and the proof layer are all strategically live, but today's best cheap proving slice is making the existing similarity intelligence agent-safe across surfaces.

### Candidate scoring: Product Leverage Index

| Candidate | Vision | Data moat / decision quality | Cross-surface | Public value / access ladder | Foundation unlock | Total | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Canonical similarity CLI and agent alignment | 5 | 5 | 4 | 2 | 3 | 19 | Highest immediate leverage because the API contract just shipped and downstream surfaces are now stale. |
| Supplier claim and direct-feed pilot | 5 | 4 | 4 | 3 | 3 | 19 | Moonshot-upside from the Open Coffee Listing Standard, but not a cheap independent slice yet; needs supplier workflow/product decisions. |
| Saved sourcing briefs and procurement recommendation seed | 5 | 4 | 4 | 2 | 3 | 18 | Strong, already planned on 2026-05-05; should follow once the recommendation substrate is trustworthy across CLI/API/agent surfaces. |
| Parchment Intelligence API + CLI bridge | 5 | 4 | 4 | 2 | 2 | 17 | High-value API product, but prior plan exists and it is less urgent than preventing current similarity contract drift. |
| Capability-gated proof query filters | 4 | 5 | 3 | 2 | 2 | 16 | Strong Proof Layer path, but CLI proof output and proof coverage just shipped; similarity alignment is the sharper next cross-surface fix. |
| V1 catalog summary projection | 4 | 3 | 4 | 3 | 2 | 16 | Useful API ergonomics, but less strategically decisive than aligning the new identity/recommendation boundary. |

**Selection:** canonical similarity CLI and agent alignment. It scores at the top, has a concrete first PR, consumes a contract that already exists, and directly protects agent trust.

## Strategy Alignment Audit

- **Canonical direction:** Aligns tightly with `notes/PRODUCT_VISION.md`: it strengthens the coffee data moat, improves roaster decision quality, increases web / CLI / API / agent consistency, and treats the CLI as a core product surface rather than a sidecar.
- **Product principle supported:** Supports the belief that API-first is product strategy and that machine consumers should receive the same structured intelligence as humans. It also supports the access-ladder distinction by consuming the server-enforced `/v1` route rather than bypassing it with direct RPC calls.
- **Cross-surface effect:** Strong. The selected program intentionally spans `/v1/catalog/:id/similar`, `purvey catalog similar`, CLI exports/types, manifest metadata, and coffee-app chat tools.
- **Public value legibility:** Moderate. The main benefit is trusted member/API/agent leverage, but clearer CLI examples and docs make the product's similarity intelligence easier to demonstrate publicly without exposing premium workflow power.
- **Moonshot check:** Informed primarily by `brain/moonshots/2026-04-16-purveyors-copilot-network.md`, with secondary support from `brain/moonshots/2026-04-30-purveyors-proof-layer.md`. The proving slice is not a new copilot. It is the lower-level contract that lets a future Buy Copilot distinguish same-lot candidates from merely useful substitutes and cite proof/blocked reasons. The Open Coffee Listing Standard and Procurement Brief moonshots remain important, but their next slices either already have plans or require more product decisions.
- **Scope check:** Excludes durable identity tables, supplier claim flows, procurement briefs, saved searches, RFQs, alerting, proof-score filters, and new public UI. The point is to finish the similarity contract propagation before building new decision surfaces on top of it.

## Scope in / out

### In scope

- Make `purvey catalog similar <id>` consume the canonical `/v1/catalog/:id/similar` contract when an API key or session-backed API call is available.
- Add CLI types for the grouped similarity response, classification object, blockers, proof summary, pricing, and score dimensions.
- Preserve enough legacy output compatibility for existing CLI users, while making the canonical grouped shape the preferred JSON response.
- Update CLI manifest/help/examples so agents can discover the canonical contract.
- Update coffee-app chat tool behavior to return the canonical classification contract instead of flat old RPC similarity rows.
- Keep access and rate-limit semantics server-owned by `/v1/catalog/:id/similar`.

### Out of scope

- New similarity SQL, new calibration thresholds, or changes to identity gates.
- Public catalog UI changes.
- Durable identity schema, review queue, or scraper auto-linking.
- Procurement recommendations or saved sourcing briefs.
- Supplier claim/direct feed work.
- New paid entitlement categories beyond the existing route capabilities.

## Proposed UX or behavior

### CLI

`purvey catalog similar 1182 --json` should default to a machine-readable canonical response shaped around grouped decisions:

```json
{
  "target": { "id": 1182, "name": "..." },
  "data": {
    "canonical_candidates": [],
    "similar_recommendations": [
      {
        "coffee": { "id": 1204, "name": "..." },
        "score": { "average": 0.83, "dimensions": { "origin": 0.91, "processing": 0.62, "tasting": 0.88 } },
        "match": {
          "category": "similar_profile",
          "classification": {
            "kind": "similar_recommendation",
            "identity_eligibility": "blocked",
            "blockers": ["processing_method_conflict"]
          }
        }
      }
    ]
  },
  "meta": {
    "classification_version": "canonical-match-v1",
    "query_strategy": "bounded-vector-candidates-v1"
  }
}
```

Human pretty output should clearly separate likely same-lot candidates from similar recommendations and show blocker language when a recommendation is not identity-eligible.

### Chat / agent tool

`find_similar_beans` should tell the model that the result separates same-lot candidates from recommendations. The tool should return blockers and proof summaries so the model can avoid saying two coffees are the same when deterministic gates disagree.

## Files or systems likely to change

### `purveyors-cli`

- `src/lib/catalog.ts`
- `src/commands/catalog.ts`
- `src/lib/manifest.ts`
- `src/program.ts`
- `tests/catalog.test.ts`
- `tests/exit-codes.test.ts` if error behavior changes
- README / docs command reference
- package version and release notes as appropriate

### `coffee-app`

- `package.json`
- `pnpm-lock.yaml`
- `src/lib/services/tools.ts`
- chat tool tests covering `find_similar_beans`
- docs copy if the tool/API behavior is documented in app docs

## API or data impact

- No new database tables or migrations.
- No new public endpoint required.
- Consumes the existing `GET /v1/catalog/:id/similar` route.
- Preserves server-side capability/rate-limit enforcement by avoiding direct client-side RPC calls for canonical behavior.
- May require a CLI minor or patch release before coffee-app can consume updated exports.

## Program rationale

This should be a two-PR program rather than one cross-repo mega-PR. The CLI can ship independently as a better product surface over the existing API. The app can then consume the released CLI contract and update the chat/agent tool without coupling two repos in one fragile branch.

## PR sequence, dependencies, and stop points

1. **PR 01: CLI canonical similar command in `purveyors-cli`.**
   - Adds canonical `/v1/catalog/:id/similar` client/types/output, command behavior, manifest/help/docs, tests, and version bump.
   - Stop point: terminal users and agents can call the canonical similarity contract from the CLI even if coffee-app chat never changes.
2. **PR 02: Coffee-app chat/agent similarity alignment in `coffee-app`.**
   - Bumps the CLI package after release, updates `find_similar_beans` tool description/schema/result normalization, and tests that chat output preserves canonical candidates vs recommendations plus blockers.
   - Stop point: web/API/CLI/chat agent surfaces speak the same similarity language.

## Acceptance criteria

### Program-level

- `purvey catalog similar <id> --json` exposes canonical candidates, similar recommendations, classification metadata, blockers, score dimensions, pricing, and proof summaries from `/v1/catalog/:id/similar`.
- Pretty output does not imply that all high-similarity coffees are same-lot candidates.
- API-key mode and session mode either both use the canonical route or fail with explicit instructions when canonical auth is unavailable.
- coffee-app `find_similar_beans` tool returns canonical grouped semantics and updates its model-facing description accordingly.
- Direct old RPC output is not the default agent-facing contract.
- Tests cover auth errors, malformed IDs, API error envelopes, grouped JSON output, pretty output, and chat tool normalization.

### Success signal after both PRs

An agent can ask for coffees similar to a target and correctly say: "These are likely same-lot candidates" vs "These are useful substitutes, but not identity-eligible because processing/country/identity gates disagree."

## Test plan

### CLI PR

- Unit tests for canonical response mapping and error envelope handling.
- Command tests for `catalog similar <id> --json`, `--pretty`, `--threshold`, `--stocked-only`, malformed IDs, auth failures, and API route failures.
- Manifest snapshot or assertion tests proving the command advertises canonical fields and examples.
- Manual smoke with `PURVEYORS_API_KEY` or `PARCHMENT_API_KEY` if available.

### Coffee-app PR

- Targeted tests for chat tool schema/description and result normalization.
- If the tool calls the internal service directly, tests should mock `fetchCatalogSimilarityMatches` and assert grouped output is preserved.
- If the tool imports CLI helpers, tests should assert the imported shape stays stable.
- `pnpm check --fail-on-warnings` when environment allows.
- Targeted vitest files around `src/lib/services/tools.ts` and any route/service adapter touched.

## Risks and rollback

- **CLI auth ambiguity:** Existing CLI catalog commands mix Supabase/session behavior and API-key behavior. The PR should prefer canonical API route behavior and fail explicitly rather than silently falling back to stale RPC semantics.
- **Breaking old JSON consumers:** Some users may expect a flat array. Mitigate with a compatibility flag or documented `data.similar_recommendations[]` migration path, but do not keep the old flat shape as the primary agent contract.
- **Cross-repo release sequencing:** Coffee-app cannot consume unpublished CLI exports. The first PR should include the version bump and release notes, then publish/tag before the second PR updates `@purveyors/cli`.
- **Overclaiming same-lot identity:** Pretty output and model-facing descriptions must avoid "same coffee" unless classification says `canonical_candidate`.
- **Rollback:** Revert CLI command to previous behavior or add a temporary `--legacy-rpc` fallback only if the canonical route proves unavailable. For coffee-app chat, restore the prior tool result shape while keeping the API route intact.

## Open questions for Reed before coding

1. Should CLI JSON default to the full canonical response object, or should it preserve a flat array by default and add `--grouped` / `--canonical` for the new shape? Recommendation: make canonical grouped JSON the default because agents are the primary surface.
2. Should `purvey catalog similar` retain direct Supabase RPC fallback for logged-in sessions, or should it require the canonical `/v1` path for all non-legacy usage? Recommendation: canonical route only for the primary path.
3. Should coffee-app chat tool call the internal `fetchCatalogSimilarityMatches` service directly, or consume a newly exported CLI helper after the CLI release? Recommendation: use shared CLI types/schema where useful, but keep server-owned business execution inside coffee-app to avoid HTTP self-calls.
4. Should pretty output show `canonical_candidates` first even when empty, or hide empty sections? Recommendation: show section headers in `--pretty` so the distinction is visible.

## Planning source notes

- `notes/MARKET_ANALYSIS.md` was not present on `origin/main`; this run used `notes/archive/legacy-product/MARKET_ANALYSIS.md` as the market-analysis fallback.
- Existing related plans were reviewed, including the 2026-05-04 canonical matching program and the 2026-05-06 disambiguation/performance amendment. This plan is a fresh downstream alignment pass now that the safer API contract has landed on `origin/main`.
