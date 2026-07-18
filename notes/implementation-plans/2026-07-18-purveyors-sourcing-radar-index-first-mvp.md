# Purveyors Sourcing Radar: Index-First MVP

**Status:** Proposed validation program
**Date:** 2026-07-18
**Owning repositories:** `parchment-api`, then `coffee-app`
**Governing direction:** Product Vision, ADR-005, ADR-007, ADR-008, ADR-010, ADR-012, and the Parchment API ownership ADRs
**Strategy source:** [Purveyors Sourcing Radar proposal](https://github.com/reedwhetstone/second-brain/blob/main/brain/moonshots/2026-07-15-purveyors-sourcing-radar.md)
**Red-team:** `notes/pr-audits/2026-07-18-pr-482-sourcing-radar-red-team.md` (corrections from that audit are incorporated below)

## Executive decision

Build a two-PR, manual, index-first Sourcing Radar MVP after the active Market Index publication is fresh and provenance-aware.

The MVP answers one question for one saved sourcing brief: **Which current matches carry decision-worthy price evidence right now?** It joins the existing deterministic brief-match contract to the existing Parchment Market Index signal contract. It does not create another score, recommendation model, scheduler, alert system, run-history table, CLI command, or procurement suite.

This is a proving slice for the larger Sourcing Radar thesis, not the recurring product itself.

## Why this boundary changed

The July 15 proposal correctly identified a recurring brief as the strategic product. Deeper repository and market research changes the first build:

- Saved sourcing intent, deterministic matches, watchlists, dashboard context, market signals, Market Index reads, SDK methods, and CLI reads already exist. Rebuilding them would be duplicate work.
- Legacy aggregate publication is intentionally frozen. Current Parchment readers select the latest available snapshot and disclose `asOf`/`computedAt`, but do not reject stale evidence. A new buyer-facing surface cannot silently turn the latest stale row into a recommendation.
- The accepted publication recovery program already owns provenance deployment, cohort policy, transactional publication, shadow comparison, reader cutover, and rollback. Radar should depend on that trust bridge rather than absorb it.
- The cheapest credible value test is one manual read and one reference-client surface. Recurrence and delivery only become rational after buyers demonstrate that the output changes discovery behavior.

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

**Job:** “When I have a live sourcing need, show me the matching lots whose current price evidence is unusual enough to inspect, tell me exactly why, and let me verify the source.”

The MVP accelerates discovery only. Sampling, contracting, shipping, financing, inventory planning, and final purchase decisions remain in the buyer's existing workflow.

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
- One manual coffee-app route linked from existing active-brief cards.
- Fresh, stale, unavailable, empty, and denied states.
- The existing Parchment Intelligence entitlement (`ppi_access`, the $39/month add-on). Radar is not a member-tier or public surface.
- Source-detail clicks and a minimal pilot feedback capture.
- A concierge pilot after the live gate: target five partners with three as the floor, running eight to twelve weeks or timed to a heavy arrival season.

### Out of scope

- Email, Discord, SMS, webhook, push, or scheduled delivery.
- Stored Radar runs, week-over-week diffs, notification preferences, or cadence settings.
- CLI additions. Existing CLI/API reads are sufficient for internal and agent-assisted pilot work.
- LLM ranking, summarization, autonomous actions, RFQs, supplier messages, or purchases.
- A new scoring model, `value_quality`, cup-score use, or a generalized recommendation engine.
- New price plans, checkout changes, public access, team workflows, exports, or integrations.
- Scraper changes or publication work already owned by the July 16 recovery program.
- Dashboard or Market Index redesign.

## Strategy Alignment Audit

- **Canonical direction:** This turns the existing normalized catalog and Market Index into a trustworthy sourcing decision while preserving Parchment API as the intelligence owner and coffee-app as the reference client.
- **Product principle supported:** Data moat over feature sprawl. The slice composes shipped intent and evidence instead of adding another disconnected feature.
- **Cross-surface effect:** The canonical read lives in Parchment API and SDK. The web app consumes it without recomputing ranking or freshness.
- **Public value legibility:** The pilot is paid/member workflow leverage. It does not expand the public proof surface or change entitlements.
- **Moonshot check:** It graduates the July 15 Sourcing Radar proposal into the cheapest falsifiable product slice.
- **Scope check:** It excludes recurrence, agents, new models, and procurement operations until the manual workflow proves value.

## Cross-repo ownership

- `coffee-scraper`: observes supplier truth. No Radar MVP changes.
- `coffee-app` database/publication program: owns the active provenance-aware market publication and its serving quality. Existing prerequisite, not part of these two PRs.
- `parchment-api`: owns brief-to-index composition, ordering, freshness policy, entitlement, and SDK types.
- `purveyors-cli`: no MVP change. Existing procurement and market reads remain available.
- `coffee-app`: owns the reference-client route, source handoff, and pilot measurement.

## Ordered implementation

### Prerequisite gate: accepted active market publication

Complete the applicable gates in `2026-07-16-market-publication-recovery-and-activation.md` through the versioned reader/API cutover. Confirm the market signal read is derived from the accepted active publication and exposes publication identity, quality, coverage, age, and methodology. Stop if that contract is not fresh and fail-closed.

**Earliest-start honesty:** as of this plan's date the recovery program's provenance foundation is merged but not deployed to production (no workflow applies `supabase/migrations` to production yet), and its builder, automatic invocation, shadow-comparison evidence (≥10 runs over ≥14 days including a real failure/recovery), and reader cutover are all unbuilt. This gate is a multi-PR program, not a checkbox. Do not recruit pilot partners or schedule the pilot window until the cutover has a date; a recruited partner waiting on frozen data is a burned partner.

This gate is valuable independently of Radar and is not respecified here. It is also not merely a prerequisite: the trustworthy publication history it produces is the compounding data asset the whole Radar thesis rests on.

### PR 1: Parchment brief Radar read plus SDK

Add `GET /v1/procurement/briefs/{id}/radar` and its SDK method. Reuse canonical brief matching and accepted Market Index signal evidence. Add no storage or writer. This is independently useful to API consumers even if the reference client never ships.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-01-parchment-read.md`.

### PR 2: Coffee-app manual value test

Add one Parchment Intelligence–entitled route for an owned active brief, linked from the existing dashboard brief cards. The coffee-app slice must also make those owned active-brief cards available to authenticated PPI-only users; the current member-only dashboard query cannot be the discovery gate for a `ppi_access` product. Render evidence or an honest stale/unavailable state, hand the user to the supplier/source record, and capture the minimum pilot signals. This is the complete buyer-facing MVP.

Plan: `2026-07-18-purveyors-sourcing-radar-index-first-mvp-pr-02-reference-client.md`.

## Stop points

- After the prerequisite: stop if publication quality or freshness cannot support decision language.
- After PR 1: stop if the endpoint rarely produces eligible rows for realistic saved briefs, if lot-age context is mostly `unknown`, or if source comparability makes ordering misleading.
- After PR 2 and the pilot: stop if the behavioral threshold below is not met, or if partner-reported past-crop/already-known rates show the signal is surfacing clearance rather than value.
- Only plan recurring delivery if the manual workflow passes the value threshold and users ask to receive it without opening Purveyors.

## Pilot and proof threshold

Recruit toward five actual sourcing decision-makers, treating three as the floor rather than the design. Capture one live brief each and establish how they currently build a shortlist. Run Radar manually for eight to twelve weeks, or time the window to a heavy arrival season. Rationale: small roasters make roughly zero to one real spot decision per month (most volume moves on forward contracts), so a three-partner, four-week window plausibly contains three to six genuine buying decisions total — too few for any partner-count vote to mean anything.

Primary proof is behavioral, not a vote:

- Radar-surfaced lots the partner had not already found lead to source-detail visits **and explicit "sample" or "quote" dispositions within the freshness window**, for a majority of active partners. Sampling is the real unit of buyer intent in this market; a lead that never reaches a cupping table did not change discovery behavior.

Primary falsifier:

- the partner-reported past-crop/already-known rate. If the evidence mostly restates known lots or surfaces clearance inventory, the signal is inverted and the pilot fails regardless of engagement.

Secondary evidence:

- time from sourcing need to qualified shortlist;
- eligible indexed matches per active brief, and the share with known lot-age context;
- Radar-open to source-detail click-through;
- staleness-at-click: whether source price and availability still match at the moment the partner opens the source page (distinguishes "the signal is wrong" from "the feed is truthful but too slow");
- user-confirmed hours of catalog review avoided;
- willingness to pay tested as an interview hypothesis, not a checkout change.

The pilot fails if the output mostly restates obvious catalog matches, if stale/partial coverage dominates, or if sensory and logistics gaps prevent the evidence from changing discovery behavior.

## Program acceptance criteria

- Brief criteria are applied before pagination and before ranking.
- Web and SDK clients receive identical canonical evidence and ordering.
- Every indexed row carries source, observation/publication time, match reasons, signal evidence, and limitations.
- `stale` and `unavailable` states return no indexed opportunity rows and use no recommendation language.
- No client hardcodes or recomputes freshness, signal rank, or entitlement.
- Direct URL and API calls enforce ownership and Parchment Intelligence access.
- The user reaches the supplier/source record in one action.
- No runtime in any repository adds a scheduler, delivery side effect, new score, or run-history storage.

## Validation expectations

- Parchment API: focused unit/route tests for pre-pagination composition, freshness states, deterministic ordering, ownership, entitlement, and response shape; package typecheck/build; OpenAPI and SDK fixture validation.
- Coffee-app: server-load tests proving PPI-only owners receive active-brief discovery without granting Radar to members lacking `ppiAccess`, plus access/status mapping tests; component/route tests for fresh, stale, unavailable, empty, and denied states; source-link and event tests; `pnpm check --fail-on-warnings` and lint.
- Live gate: one owned test brief against the deployed accepted publication, with evidence manually reconciled to its source lot and Market Index row.

## Risks and rollback

- **The signal surfaces past-crop clearance as value.** Importers discount lots primarily to clear aging inventory, so `price_drop` and cohort-relative `below_market` preferentially select the oldest coffee unless interpreted. Mitigation: lot-age context on every row, "verify crop and cup" language, and the past-crop rate as the pilot's primary falsifier.
- **Stale evidence appears actionable.** Fail closed in the API. The client cannot override freshness.
- **A price signal is mistaken for purchase advice.** Use “worth inspecting” language, show comparable evidence and limitations, and link to source verification.
- **Signal ordering hides relevant matches.** Keep the existing full matches path available and make Radar a separate view.
- **The endpoint becomes a second ranking system.** Reuse existing signal ranks only. No combined score.
- **Alert ambitions expand the MVP.** There is no cadence, delivery, stored run, or preference model in either PR.
- **Supply-side: the feed itself is at risk, and the plan cannot be silent about it.** Importers are simultaneously the data source, competitors for the deal-discovery moment (their own portals and clearance pages), and the party able to break the feed unilaterally. Before the pilot: audit which of the scraped sources require authenticated sessions for the prices the index uses, classify each as public-page, gated, or consented, and set an explicit policy for gated sources (drop, seek consent, or accept documented exposure) — logged-in scraping is the one clearly losing legal posture post-hiQ. The pilot's source-detail deep links send importers qualified sample-request traffic; treat that as the opening of a consent/partnership track, which is also the path to the two-sided moat the product currently lacks (Beanstock launched on importer opt-in).
- **Rollback:** disable the reference-client link and endpoint feature flag. The existing brief-match, Market Index, dashboard, catalog, and CLI workflows remain unchanged.

## Deferred decisions

- Product label: “Sourcing Radar” versus “Sourcing Index.” Use Radar as the pilot label; validate comprehension before broader launch.
- Final maximum-age threshold. Start from a 48-hour candidate and set it through the publication serving policy after observing real daily-run timing.
- Paid packaging and price. Test `$29`, `$49`, and `$79` monthly anchors in interviews only; do not build pricing until value is demonstrated. Evidence sets the band low: the suites small roasters pay for start at $29–$79, no roaster currently pays for third-party sourcing discovery, and Purveyors' own public anchor is a $9 add-on — $79 is the stretch probe, not the floor.
- Recurring brief format, delivery channel, diff storage, new/restock/delist events, CLI convenience command, and integrations.

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
