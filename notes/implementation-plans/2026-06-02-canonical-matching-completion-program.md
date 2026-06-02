# Canonical Matching Completion Program

**Date:** 2026-06-02
**Status:** Proposed
**Repo:** `coffee-app`
**Recommended first PR:** `2026-06-02-canonical-matching-completion-program-pr-01-cross-supplier-contract.md`

## Feature or program

Complete the canonical green coffee matching project inside `coffee-app` by moving from beta similar-coffee discovery to a source-aware, durable, reviewable canonical matching system.

The existing app already has the important first half: `/v1/catalog/{id}/similar`, member-gated comparison UI, bounded similarity lookup, deterministic identity gates, grouped `canonical_candidates` vs `similar_recommendations`, proof summaries, and beta copy. The remaining project is to make that contract explicitly cross-supplier by default, persist review decisions, expose accepted identities as product objects, and align app-owned agent tooling with the same semantics.

## Why now

- `notes/DEVLOG.md` now lists Canonical Green Coffee Matching as partially shipped through PRs #331, #332, #336, #347, #348, #349, #350, and #351. The unfinished slices are identity review foundation, scraper resolution pipeline support, canonical merged views, and CLI/agent adoption.
- Source search shows the current classifier uses country, processing, fermentation, decaf, blend, harvest-year, embedding score, and proof fields, but it does not yet make supplier/source identity explicit in the API contract.
- The product value is cross-supplier intelligence. Same-source near-duplicates can still be useful for data hygiene, but they should not be the default member sourcing result.
- Durable accepted/rejected decisions are the next unlock. Without persistence, every comparison remains an ephemeral beta observation and the system cannot learn from review outcomes.

## Strategy Alignment Audit

- **Canonical direction:** This aligns with `notes/PRODUCT_VISION.md`: Purveyors becomes green coffee supply-chain intelligence, not just browsing. Canonical matching turns normalized supplier rows into decision-ready sourcing objects.
- **Product principle supported:** Data moat over feature sprawl. This compounds catalog normalization, embeddings, proof summaries, price tiers, availability, and agent-safe contracts into one proprietary graph.
- **Cross-surface effect:** Strong. The canonical service shape should feed web, `/v1/*`, app chat tools, and later CLI/external agents without forked identity semantics.
- **Public value legibility:** Moderate to strong. Public users can see that matching exists, viewers can trust the underlying catalog/proof data, and members get the premium comparison and identity workflow.
- **Moonshot check:** Prior plans were informed by Proof Layer, Copilot Network, and Open Coffee Listing Standard moonshots. This completion pass selects the practical proving slice: source-aware canonical matching with review memory and accepted identity views. No new brain capture is needed; this is codebase planning.
- **Scope check:** Excludes supplier account workflows, external direct-feed publishing, procurement alerts, RFQs, fully automated purchasing, and cross-repo CLI release work. Coffee-scraper integration is represented only as the coffee-app intake/read contract; implementation in coffee-scraper should get its own repo plan when this app substrate lands.

## Scope in

- Make similarity and identity semantics explicitly source-aware.
- Default matching product surfaces to cross-supplier results while allowing same-source diagnostic inclusion where useful.
- Add durable `bean_identities`, identity links, review decisions, and audit events.
- Add member/API endpoints for accepted identity reads and candidate review actions.
- Upgrade the member comparison UI from ephemeral beta matches to an identity-aware comparison surface.
- Align coffee-app chat/tooling with canonical grouped output and blocker language.
- Provide an app-side candidate intake/read path that a later coffee-scraper pipeline can use without inventing schema.

## Scope out

- Direct code changes in `purveyors-cli` or `coffee-scraper`.
- Public identity pages.
- Supplier claim, verification, or certification language.
- Auto-linking without explicit conservative thresholds and review/audit controls.
- Rewriting or deleting `coffee_catalog` rows.
- Treating `cost_lb` as the new primary price contract.

## Proposed UX or behavior

- Member comparison defaults to cross-supplier matches: “Equivalent lots from other suppliers” and “Similar alternatives from other suppliers.”
- Same-source matches are hidden by default, with an optional diagnostic mode or copy such as “Include same supplier near-duplicates” only where the user intent is data cleanup.
- Every candidate explains whether it is:
  - an accepted canonical identity listing,
  - a candidate likely-same listing pending review,
  - a similar recommendation, or
  - blocked from identity by source/processing/country/decaf/blend/harvest evidence.
- Accepted identities show a merged profile with provenance-preserving fields, member listings, pricing spread, availability, and proof summary badges.
- Rejected candidates stay remembered so the system does not keep resurfacing a known false identity pair as an unreviewed candidate.

## Files or systems likely to change

- `src/lib/server/catalogSimilarity.ts`
- `src/routes/v1/catalog/[id]/similar/+server.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts`
- `src/lib/server/beanIdentity.ts` or equivalent new service
- `src/lib/server/beanIdentity.test.ts`
- `src/routes/v1/catalog/[id]/canonical/+server.ts`
- `src/routes/v1/bean-identities/[id]/+server.ts`
- `src/routes/api/catalog/identity-candidates/*` if review actions stay session/internal rather than stable v1
- `src/lib/services/tools.ts`
- `src/routes/api/chat/+server.ts`
- `src/lib/types/database.types.ts`
- `supabase/migrations/*_bean_identity*.sql`
- API/docs copy in `src/lib/docs/content.ts` where the contract is documented

## API or data impact

- Additive migrations only.
- `coffee_catalog.source` remains the current supplier/source discriminator unless a future scraper/app schema introduces a stable supplier id. This program should name the limitation clearly in code and docs.
- `/v1/catalog/{id}/similar` gains source-aware query behavior and response metadata without breaking existing grouped output.
- New identity endpoints are member/API-gated from launch.
- Accepted/rejected identity decisions are append-only/auditable.
- Non-member locked teasers remain non-sensitive and should not leak supplier/price match details.

## Program rationale

This should be a five-PR program. One mega-PR would mix query semantics, schema, API, UI, and agent behavior in a way that makes review fragile. Each slice below is independently mergeable and useful if later slices never land.

## PR sequence, dependencies, and stop points

1. **PR 01: Cross-supplier similarity contract**
   - Make source-aware matching explicit and default `/v1/catalog/{id}/similar` plus UI copy to cross-supplier results.
   - Stop point: the existing beta feature becomes truthful for the core sourcing use case even without identity persistence.

2. **PR 02: Identity candidate review schema and service**
   - Add reversible identity/link/event tables plus server helpers for candidate, accepted, rejected, and superseded decisions.
   - Stop point: the app can remember review decisions and prevent repeated false-positive identity work.

3. **PR 03: Canonical identity API and member comparison view**
   - Add accepted-identity read endpoints and upgrade the comparison panel to show accepted/candidate/rejected-aware states and merged identity summaries.
   - Stop point: members get a real identity-aware comparison product even before automation proposes candidates.

4. **PR 04: App agent/tool alignment**
   - Update coffee-app chat tools and model-facing instructions to return grouped canonical/similar output, source-aware blockers, and accepted identity fields.
   - Stop point: app-owned agents stop using stale flat similarity language.

5. **PR 05: Candidate intake contract for scraper pipeline**
   - Add an app-side internal/API-key-gated candidate proposal endpoint or service and tests so a later coffee-scraper PR can submit candidate pairs without schema drift.
   - Stop point: coffee-app is ready for scraper-generated proposals, but no cross-repo scraper change is required in this PR.

## Acceptance criteria

- Similar matching is explicitly cross-supplier by default.
- Same-source rows are either excluded from member sourcing output or labeled as same-source diagnostics, never blended into the default canonical-candidate story.
- Identity claims require deterministic compatibility gates plus source-aware eligibility.
- Accepted and rejected identity decisions persist with audit events.
- Accepted canonical identity reads preserve supplier-row provenance instead of overwriting catalog data.
- Member UI can distinguish accepted identity listings, pending candidates, similar recommendations, and identity-blocked rows.
- App chat/tool output uses the same categories and blocker language as the API/UI.
- The scraper-facing intake contract exists before coffee-scraper automation is built.

## Test plan

- Targeted unit tests for source-aware classifier behavior.
- Route tests for `/v1/catalog/{id}/similar` cross-supplier defaults, same-source opt-in behavior, entitlement failures, and grouped output stability.
- SQL smoke tests for identity link constraints and event append behavior when env permits.
- Unit tests for identity service helpers: create candidate, accept, reject, supersede, duplicate accepted-link prevention, rejection memory.
- Component tests for comparison UI sections and copy.
- Tool tests for `src/lib/services/tools.ts` preserving grouped categories and blockers.
- `pnpm check --fail-on-warnings`, `pnpm run lint`, and targeted vitest for touched files.

## Risks and rollback

- **Risk:** `source` is not a perfect supplier id. Mitigate by naming it `source`/`supplier_label` in the contract and leaving room for a future stable supplier key.
- **Risk:** excluding same-source rows hides useful duplicate cleanup signals. Mitigate with an explicit `include_same_source=true` or diagnostic mode, not by polluting default sourcing results.
- **Risk:** identity schema overfits the current classifier. Mitigate by storing versioned classifier snapshots plus stable top-level fields.
- **Risk:** premature auto-linking creates bad identities. Auto-linking stays out of this program until calibration earns it.
- **Rollback:** PR 01 can fall back to current grouped output by disabling source filtering. PRs 02-05 are additive; identity endpoints/tools can be disabled without removing catalog rows.

## Open questions for Reed

1. Should same-source rows be fully excluded by default, or included under a separate “same supplier diagnostics” section? Recommendation: exclude by default for member sourcing; add diagnostic opt-in later if needed.
2. Is `coffee_catalog.source` good enough as the first supplier discriminator, or should PR 01 also introduce a normalized supplier key derived from source? Recommendation: use `source` first, document the limitation, and avoid schema churn until scraper/app agree on stable supplier ids.
3. Should identity review actions be admin-only at first, or member-visible as feedback controls such as “not the same lot”? Recommendation: admin/internal first, member feedback later.
4. Should PR 05 expose a stable `/v1/*` endpoint for scraper candidate intake or keep it as an internal server service? Recommendation: internal service first unless coffee-scraper needs HTTP submission from outside the app runtime.
