# Sourcing Radar MVP PR 5: Personalized Dashboard and Parchment Agent

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Deliver the complete customer promise through a personalized dashboard, canonical Radar evidence, useful next actions, and an Ask Parchment investigation loop.

## Product promise

> Tell Purveyors what you need, and your dashboard and Parchment agent will surface the few current coffees across the market worth your attention.

This is the buyer-facing MVP. It is a product with passive analytics, not a qualification route that asks customers to validate whether Purveyors helped them.

## Why this slice comes now

PR 1 makes the evidence contract canonical. PR 2 makes the intent lifecycle canonical and API-enforced. PR 3 provides the canonical event contract. PR 4 gives PPI customers a thin self-service experience for the intent that drives Radar. This PR closes the loop: show the current result where the customer already works, let Parchment explain it without inventing facts, and connect it to existing supplier and tracked-lot actions.

## In scope

- A personalized Sourcing Radar module on the authenticated dashboard for `ppiAccess` owners with active briefs.
- A focused detail route, proposed as `/procurement/briefs/[id]/radar`, for the full canonical result.
- Dashboard summary copy such as “3 coffees worth inspecting across 2 suppliers,” derived from the canonical response and never shown for stale/unavailable evidence.
- Fresh result rows with lot identity, current price, brief-match reasons, eligible market-scoped signal evidence, lot-age context, source, publication freshness/quality, and limitations.
- Honest stale, unavailable, empty, denied, and upstream-error states.
- Existing tracked-lot/watchlist and supplier-source actions as useful next steps. Do not create a parallel shortlist store.
- An Ask Parchment action that opens the existing chat workspace with structured context containing the owned brief, canonical Radar rows, publication metadata, evidence, and limitations.
- Parchment may explain, compare, and help refine the sourcing need. It cannot invent evidence, change canonical ordering, or label an anomaly a deal.
- Passive product analytics for dashboard exposure, Radar open, result open, Ask Parchment handoff, supplier click, tracked-lot/watchlist action, brief refinement, and repeat use.
- Reuse durable records such as tracked lots, brief updates, and chat conversations as the source of truth for those actions. Send non-durable exposures and clicks through the canonical Parchment event contract shipped in PR 3; this PR does not add a coffee-app table, event schema, or migration.
- Focused tests and existing docs/copy alignment.

## Out of scope

- Mandatory disposition controls, required source-verification chores, or research questionnaires.
- Automatic email, Discord, webhook, SMS, push, or scheduled delivery.
- Stored Radar runs, week-over-week diffs, history charts, or notification preferences.
- New scoring, client-side ranking, freshness calculation, or LLM-generated recommendations.
- New sourcing criteria, public access, pricing, checkout, team workflows, exports, or integrations.
- RFQs, supplier messages, purchases, inventory writes, or autonomous actions.
- Dashboard or Market Index redesign beyond the focused personalized module.

## Customer workflow

1. The customer opens Purveyors and immediately sees a personalized Radar summary for their active sourcing need.
2. They inspect a short list of current matching coffees with clear reasons, price evidence, crop-age context, provenance, and limitations.
3. They ask Parchment to compare candidates, explain the evidence, or help refine the brief without reconstructing context.
4. They continue through an existing useful action: track the lot or open the supplier record.
5. On later visits, Radar evaluates the latest accepted publication against the current brief. No scheduler or external alert is required for the MVP.

The customer receives value from every step. Analytics observe the workflow; they are not the workflow.

## UX invariants

- The dashboard leads with the buyer's need and the current result, not with pilot language or requests for validation.
- Use “worth inspecting” and “price anomaly — verify crop and cup,” never “deal,” “opportunity,” or purchase advice.
- Freshness, publication date, source, evidence, lot-age context, and limitations are visible without opening a secondary panel.
- `stale` and `unavailable` states never render recommendation-style cards. They explain why indexed evidence is withheld and may link to plain catalog matches.
- A row with `ageContext: unknown` says so where the buyer will see it.
- One action reaches the canonical supplier/source record; one action opens Ask Parchment with structured context.
- No UI or chat code recalculates score, rank, age, freshness, or entitlement.

## Analytics checkpoints

- **Data health:** eligible results, known lot-age coverage, publication freshness, and source availability.
- **Discovery:** dashboard exposure, Radar opens, result opens, and supplier clicks.
- **Investigation:** Ask Parchment handoffs/follow-ups, tracked-lot actions, and brief refinements.
- **Habit:** repeat Radar visits and repeat investigation behavior.
- **Optional feedback:** “not relevant,” “already tracked,” or “past crop” may be added only if it helps the customer tune the product. It is never required and is not the primary success mechanism.

Analytics payloads contain fixed event names and identifiers only where required. They do not persist brief criteria, source payloads, chat text, or other customer-entered content.

## Likely files

- `src/routes/dashboard/+page.server.ts`, `src/routes/dashboard/+page.svelte`, and focused tests
- `src/routes/procurement/briefs/[id]/radar/+page.server.ts`
- `src/routes/procurement/briefs/[id]/radar/+page.svelte`
- existing chat action/context handoff modules and tests
- existing tracked-lot/watchlist action integration
- a thin BFF/SDK call to the fixed Parchment event contract from PR 3, with no browser database write path
- dependency/lockfile updates only if the Parchment SDK release requires them

## Acceptance criteria

- A PPI-only owner with an active brief sees a personalized Radar summary on the dashboard and can open the full result; Mallard membership is not required.
- A member/admin without `ppiAccess` retains existing brief/catalog behavior but does not receive Radar.
- Another user, anonymous user, and insufficiently entitled user receive the correct server-enforced state.
- Fresh rows render canonical evidence and the correct supplier/tracked-lot actions.
- Stale, unavailable, empty, denied, and upstream-error fixtures have distinct, truthful UI.
- No recommendation-style card renders unless the API status is `fresh`.
- Ask Parchment receives the correct owned brief, canonical rows, publication metadata, and limitations, and its tool path cannot mutate ordering or evidence.
- Passive analytics distinguish exposure, investigation, useful action, and repeat use without requiring a customer questionnaire or persisting sensitive content.
- Existing dashboard, catalog brief matches, Market Index, tracked lots, and unrelated chat behavior remain unchanged.
- Keyboard, screen-reader, mobile, loading, and reduced-motion behavior meet existing route standards.

## Test plan

- Dashboard and server-load tests for PPI personalization, ownership, entitlement, fresh, stale, unavailable, empty, and upstream failure.
- Component tests for evidence, source/tracked-lot actions, limitations, keyboard use, and mobile layout.
- Structured Ask Parchment context tests, including stale/unavailable suppression and evidence fidelity.
- Analytics client tests for the fixed PR 3 event shape and exclusion of sensitive fields; persistence and append-only behavior remain covered by Parchment.
- Regression coverage for existing dashboard, Market Index, tracked-lot, and chat workflows.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.
- One post-deploy smoke with an owned test brief and manual source reconciliation performed internally before customer exposure.

## Risks and rollback

- **Risk:** the surface overstates price evidence. Preserve API vocabulary, comparable context, crop-age disclosure, and limitations.
- **Risk:** chat turns deterministic evidence into confident fiction. Pass structured canonical context and constrain the tool response to explanation/comparison.
- **Risk:** analytics becomes the product. Keep customer controls tied to sourcing utility and collect measurement passively.
- **Risk:** the dashboard becomes cluttered. Use one focused module with progressive depth into the detail route and chat.
- **Risk:** the feed goes partial or dark. Make stale/unavailable visibly different from “no matches,” and monitor feed health internally.
- **Rollback:** feature-disable the dashboard module, detail route, and Parchment handoff. The secure brief-intent flow, canonical Radar endpoint, existing matches, and current app workflows remain useful.

## Exact follow-on dependency

Launch after PR 4 is deployed and a PPI-only test account can create and maintain an owned active brief through the product path. Recruit five sourcing decision-makers, treating three as the operational floor, for eight to twelve weeks or across a heavy arrival season. Use passive product behavior, internal evidence audits, and supplemental interviews to refine relevance. Plan external recurring delivery only when repeat in-product use demonstrates value and customers ask to receive Radar without opening Purveyors.
