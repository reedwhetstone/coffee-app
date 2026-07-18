# Sourcing Radar MVP PR 4: Personalized Dashboard and Parchment Agent

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Deliver the complete customer promise through a personalized dashboard, canonical Radar evidence, useful next actions, and an Ask Parchment investigation loop.

## Product promise

> Tell Purveyors what you need, and your dashboard and Parchment agent will surface the few current coffees across the market worth your attention.

This is the buyer-facing MVP. It delivers the sourcing workflow directly and does not add a user-interaction tracking system or ask customers to validate the product through their clicks.

## Why this slice comes now

PR 1 makes the evidence contract canonical. PR 2 makes the intent lifecycle canonical and API-enforced. PR 3 gives PPI customers a thin self-service experience for the intent that drives Radar. This PR closes the loop: show the current result where the customer already works, let Parchment explain it without inventing facts, and connect it to existing supplier and tracked-lot actions.

## In scope

- A personalized Sourcing Radar module on the authenticated dashboard for `ppiAccess` owners that renders one independently identified summary for at most five owned active briefs per visit, using the deterministic PR 2 list order. Five matches the existing dashboard brief cap. Additional active briefs remain reachable through the cursor-paginated PR 3 brief-management surface and open their Radar detail on demand; the dashboard shows that continuation instead of issuing unbounded Radar calls.
- A focused detail route, proposed as `/procurement/briefs/[id]/radar`, for the full canonical result.
- Dashboard summary copy such as “3 coffees worth inspecting across 2 suppliers,” derived separately from each canonical response and never shown for stale/unavailable evidence.
- Fresh result rows with lot identity, current price, brief-match reasons, eligible market-scoped signal evidence, lot-age context, source, publication freshness/quality, and limitations.
- Honest stale, unavailable, empty, denied, and upstream-error states.
- Existing tracked-lot/watchlist and supplier-source actions as useful next steps. Do not create a parallel shortlist store.
- An Ask Parchment action that opens the existing chat workspace with structured context containing the owned brief, canonical Radar rows, publication metadata, evidence, and limitations.
- Parchment may explain, compare, and help refine the sourcing need. It cannot invent evidence, change canonical ordering, or label an anomaly a deal.
- Focused tests and existing docs/copy alignment.

## Out of scope

- Mandatory disposition controls, required source-verification chores, or research questionnaires.
- Automatic email, Discord, webhook, SMS, push, or scheduled delivery.
- Stored Radar runs, week-over-week diffs, history charts, or notification preferences.
- New scoring, client-side ranking, freshness calculation, or LLM-generated recommendations.
- New sourcing criteria, public access, pricing, checkout, team workflows, exports, or integrations.
- RFQs, supplier messages, purchases, inventory writes, or autonomous actions.
- Dashboard or Market Index redesign beyond the focused personalized module.
- New user-interaction analytics, event tokens, click/exposure tracking, watchlist attribution, event tables, or product-event APIs.

## Customer workflow

1. The customer opens Purveyors and immediately sees one personalized Radar summary for up to five active sourcing needs in deterministic order, with no implicit or arbitrary current-brief selection. If more active briefs exist, a continuation opens the cursor-paginated brief-management surface and Radar detail loads on demand for the selected brief.
2. They inspect each short list of current matching coffees with clear reasons, price evidence, crop-age context, provenance, and limitations.
3. They ask Parchment to compare candidates, explain the evidence, or help refine the brief without reconstructing context.
4. They continue through an existing useful action: track the lot or open the supplier record.
5. On later visits, Radar evaluates the latest accepted publication against the current brief. No scheduler or external alert is required for the MVP.

The customer receives value from every step. The MVP does not instrument those steps as a separate behavioral analytics product.

## UX invariants

- The dashboard leads with the buyer's need and the current result, not with pilot language or requests for validation.
- Use “worth inspecting” and “price anomaly — verify crop and cup,” never “deal,” “opportunity,” or purchase advice.
- Freshness, publication date, source, evidence, lot-age context, and limitations are visible without opening a secondary panel.
- `stale` and `unavailable` states never render recommendation-style cards. They explain why indexed evidence is withheld and may link to plain catalog matches.
- A row with `ageContext: unknown` says so where the buyer will see it.
- One action reaches the canonical supplier/source record; one action opens Ask Parchment with structured context.
- Each active brief keeps its own summary, detail route, Radar request, and Ask Parchment context; multiple active briefs cannot be collapsed or cross-wired.
- Each dashboard visit performs at most five Radar reads; additional briefs are paginated and loaded on demand rather than fanning out without a bound.
- No UI or chat code recalculates score, rank, age, freshness, or entitlement.

## Operational confidence checks

- **Data health:** eligible results, known lot-age coverage, publication freshness, and source availability.
- **Evidence quality:** internal reconciliation confirms surfaced price, availability, market scope, crop-age context, provenance, and source links against the accepted publication and supplier record.
- **Product usefulness:** structured customer interviews assess whether Radar shortened discovery, improved a shortlist, or changed what the buyer investigated. These are launch conversations, not in-product tracking or required validation chores.

## Likely files

- `src/routes/dashboard/+page.server.ts`, `src/routes/dashboard/+page.svelte`, and focused tests
- `src/routes/procurement/briefs/[id]/radar/+page.server.ts`
- `src/routes/procurement/briefs/[id]/radar/+page.svelte`
- existing chat action/context handoff modules and tests
- existing tracked-lot/watchlist action integration
- dependency/lockfile updates only if the Parchment SDK release requires them

## Acceptance criteria

- A PPI-only owner with zero active briefs sees a truthful empty/setup state and no Radar summary.
- A PPI-only owner with one active brief sees exactly one summary and its matching detail route; Mallard membership is not required.
- A PPI-only owner with two to five active briefs sees exactly one summary per active brief, with each SDK request, detail route, and Ask Parchment handoff carrying the correct `briefId`.
- A PPI-only owner with more than five active briefs sees exactly five dashboard summaries in deterministic order plus a continuation to the paginated brief-management surface; additional Radar results load only when selected, and no brief is silently or arbitrarily substituted for another.
- A member/admin without `ppiAccess` retains existing brief/catalog behavior but does not receive Radar.
- Another user, anonymous user, and insufficiently entitled user receive the correct server-enforced state.
- Fresh rows render canonical evidence and the correct supplier/tracked-lot actions.
- Stale, unavailable, empty, denied, and upstream-error fixtures have distinct, truthful UI.
- No recommendation-style card renders unless the API status is `fresh`.
- Ask Parchment receives the correct owned brief, canonical rows, publication metadata, and limitations, and its tool path cannot mutate ordering or evidence.
- No new interaction analytics, event token, click tracking, watchlist attribution, event sink, or analytics persistence is introduced.
- Existing dashboard, catalog brief matches, Market Index, tracked lots, and unrelated chat behavior remain unchanged.
- Keyboard, screen-reader, mobile, loading, and reduced-motion behavior meet existing route standards.

## Test plan

- Dashboard and server-load tests for zero, one, two-to-five, and more-than-five active briefs, including the five-call fan-out cap, cursor continuation, per-brief identity, no cross-wiring, and no silent omission, plus PPI personalization, ownership, entitlement, fresh, stale, unavailable, empty, and upstream failure.
- Component tests for evidence, source/tracked-lot actions, limitations, keyboard use, and mobile layout.
- Structured Ask Parchment context tests, including stale/unavailable suppression and evidence fidelity.
- Regression coverage for existing dashboard, Market Index, tracked-lot, and chat workflows.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.
- One post-deploy smoke with an owned test brief and manual source reconciliation performed internally before customer exposure.

## Risks and rollback

- **Risk:** the surface overstates price evidence. Preserve API vocabulary, comparable context, crop-age disclosure, and limitations.
- **Risk:** chat turns deterministic evidence into confident fiction. Pass structured canonical context and constrain the tool response to explanation/comparison.
- **Risk:** the dashboard becomes cluttered. Use one focused module with progressive depth into the detail route and chat.
- **Risk:** the feed goes partial or dark. Make stale/unavailable visibly different from “no matches,” and monitor feed health internally.
- **Rollback:** feature-disable the dashboard module, detail route, and Parchment handoff. The secure brief-intent flow, canonical Radar endpoint, existing matches, and current app workflows remain useful.

## Exact follow-on dependency

Launch after PR 3 is deployed and a PPI-only test account can create and maintain an owned active brief through the product path. Recruit five sourcing decision-makers, treating three as the operational floor, for eight to twelve weeks or across a heavy arrival season. Use internal evidence audits and customer interviews to refine relevance. Plan external recurring delivery only after customers report recurring value and ask to receive Radar without opening Purveyors.
