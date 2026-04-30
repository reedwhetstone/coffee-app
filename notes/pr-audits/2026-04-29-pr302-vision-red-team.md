# PR #302 Vision Red-Team Review: Public Catalog Process Facets

**Date:** 2026-04-29  
**Repo:** `reedwhetstone/coffee-app`  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/302  
**Branch:** `feat/public-catalog-process-facets`  
**Head reviewed:** `d59ad15`  
**Reviewer:** OpenClaw red-team subagent

## Operator summary

VERDICT: ready_with_fixes  
P0: 0  
P1: 1  
P2: 1  
P3: 2  
NEXT_ACTION: patch_same_pr  
SCOPE_ASSESSMENT: too_broad  
VISION_ALIGNMENT: acceptable

## Merge recommendation

Do not merge PR #302 as-is. The core product choice is sound: show process facts publicly, gate process search leverage to members and paid API tiers. But the API docs still describe the old public query contract and explicitly document the now-gated process filters as available to anonymous/API callers. For an API-first, agent-friendly product, that is not a cosmetic issue. Patch the docs in the same PR, and preferably prune unrelated blog/plan formatting churn, then merge.

## First-principles product read

Purveyors is trying to become a coffee intelligence platform, not a generic catalog UI. The job is to turn fragmented supplier data into trustworthy sourcing decisions for roasters, developers, and eventually agents. The canonical vision in `notes/PRODUCT_VISION.md` is clear on three points that matter here:

- truthful coffee data beats marketing copy;
- API-first is product strategy, not implementation detail;
- public surfaces should prove value before the paywall, while gating should protect deeper workflow leverage.

From that frame, **gating process facets while still displaying process facts is coherent**. It is not arbitrary monetization friction if executed cleanly. The factual CoffeeCard display proves the dataset is real and improves trust. The ability to search across the catalog by structured process method, fermentation, additives, disclosure, and confidence is sourcing leverage. That belongs to member sessions and paid API tiers under ADR-005.

This is the right high-level direction. The danger is not the gate itself. The danger is shipping a half-explained contract where the UI, API, and docs tell different stories.

## Confirmed alignment wins

### 1. The core visibility vs leverage boundary is strategically correct

ADR-005 states that public/viewer surfaces should help users inspect the data asset, while members receive the tooling that speeds sourcing decisions. PR #302 now follows that model in code:

- `src/lib/server/catalogAccess.ts` introduces `CatalogAccessCapabilities` with `canUseProcessFacets` and `canViewPremiumFilterMetadata`.
- `src/routes/catalog/+page.server.ts` strips process facet params from unauthorized `/catalog` requests before calling `searchCatalog`.
- `src/routes/catalog/+page.svelte` renders working advanced process controls only when `data.catalogAccess?.canUseProcessFacets` is true.
- `src/routes/api/catalog/filters/+server.ts` withholds process facet metadata unless `canViewPremiumFilterMetadata` is true.
- `src/lib/server/catalogResource.ts` rejects unauthorized `/v1/catalog` process facet params before querying the catalog data layer.

That is the right architecture shape. It enforces the policy server-side instead of relying on Svelte conditionals.

### 2. CoffeeCard display remains public proof, which is right

The public catalog should not become a blank teaser. `src/lib/catalog/catalogResourceItem.ts`, `src/lib/catalog/processDisplay.ts`, and `src/lib/components/CoffeeCard.svelte` preserve factual process display while suppressing placeholder claims such as `None Stated`. That is aligned with ADR-004 and the product belief that transparency and provenance should improve trust.

This distinction matters: hiding process facts would make the product less credible. Gating process search is the more defensible boundary.

### 3. The implementation is API-conscious rather than web-only

The PR does not only hide controls in `+page.svelte`. It gates `/catalog`, `/api/catalog/filters`, and `/v1/catalog`, with tests covering anonymous, viewer, member/admin, API Green, and paid API paths in the main catalog resource layer. That is consistent with the API-first strategy in `notes/API_notes/API-strategy.md` and with the user concern about bypasses through direct URLs or machine callers.

## Findings

### P1: API docs still advertise now-gated process filters as public contract

**Status:** confirmed product/API contract defect  
**Why it matters:** This directly conflicts with API-first and agent-friendly positioning.

The code now says process facets are premium search leverage. The docs still say the opposite.

Evidence in `src/lib/docs/content.ts`:

- The Catalog API intro says: `Anonymous, viewer-session, and API-key requests all share the public catalog query surface`.
- The Query parameters section says: `Anonymous, viewer-session, and API-key requests all share the public query surface documented below`.
- That same parameter table lists `processing_base_method`, `fermentation_type`, `process_additive`, `has_additives`, `processing_disclosure_level`, and `processing_confidence_min` without noting that they require member session or paid API access.
- The Structured process filter edge cases section tells integrations to use the structured filters and includes unauthenticated curl examples such as `/v1/catalog?fermentation_type=Co-Fermented&has_additives=true&limit=25`.
- The Access mode comparison says anonymous and API-key `/v1/catalog` callers have the `Full public query surface`, which is now false for API Green and anonymous callers when process params are present.

The implemented behavior in `src/lib/server/catalogResource.ts` now returns `401` for anonymous process facet requests and `403` for viewer/API Green requests. That means the documentation is not merely incomplete; it teaches integrators and agents to call URLs that will fail.

**First-principles impact:** In an API-first product, docs are part of the interface. If the machine-readable or human-readable contract lies, the product feels less trustworthy than a normal web app bug because agents and developers will encode the wrong behavior.

**Required fix in this PR:** Update `src/lib/docs/content.ts` so the catalog docs separate:

- public/basic query surface;
- member/session process facet surface;
- API Green evaluation surface;
- API Origin/Enterprise paid process facet surface.

The structured process examples should include either a member-session framing or API-key tier caveat. The query table should mark process facet params as gated, not public.

### P2: The PR is broader than the product decision requires because it includes unrelated docs churn

**Status:** confirmed scope/signal issue, not a runtime defect

PR #302 is large partly because it includes feature code and tests. That is expected. But it also includes unrelated formatting or content churn in files that do not belong to the process-facet entitlement decision:

- `notes/blog/coherence-audits/2026-04-26.json`
- `notes/blog/source-map.md`
- `notes/blog/outlines/published/building-product-philosophy-into-codebase.md`
- `notes/blog/outlines/should-ai-chat-have-a-whiteboard.md`
- `notes/blog/outlines/which-moats-survive-ai-economy.md`
- `notes/implementation-plans/2026-04-29-parchment-intelligence-api-cli-bridge.md`
- `notes/implementation-plans/2026-04-29-process-transparency-backgeneration.md`

Most of this appears to be formatting churn, but it still expands the review surface and makes a strategic PR harder to reason about. It also increases merge-conflict risk in living planning documents.

**First-principles impact:** The product decision here is subtle. It needs a crisp PR boundary so reviewers can reason about whether Purveyors is monetizing the right thing. Mixing in unrelated blog/source-map churn makes the PR feel less intentional than the underlying code actually is.

**Recommended fix:** Revert unrelated blog and non-PR implementation-plan formatting from this PR unless those changes are intentionally part of the PR story. Keep the ADR-005 docs, implementation plan, audit reports, code, and tests.

### P3: API denial responses are not quite agent-friendly enough

**Status:** product polish concern

`src/lib/server/catalogAccess.ts` builds a `CatalogAccessDeniedNotice` that contains `deniedParams`, but the `/v1/catalog` error response in `src/lib/server/catalogResource.ts` collapses `AuthError` into only `error` and `message`. For humans, the message is enough. For agents and developer tooling, returning the denied parameter list would make remediation much clearer.

This is not a merge blocker because the status code and message are explicit. But if the strategic audience includes agents and integrations, error envelopes should preserve structured remediation data whenever the server already has it.

**Suggested follow-up or same-PR polish:** Include `deniedParams` and maybe `requiredCapability: 'canUseProcessFacets'` in the 401/403 JSON body for process facet denials.

### P3: Anonymous CTA copy can imply signup is sufficient when membership is the actual unlock

**Status:** copy clarity concern

In `src/routes/catalog/+page.svelte`, the non-member process-facet CTA says `Members unlock structured process filters`, which is good. But for anonymous users the button says `Create an account` and goes to `/auth`. A free viewer account still does not unlock the working filters under ADR-005.

This is not fatal because an account is a necessary first step, but the conversion loop would be crisper if the CTA said the unlock is member-level and either sent users to product comparison or used copy such as `Create an account, then compare member tools`.

## Strategic concerns checked and disposition

### Is gating process facets while displaying process facts coherent?

Yes. This is the right distinction. Data visibility proves the dataset exists. Search leverage is the thing users pay for. If Purveyors hid the process facts entirely, the public catalog would lose trust and become a weaker acquisition surface.

### Does this improve the public discovery funnel?

Mostly yes. Public CoffeeCards get more truthful and richer. Anonymous users can still discover by broad origin/process/name. The member CTA can be improved, but the funnel is directionally sound.

### Does this align with API-first and agent-friendly positioning?

The implementation mostly does. The docs currently do not. That is why this review is `ready_with_fixes` instead of `ready`.

### Does this create confusing differences between UI, `/api/catalog/filters`, `/v1/catalog`, and docs?

Yes, specifically docs versus implementation. UI and route behavior are now aligned. `/api/catalog/filters` and `/v1/catalog` are aligned on process facet gating. `src/lib/docs/content.ts` still advertises the old public process-facet contract and must be patched.

### Is this PR too broad?

The core code slice is appropriate. The total PR artifact is too broad because unrelated formatting churn is included. This does not make the feature wrong, but it weakens review quality and should be cleaned up if practical.

### Does it protect real premium value?

Yes. Structured process search is a reasonable premium leverage surface, especially once coverage improves. The PR avoids the worse version of monetization, which would be hiding factual fields and making the public catalog less credible.

### Would this still be right at 10x traffic?

Yes, with the docs fixed. At 10x traffic, the value ladder matters more: public pages need to be crawlable and trust-building, while high-intent users need obvious upgrade paths into decision speed. The current access model scales better than giving anonymous users an ever-growing advanced query builder.

## Validation notes

- `git diff --check origin/main...HEAD`: passed in the detached review worktree.
- Focused Vitest could not be rerun in this detached worktree because `node_modules` in the source checkout points at a missing worktree package path, causing `Cannot find module .../node_modules/vitest/vitest.mjs`. Prior verification at `notes/pr-audits/2026-04-29-pr-302-access-tier-reverify.md` reported the focused 9-file Vitest suite passed and `pnpm check` was blocked only by missing SvelteKit env exports.

## Final disposition

Patch same PR, then merge. The core product direction is right, but the API documentation mismatch is too important for an API-first product to ship knowingly.
