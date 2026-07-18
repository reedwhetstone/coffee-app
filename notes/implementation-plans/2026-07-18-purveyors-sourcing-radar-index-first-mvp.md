# Purveyors Sourcing Radar: Index-First MVP

**Status:** Proposed product MVP
**Date:** 2026-07-18
**Owning repositories:** `parchment-api`, then `coffee-app`
**Governing direction:** Product Vision, ADR-005, ADR-007, ADR-008, ADR-010, ADR-012, and the Parchment API ownership ADRs
**Strategy source:** [Purveyors Sourcing Radar proposal](https://github.com/reedwhetstone/second-brain/blob/main/brain/moonshots/2026-07-15-purveyors-sourcing-radar.md)
**Red-team:** `notes/pr-audits/2026-07-18-pr-482-sourcing-radar-red-team.md` (corrections from that audit are incorporated below)

## Executive decision

Build a five-PR, index-first Sourcing Radar MVP after the active Market Index publication is fresh and provenance-aware.

The MVP fulfills one complete customer promise: **Tell Purveyors what you need, and your dashboard and Parchment agent will surface the few current coffees across the market worth your attention.** It joins self-service sourcing intent to the existing deterministic brief-match and Parchment Market Index signal contracts, presents the result in a personalized dashboard, and lets the customer investigate it with Parchment or continue to the supplier.

Minimum describes the number of capabilities, not the completeness of the value proposition. This is a real paid product with passive measurement, not a qualification surface that asks customers to prove whether Purveyors helped them. It does not create another score, recommendation model, scheduler, external alert system, run-history product, CLI command, or procurement suite.

## Why this boundary changed

The July 15 proposal correctly identified a recurring brief as the strategic product. Deeper repository and market research changes the first build:

- Saved sourcing intent, deterministic matches, watchlists, dashboard context, market signals, Market Index reads, SDK methods, and CLI reads already exist. Rebuilding them would be duplicate work.
- Legacy aggregate publication is intentionally frozen. Current Parchment readers select the latest available snapshot and disclose `asOf`/`computedAt`, but do not reject stale evidence. A new buyer-facing surface cannot silently turn the latest stale row into a recommendation.
- The accepted publication recovery program already owns provenance deployment, cohort policy, transactional publication, shadow comparison, reader cutover, and rollback. Radar should depend on that trust bridge rather than absorb it.
- The smallest credible product is one canonical read, self-service PPI sourcing intent, a personalized dashboard module, and an Ask Parchment handoff. Recurrence and external delivery only become rational after product behavior shows that buyers repeatedly use the output to investigate or track coffee.

## External evidence and product implication

The research supports decision support but argues against a broad procurement product:

- The ICO's June 2026 report recorded a 17.4% intra-month trough-to-peak rebound in its composite price (the June monthly average still declined 2.8%) and a 13.3% monthly decline in US certified Arabica stocks. USDA's December 2025 outlook forecast record 2025/26 production, record consumption, and a fifth consecutive decline in ending stocks — but its June 2026 update forecasts a record 2026/27 Brazil crop, and surplus projections are now circulating. The durable "why now" is volatility and policy whipsaw (tariff churn with green coffee currently exempted, EUDR compliance landing December 2026), not one-directional scarcity. The useful product is monitoring and context, and it must stay useful in a falling market.
- FAO reported average world coffee prices up 38.8% in 2024 and called for greater market transparency. The Specialty Coffee Transaction Guide shows why a commodity benchmark is insufficient for specialty buying: price varies with quality, lot size, region, and country.
- In specialty green, a discount is frequently an age signal, not a bargain: importers merchandise dedicated past-crop and clearance sections precisely to move fading lots. Price evidence without crop/arrival context preferentially surfaces the inventory suppliers most want to offload. Radar therefore treats a price signal as an anomaly to verify against crop age and cup, never as standalone value.
- Royal, Cafe Imports, Genuine Origin, and Algrano expose materially different catalog, price, order, position, and logistics models. Cross-supplier normalization is the wedge — and it is currently unoccupied: the one direct precedent, Beanstock (2016), aggregated a dozen importers' spot lists with their consent and is defunct. Purveyors should not imitate supplier buying, financing, sampling, or logistics workflows.
- Algrano describes sourcing as a multi-stage discover, sample, purchase, and receive process. Radar can shorten discovery. It cannot replace sensory evaluation or supplier trust — and the sample request, not the purchase, is the observable unit of buyer intent.
- Vesper packages meaningful-change alerts and personalized market intelligence for industrial buyers at roughly $400+ per user per month — adjacent, not comparable. The software small roasters actually pay for starts lower: RoastLog at $29–$99 per month flat, Cropster small-shop packages from a free tier to roughly $79 per month, RoasterTools from $199 per month for wholesale operations. This suggests willingness to pay for decision leverage, but no roaster currently pays anything for third-party sourcing discovery, so Purveyors pricing is unvalidated category creation.

The durable value proposition is faster qualified discovery across fragmented suppliers. It is not perpetual market urgency, universal fair-price claims, or a green-coffee ERP. The compounding asset underneath it is the longitudinal, lot-level, cross-supplier price and lifecycle history that the publication program makes trustworthy; every scope decision here protects that dataset's continuity.

## Current-state reconciliation

### Already shipped and reused

- User-owned sourcing briefs and constrained criteria: `supabase/migrations/20260507_sourcing_briefs.sql` and `src/lib/procurement/sourcingBriefCriteria.ts`.
- Deterministic brief matching: `src/lib/procurement/sourcingBriefMatching.ts` and Parchment API `/v1/procurement/briefs/{id}/matches`.
- Active brief context in the dashboard, catalog, and chat.
- Parchment market signals for `price_drop`, `below_market`, and `value_quality`, plus movement and metadata reads.
- Parchment SDK procurement and market methods.
- CLI `market` reads and read-only `procurement list|get|matches` commands.
- Provenance schema and writer foundation, with publication recovery and activation planned in `2026-07-16-market-publication-recovery-and-activation.md`.

### Explicit non-duplication boundary

This program does not recreate work from PRs #354, #382, #383, #423, or #437. It does not modify the scraper, design a second publication builder, re-enable legacy aggregates, add another catalog ranking system, or finish the full May 5 procurement program under a new name.

## User and job to be done

**Initial user:** a specialty roaster or green buyer who repeatedly checks several supplier catalogs against a constrained need.

**Job:** “Remember what I am sourcing, monitor the current market against it, show me the few matching lots worth my attention, explain why, and help me investigate without restarting my search.”

The MVP owns the discovery and investigation loop: capture intent, surface relevant evidence, answer follow-up questions, and hand off to an existing watchlist or supplier workflow. Sampling, contracting, shipping, financing, inventory planning, and final purchase decisions remain in the buyer's existing workflow.

## What “index-first” means

Radar is a filtered decision view over the Parchment Market Index, not a new universal index number.

For one saved brief, the response:

1. applies the canonical brief criteria before pagination;
2. intersects matching catalog IDs with an accepted active market publication;
3. includes only existing `price_drop` and `below_market` evidence;
4. orders by the strongest existing signal rank, then a stable catalog-ID tie-breaker;
5. returns all applicable evidence, source URL, match reasons, publication identity, `marketAsOf`, `computedAt`, quality/freshness state, and limitations;
6. carries lot-age context on every indexed row — crop year and/or first-observed/arrival date where the catalog has them, and an explicit `ageContext: known | unknown` disclosure where it does not — because a price drop on an aging lot is clearance, not value;
7. never blends fields into a new opaque Radar score.

`value_quality` is excluded because its current supplier-stated score input is not a trusted Purveyors product metric. New-arrival events, newly matching lots, restocks, and delistings require comparison history and are deferred.

Publication freshness (below) and lot freshness are different problems. The gate guarantees the evidence is recent; the lot-age context guarantees the evidence is interpretable. Radar evidence copy is always "price anomaly — verify crop and cup," never "opportunity" or "deal."

## Freshness and trust gate

The endpoint has three states:

- `fresh`: the response is derived from the accepted active publication, passes its serving-quality policy, and is within the centrally configured maximum age. Launch candidate: 48 hours, returned in response metadata rather than hardcoded in clients.
- `stale`: current catalog matches may be shown as plain matches, but indexed opportunity rows are empty and recommendation language is suppressed.
- `unavailable`: no accepted active publication or required market evidence exists. No opportunity rows are returned.

Prototype code may be exercised against stale/unavailable fixtures, but the buyer-facing MVP remains disabled until the publication recovery program reaches its accepted reader/API cutover gate. Recurring delivery requires the later automatic-publication and continuity evidence. Radar does not weaken either gate.

## MVP scope

### In scope

- One read-only Parchment API/SDK contract for an owned brief.
- Self-service creation and refinement of one or more owner-scoped sourcing briefs for authenticated PPI customers, using the existing constrained criteria contract and cursor-paginated lifecycle list.
- A personalized Sourcing Radar module on the authenticated dashboard, bounded to five Radar reads per visit with on-demand detail for additional active briefs.
- An Ask Parchment action that opens the current brief and canonical Radar evidence in the existing chat workspace so the customer can compare lots, refine the need, and ask follow-up questions without reconstructing context.
- Existing watchlist/tracked-lot and supplier-source actions as the useful continuation from a Radar result. No new shortlist storage is required.
- Fresh, stale, unavailable, empty, and denied states.
- The existing Parchment Intelligence entitlement (`ppi_access`, the $39/month add-on). Radar is not a member-tier or public surface.
- Parchment-owned security hardening for `sourcing_briefs` and the client-writable `user_roles` escalation path before PPI self-service launches. Owner-scoped mutations must go through the reviewed canonical API contract and a service-owned entitlement source; direct Supabase REST bypass remains denied.
- Passive product analytics for exposure, Radar opens, result opens, Ask Parchment handoffs, supplier clicks, watchlist actions, brief refinement, and repeat use. Reuse durable product records where they already express the action; add a separate minimal Parchment-owned event contract and append-only sink for non-durable exposures and clicks before the product client depends on it.
- A limited product launch after the live gate: target five sourcing decision-makers with three as the floor, running eight to twelve weeks or timed to a heavy arrival season. Participants receive the actual product, not a separate research harness.

### Out of scope

- Email, Discord, SMS, webhook, push, or scheduled delivery.
- Stored Radar runs, week-over-week diffs, notification preferences, or cadence settings. The dashboard evaluates the current accepted publication on visit.
- CLI additions. Existing CLI/API reads are sufficient for internal and agent-assisted launch work.
- LLM ranking or invented evidence, autonomous actions, RFQs, supplier messages, or purchases. Parchment may explain and compare canonical Radar results but cannot change their order or facts.
- A new scoring model, `value_quality`, cup-score use, or a generalized recommendation engine.
- New price plans, checkout changes, public access, team workflows, exports, or integrations.
- Scraper changes or publication work already owned by the July 16 recovery program.
- A dashboard or Market Index redesign beyond the focused personalized Radar module.
- Mandatory customer disposition questionnaires, required source-verification chores, or concierge database seeding as the normal onboarding path.

### PPI self-service and security prerequisite

The current procurement and database contracts do not provide a coherent PPI-only product: the documented create contract is not PPI-session accessible, while direct owner writes through Supabase REST are broader than the intended product boundary and `user_roles` is client-writable. The MVP must fix that architecture instead of hiding it behind concierge seeding.

- Give an authenticated `ppi_access` owner a canonical, server-enforced create/list/get/update/deactivate path for their own constrained sourcing briefs.
- Keep identity derived from the authenticated principal; clients cannot choose or override `user_id`.
- Revoke authenticated `user_roles` INSERT/UPDATE/DELETE, including the current owner-update policy, or replace role checks with an equivalent non-client-writable entitlement source/security-definer capability function.
- Replace direct broad brief-write policies with policies or server functions that preserve existing member/admin behavior and allow the reviewed PPI owner contract without permitting raw REST bypass.
- Add two-step negative coverage proving that a PPI-only session cannot promote itself and cannot mutate another user's brief or bypass criteria validation.
- No service-role credential reaches the browser or ordinary coffee-app runtime.

This is core product infrastructure, not pilot administration. A user who pays for Parchment Intelligence must be able to tell the product what they are sourcing and refine it without operator intervention.

### Database migration ownership prerequisite

The shared Supabase migration ledger is still a legacy coffee-app responsibility even though the canonical backend and authorization boundary have moved to the private Parchment workspace. Before PR 2 or PR 3 merges Parchment-owned schema changes, complete the separate Parchment plan `docs/plans/2026-07-18-database-migration-ownership-transfer.md` through its guarded canary.

- Parchment becomes the single physical migration authority for the shared database.
- Historical applied versions remain immutable and are reconciled against production before cutover.
- Coffee-app stops authoring migrations and remains a thin BFF/reference client.
- Radar does not absorb the transfer or use a new coffee-app migration as a shortcut.

PR 1 is read-only and may be developed in parallel after the publication gate. PR 2 and PR 3 may be developed against fixtures, but neither can merge schema changes until the canonical Parchment migration path is operational.

## Strategy Alignment Audit

- **Canonical direction:** This turns the existing normalized catalog and Market Index into a trustworthy sourcing decision while preserving Parchment API as the intelligence owner and coffee-app as the reference client.
- **Product principle supported:** Data moat over feature sprawl. The slice composes shipped intent and evidence instead of adding another disconnected feature.
- **Cross-surface effect:** The canonical read, owner-scoped intent, and fixed product-event contracts live in Parchment API and SDK. The dashboard and Parchment chat consume the same result without recomputing ranking or freshness, and coffee-app emits analytics without owning their schema or persistence.
- **Public value legibility:** This is paid Parchment Intelligence workflow leverage. It does not expand the public proof surface or add a new price plan.
- **Moonshot check:** It graduates the July 15 Sourcing Radar proposal into the smallest complete personalized sourcing product.
- **Scope check:** It includes the agent explanation and investigation loop because that is part of the promise, while excluding external recurrence, new models, and procurement operations.

## Cross-repo ownership

- `coffee-scraper`: observes supplier truth. No Radar MVP changes.
- Existing market-publication recovery program: owns the active provenance-aware publication and its serving quality. Existing prerequisite, not respecified by these five PRs.
- `parchment-api`: owns the physical database migration ledger after the separate ownership transfer, brief-to-index composition, owner-scoped PPI intent contracts, authorization, ordering, freshness policy, entitlement, fixed Radar product-event contract and persistence, and SDK types.
- `purveyors-cli`: no MVP change. Existing procurement and market reads remain available.
- `coffee-app`: owns self-service intent UX, personalized dashboard presentation, Ask Parchment handoff, existing tracked-lot/source actions, and thin emission of canonical product events. It does not own event schema or persistence.

## Ordered implementation

### Prerequisite gate: accepted active market publication

Complete the applicable gates in `2026-07-16-market-publication-recovery-and-activation.md` through the versioned reader/API cutover. Confirm the market signal read is derived from the accepted active publication and exposes publication identity, quality, coverage, age, and methodology. Stop if that contract is not fresh and fail-closed.

**Earliest-start honesty:** the provenance foundation migration (`20260713_market_publication_foundation.sql`) was applied to production manually on 2026-07-18 after a sentinel check found it had been skipped while later migrations shipped — evidence for the recovery program's guarded release workflow (its PR 2), which remains unbuilt. The builder, automatic invocation, shadow-comparison evidence (≥10 runs over ≥14 days including a real failure/recovery), and reader cutover are also all unbuilt; the evidence clock starts with the first clean production `all` run against the new tables. This gate is a multi-PR program, not a checkbox. Do not recruit launch customers or promise a launch window until the cutover has a date; a customer waiting on frozen data is a burned customer.

This gate is valuable independently of Radar and is not respecified here. It is also not merely a prerequisite: the trustworthy publication history it produces is the compounding data asset the whole Radar thesis rests on.

### PR 1: Parchment brief Radar read plus SDK

Add `GET /v1/procurement/briefs/{id}/radar` and its SDK method. Reuse canonical brief matching and accepted Market Index signal evidence. Add no storage or writer. This is independently useful to API consumers even if the reference client never ships.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-01-parchment-read.md`.

### PR 2: Canonical PPI intent contract, authorization, and SDK

In Parchment API, secure the entitlement source and RLS boundary, expose owner-scoped create/list/get/update/activate/deactivate through the canonical server contract, and publish the complete SDK lifecycle. This slice is independently useful to every client because PPI intent no longer depends on coffee-app or direct Supabase writes.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-02-parchment-intent.md`.

### PR 3: Canonical Parchment product-event contract and SDK

In Parchment API, add the closed, privacy-minimized event-ingestion contract and append-only persistence required for non-durable Radar exposures and clicks. Reuse durable tracked-lot, brief, and chat records rather than duplicating their contents. Publish the fixed event union through OpenAPI and the SDK. This prevents the buyer-facing app PR from smuggling in backend authority or a second migration path.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-03-parchment-events.md`.

### PR 4: Coffee-app self-service intent UX and thin BFF

Consume PR 2 through the published SDK and add the lightweight authenticated setup/refinement experience. Coffee-app brokers the session and presents canonical results; it does not own authorization, validation, persistence, or migrations. This slice is independently useful because a PPI customer can maintain a real sourcing need and use existing matches before personalized Radar ships.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-04-coffee-app-intent.md`.

### PR 5: Personalized Radar dashboard and Parchment agent

Add the personalized dashboard module and focused Radar detail route, preserve the canonical evidence and honest stale/unavailable states, and provide source, tracked-lot, and Ask Parchment actions. Parchment receives the current brief and Radar evidence as structured context so it can explain and compare without inventing ranking or facts. Consume PR 3 for passive analytics around the natural workflow, not a mandatory validation questionnaire. This is the complete buyer-facing MVP.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-05-personalized-product.md`.

## Stop points

- After the prerequisite: stop if publication quality or freshness cannot support decision language.
- After PR 1: stop if the endpoint rarely produces eligible rows for realistic saved briefs, if lot-age context is mostly `unknown`, or if source comparability makes ordering misleading.
- After PR 2: stop if secure PPI intent cannot be expressed as one canonical API/SDK contract without coffee-app authorization or direct database writes.
- After PR 3: stop if useful passive analytics require arbitrary event payloads, sensitive sourcing content, or coffee-app-owned persistence rather than a small canonical Parchment contract.
- After PR 4: stop if the self-service product path cannot remain a thin client over the intent contract or becomes more complex than the sourcing need it captures.
- After PR 5 and the limited launch: refine or stop if behavior shows customers do not investigate, track, or revisit Radar results, or if internal evidence audits show the signal is surfacing clearance rather than useful discovery.
- Only plan external recurring delivery if the in-product workflow creates repeat value and customers ask to receive it without opening Purveyors.

## Limited launch and product checkpoints

Launch the actual product to five sourcing decision-makers, treating three as the operational floor, for eight to twelve weeks or across a heavy arrival season. Each customer creates and maintains a real sourcing brief, sees their personalized Radar in the dashboard, and can investigate it through Parchment, tracked lots, and supplier links. Research interviews may supplement the evidence, but there is no separate pilot harness and no requirement that customers validate Purveyors through a disposition questionnaire.

The product provides value first and generates checkpoints through natural use:

- **Data health:** accepted-publication freshness, eligible matches per brief, known lot-age coverage, source availability, and supplier-feed continuity.
- **Discovery:** dashboard Radar impressions, result opens, supplier-detail visits, and the share of surfaced lots that were not already tracked.
- **Investigation:** Ask Parchment handoffs and follow-up questions, tracked-lot/watchlist actions, and brief refinements prompted by the evidence.
- **Habit:** repeat Radar visits and repeat investigation behavior over the launch window.
- **Sourcing intent:** optional sample or quote-request evidence, captured through a fixed non-blocking action when the outcome is known or a supplemental launch interview checkpoint, distinguishes investigation from buyer intent. This is a measurement, not a required workflow or customer QA chore.
- **Business:** retained PPI usage and willingness to keep paying, supported by interviews rather than a checkout experiment.

Primary product falsifiers:

- Internal source reconciliation and optional customer feedback show that the evidence mostly surfaces past-crop clearance, stale inventory, or lots the customer already tracks.
- Customers see results but rarely open, investigate, track, or revisit them.
- The product cannot reliably produce current eligible results for realistic briefs.

Customer feedback remains useful but subordinate to the product:

- Optional “not relevant,” “already tracked,” or “past crop” feedback may improve relevance, but it is never required to use Radar.
- Source freshness should be monitored from the publication and subsequent observations wherever possible; do not make the customer perform routine data QA.
- Interviews ask whether Radar shortened discovery, improved a shortlist, or changed what the customer investigated.

The initial product direction is supported when multiple customers repeatedly investigate or track Radar-surfaced coffees, return to the workflow, and the launch evidence includes explicit sample or quote-request intent where available. Repeated passive investigation alone does not establish sourcing intent or recurring value. Exact numeric launch thresholds should be set after baseline traffic and match density are known; analytics are decision inputs, not a pretense of statistical certainty from five users.

## Program acceptance criteria

- Brief criteria are applied before pagination and before ranking.
- Web and SDK clients receive identical canonical evidence and ordering.
- Every indexed row carries source, observation/publication time, match reasons, signal evidence, limitations, and a Parchment-minted result token for bound result-level events.
- `stale` and `unavailable` states return no indexed opportunity rows and use no recommendation language.
- No client hardcodes or recomputes freshness, signal rank, or entitlement.
- Direct URL and API calls enforce ownership and Parchment Intelligence access.
- A PPI customer can create, view, refine, and deactivate their own constrained sourcing brief without operator intervention; identity and entitlement remain server-enforced.
- Deactivated briefs remain discoverable through an explicit status filter and can be reactivated after reload without a remembered object ID.
- A PPI-only session cannot promote itself through `user_roles`, mutate another user's brief, bypass criteria validation, or write through an unreviewed direct REST path; negative coverage proves the denial while preserving intended member/admin behavior.
- The authenticated dashboard presents a personalized Radar summary and full result, and Ask Parchment receives the same canonical brief and evidence context.
- The user reaches the supplier/source record in one action.
- Limited-launch evaluation distinguishes passive investigation/tracking from explicit sample or quote-request intent through a non-blocking optional action or supplemental interview checkpoint; sampling remains off-platform and is never required to use Radar.
- Useful customer actions rely on existing tracked-lot/watchlist and chat workflows rather than new procurement storage.
- Passive analytics distinguish exposure, investigation, useful action, and repeat use without requiring a customer questionnaire or persisting sensitive brief criteria/source payloads.
- No runtime in any repository adds a scheduler, external delivery side effect, new score, or recommendation-run history.

## Validation expectations

- Parchment API: focused unit/route tests for pre-pagination composition, freshness states, deterministic ordering, owner-scoped intent lifecycle including inactive discovery/reactivation, authorization, RLS/direct-REST denial, fixed event ingestion, event privacy/idempotency, and response shape; migration-path validation; package typecheck/build; OpenAPI and SDK fixture validation.
- Coffee-app: thin BFF and self-service intent UX tests with no direct database mutation; dashboard and route tests for fresh, stale, unavailable, empty, and denied states; structured Ask Parchment context tests; source/tracked-lot action and passive analytics tests; `pnpm check --fail-on-warnings` and lint.
- Live gate: one owned test brief against the deployed accepted publication, with evidence manually reconciled to its source lot and Market Index row.

## Risks and rollback

- **The signal surfaces past-crop clearance as value.** Importers discount lots primarily to clear aging inventory, so `price_drop` and cohort-relative `below_market` preferentially select the oldest coffee unless interpreted. Mitigation: lot-age context on every row, "verify crop and cup" language, internal source reconciliation, and optional past-crop feedback as a product falsifier.
- **Stale evidence appears actionable.** Fail closed in the API. The client cannot override freshness.
- **A price signal is mistaken for purchase advice.** Use “worth inspecting” language, show comparable evidence and limitations, and link to source verification.
- **Signal ordering hides relevant matches.** Keep the existing full matches path available and make Radar a separate view.
- **The endpoint becomes a second ranking system.** Reuse existing signal ranks only. No combined score.
- **The product collapses back into a research harness.** Analytics remain passive and customer feedback remains optional. Every customer-facing control must help the customer source, investigate, track, or refine intent.
- **Agent explanation drifts from evidence.** Parchment receives canonical Radar rows as structured context, cites their limitations, and cannot invent or reorder evidence.
- **Alert ambitions expand the MVP.** There is no cadence, external delivery, stored run, or notification preference model in the five PRs.
- **Supply-side: the feed itself is at risk, and the plan cannot be silent about it.** Importers are simultaneously the data source, competitors for the deal-discovery moment (their own portals and clearance pages), and the party able to break the feed unilaterally. Before launch: audit which of the scraped sources require authenticated sessions for the prices the index uses, classify each as public-page, gated, or consented, and set an explicit policy for gated sources (drop, seek consent, or accept documented exposure) — logged-in scraping is the one clearly losing legal posture post-hiQ. Product source-detail links send importers qualified traffic; treat that as the opening of a consent/partnership track, which is also the path to the two-sided moat the product currently lacks (Beanstock launched on importer opt-in).
- **Rollback:** disable the personalized Radar module, detail route, and Parchment handoff. The secure brief-intent contract, Parchment endpoint, existing brief matches, Market Index, dashboard, catalog, and CLI workflows remain useful.

## Deferred decisions

- Product label: “Sourcing Radar” versus “Sourcing Index.” Use Radar for the initial product and refine naming from customer comprehension.
- Final maximum-age threshold. Start from a 48-hour candidate and set it through the publication serving policy after observing real daily-run timing.
- Paid packaging and price. Test `$29`, `$49`, and `$79` monthly anchors in interviews only; do not build pricing until value is demonstrated. Evidence sets the band low: the suites small roasters pay for start at $29–$79, no roaster currently pays for third-party sourcing discovery, and Purveyors' own public anchor is a $9 add-on — $79 is the stretch probe, not the floor.
- External recurring brief format, delivery channel, diff storage, new/restock/delist events, CLI convenience command, and integrations.

## References

- [ICO Coffee Market Report, June 2026](https://www.ico.org/documents/cy2025-26/cmr-0626-e.pdf)
- [USDA Coffee: World Markets and Trade, December 2025](https://apps.fas.usda.gov/psdonline/circulars/coffee.pdf)
- [FAO: Adverse climatic conditions drive coffee prices to highest level in years](https://www.fao.org/newsroom/detail/adverse-climatic-conditions-drive-coffee-prices-to-highest-level-in-years/en)
- [Specialty Coffee Transaction Guide](https://www.transactionguide.coffee/en/home)
- [Specialty Coffee Transaction Guide reports](https://www.transactionguide.coffee/reports)
- [Royal Coffee offerings](https://royalcoffee.com/offerings/)
- [Cafe Imports offerings](https://www.cafeimports.com/north-america/offerings)
- [Genuine Origin](https://www.genuineorigin.com/)
- [Algrano roaster workflow](https://www.algrano.com/en/how-it-works)
- [Algrano Direct Sourcing Calendar 2026-27](https://algrano.com/learn/sourcing-calendar)
- [GreenSquare procurement tools](https://www.greensquare.co/tools/procurement)
- [Vesper pricing and intelligence jobs](https://vespertool.com/pricing)
- [Cropster resource planning](https://www.cropster.com/solutions/360-inventory-control/advanced-planning/)
- [Cropster packages](https://www.cropster.com/packages/)
- [RoastLog pricing](https://roastlog.com/pricing)
- [RoasterTools pricing](https://www.roastertools.com/pricing)
- [Covoya past-crop deals](https://www.covoyacoffee.com/deals/past-crop.html)
- [Sweet Maria's: green coffee freshness](https://library.sweetmarias.com/green-coffee-freshness-how-old-is-too-old/)
- [Daily Coffee News: Beanstock launch, 2016](https://dailycoffeenews.com/2016/06/02/green-coffee-aggregator-beanstock-makes-official-launch-following-scaa-success/)
- [Royal NY account and pricing FAQ](https://www.royalny.com/frequently-asked-questions/)
- [USDA Coffee: World Markets and Trade, June 2026 update](https://www.fas.usda.gov/data/coffee-world-markets-and-trade)
- [hiQ v. LinkedIn scraping analysis (Farella)](https://www.fbm.com/publications/what-recent-rulings-in-hiq-v-linkedin-and-other-cases-say-about-the-legality-of-data-scraping/)
