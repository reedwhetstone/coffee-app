# PR #482 plan red-team: index-first Sourcing Radar MVP

**Date:** 2026-07-18
**Target:** PR #482 (`docs/sourcing-radar-index-first-mvp` at `8333b39`) — the Sourcing Radar MVP program plan and its two PR sub-plans
**Base:** `origin/main` at `d23751f`
**Mode:** plan red-team plus competitive-advantage and MVP-wedge analysis (codebase verification, external fact-check, deep market research)
**Final verdict:** Corrections required before merge

## Executive assessment

The plan's discipline is its best feature and mostly survives adversarial review. The two-PR boundary, the fail-closed freshness gate, the anti-bloat exclusions, the supersession bookkeeping, and the refusal to invent a second scoring system are all correct and consistent with ADR-005/007/008/010/012 and the product vision. Every "already shipped" claim that can be checked in this repo checks out: briefs, constrained criteria, deterministic local matching, dashboard/catalog/chat integration, the three signal types, and the absence of freshness rejection in today's readers are all real (`supabase/migrations/20260507_sourcing_briefs.sql`, `src/lib/procurement/sourcingBriefCriteria.ts:5-14`, `src/lib/procurement/sourcingBriefMatching.ts:47-71`, `src/routes/dashboard/+page.svelte:244-261`, `src/lib/server/marketIndex.ts:42-52`).

The competitive research also confirms the wedge is genuinely unoccupied: no current product does cross-supplier normalized spot-list discovery in the US/EU. The only true precedent, Beanstock (2016), aggregated a dozen importers' spot lists with their consent — and is dead. Cropster sold its marketplace (Hub → Vollers, 2021) and Era of We pivoted to EUDR compliance. The gap is real, and so is the graveyard.

Three things do not survive review. First, the plan's central evidence — `price_drop` and `below_market` — is a contaminated signal in specialty green: importers discount lots primarily to clear past-crop and aging inventory, so a Radar without crop-year/arrival context systematically surfaces the coffees buyers should avoid. The plan gates on _publication_ freshness but never addresses _lot_ freshness, which is the failure mode pilot partners will hit in week one. Second, the pilot as designed (three partners, four weeks, a 2-of-3 vote) cannot produce a decision-grade signal given how rarely small roasters make spot decisions. Third, the plan's risk register covers demand-side risks only; the supply side — account-gated scraping exposure and importer kill-switch risk over the very feed the MVP depends on — is absent entirely.

None of these kill the program. All three are cheap to fix in the documents before merge, and fixing them materially raises the pilot's chance of producing a truthful answer.

## What the plan gets right (verified)

- **Reuse inventory is accurate.** Briefs table with RLS, `is_active`, and manual-only cadence (`20260507_sourcing_briefs.sql:10,15`); closed-set versioned criteria with unknown-field rejection (`sourcingBriefCriteria.ts:125-131`); pure deterministic matching with injectable clock (`sourcingBriefMatching.ts:50`); active-brief cards on the dashboard (`dashboard/+page.server.ts:89-130`), catalog (`BriefMatchSection.svelte`), and chat prompt injection (`api/chat/+server.ts:540-551`).
- **The freshness diagnosis is correct.** `loadMarketIndexInsights` discloses `asOf`/`computedAt` and null-degrades on error but has no staleness gate (`marketIndex.ts:276,287-297`); nothing in the reader path rejects old evidence. Fail-closed is the right correction and matches ADR-012.
- **Excluding `value_quality` is right and already matches practice.** The UI deliberately displays only two of three signal types today (`marketIndex.ts:57`, `DISPLAY_SIGNAL_TYPES`).
- **External citations are essentially accurate.** ICO June 2026 (17.4% intra-month rebound, 13.3% US certified-stock decline), USDA December 2025 (record production and consumption, fifth consecutive ending-stocks decline), FAO +38.8% in 2024, SCTG differentiation findings, and the Algrano workflow all verify against primary or corroborating sources. Two exceptions are noted in P2-4.
- **API-first ownership split matches ADR-007.** Radar composition in parchment-api with coffee-app as a thin reference client is the architecture the ADRs demand.

## P1 findings

### 1. The core price evidence is contaminated by past-crop clearance, and the plan never addresses it

**Evidence:** Covoya operates a dedicated past-crop deals page; Sucafina merchandises a "discounted" category distinct from "fresh crop"; Green Coffee Collective discounts lots "nearing the end of their time on site… from a previous harvest"; Sweet Maria's documents cup degradation in aged greens. Discounting in specialty green is the standard mechanism for clearing fading inventory, and occasionally position-clearing ahead of new-crop arrivals — only sometimes genuine value.

**Failure scenario:** A brief for washed Ethiopia matches three lots flagged `price_drop`. All three are last-harvest lots an importer is clearing before fresh arrivals land. The pilot partner cups one, finds it baggy, and concludes the Radar recommends old coffee. Trust does not recover within a four-week pilot. `below_market` has the same defect: without a crop-age-adjusted cohort, "cheap for its segment" preferentially selects the oldest inventory in the segment.

**Correction (docs-level, cheap):** Add lot-age context to the PR 1 response contract — crop year and/or first-observed/arrival date where the catalog has them, and an explicit `ageContext: known | unknown` disclosure where it does not. Reframe evidence copy from "opportunity" to "price anomaly — verify crop and cup": the SCTG citation already in the plan is the argument for why price alone is insufficient. Add "signal surfaces past-crop clearance as value" to the risk register with a pilot measurement (partner-reported already-known/past-crop rate is currently a secondary metric; make it a primary falsifier).

### 2. The pilot cannot produce a decision-grade answer as designed

**Evidence:** Small roasters buy spot irregularly — most physical volume moves on forward contracts, with spot used for gap-filling; an individual small roaster may make zero or one real spot decision in any four-week window (Perfect Daily Grind, Covoya, Genuine Origin forward-buying guidance; Cafe Imports small-roaster planning). Concierge-MVP and design-partner practice (a16z, First Round, YC) treats ~5 partners as a floor and 10–20 as the range where patterns separate from personality; with n=3, "2 of 3" is consistent with true success rates from roughly 15% to 99%. Mid-July timing adds arrival-season bias: fresh Centrals are landing, fresh Brazil/Ethiopia mostly are not.

**Failure scenario:** Three partners × four weeks plausibly contains 3–6 genuine buying decisions total. One enthusiastic partner or one quiet month flips the verdict either way. The program's stop/go decision — whether recurrence and delivery are ever earned — rests on noise.

**Correction (docs-level):** Keep the concierge shape but change the arithmetic: (a) extend to 8–12 weeks or time the window to a heavy arrival season; (b) recruit toward five partners, treating three as the floor rather than the design; (c) replace the 2-of-3 vote with behavioral evidence as the primary threshold — a Radar-surfaced lot leading to a source-detail visit _and a sample request_ within the freshness window. Sampling is the real unit of intent in this market (buying is sample-gated everywhere; Beanstock's core action was the sample request). The existing disposition control already has the right options; the threshold should count sample/quote dispositions, not partner votes.

### 3. Supply-side risk is absent: the plan risks losing its data feed mid-pilot and never mentions it

**Evidence:** The entire risk register in all three documents covers demand-side and presentation risks (stale evidence, misread signals, scope creep). Nothing covers the feed. Several major importers gate live pricing behind approved accounts — Royal NY approves accounts via a trader phone call; Covoya requires an account for real-time pricing. Post-hiQ, scraping public pages is CFAA-safe but breach-of-contract claims survive, and logged-in scraping is the clearly losing posture (hiQ's own $500K judgment; the Ryanair line in the EU). Any importer can also unilaterally break the feed with bot-blocking or layout churn. Importers are simultaneously the data source, the competition for the deal-discovery moment (their own portals and clearance pages), and the party with kill-switch power.

**Failure scenario:** An importer notices referral traffic or a competitor's marketing, sends a C&D or silently blocks the scraper, and a third of the catalog goes dark during the pilot — indistinguishable, to a partner, from the product failing.

**Correction (docs-level):** Add a supply-side section to the program risk register: (a) audit which of the 40+ sources require authenticated sessions for the prices the index uses, and classify each as public-page, gated, or consented; (b) state the policy for gated sources (drop, seek consent, or accept documented exposure — silence is not a policy); (c) note that the pilot's source-detail deep links send importers qualified sample-request traffic, which is the opening for a consent/partnership track. Beanstock launched with a dozen importers' opt-in; consent is achievable and converts the largest threat into the two-sided moat the product currently lacks.

## P2 findings

### 4. The "why now" narrative and two pricing citations are stale or wrong

The macro citations are individually accurate but tell a 2024–25 scarcity story. As of July 2026 the forward story is different: USDA's June update forecasts a record 71.9M-bag 2026/27 Brazil crop, Rabobank projects a ~9.5M-bag arabica surplus, arabica futures whipsawed ~4% in a single mid-July session, green coffee is explicitly exempted from the new 25% US tariffs on Brazil (16 July 2026), and EUDR compliance lands 30 Dec 2026 (SMEs June 2027). The durable hook for Radar is volatility and policy churn — which favors monitoring — not rising prices. Separately, the plan's claim that "Cropster, RoastLog, and RoasterTools charge from roughly $95 or $129 per month" is wrong at the entry: RoastLog is $29/$59/$99 flat, Cropster's small-shop promo is $79/mo with a free tier, RoasterTools starts at $199/mo (not $95/$129), and Vesper (~$400+/user/mo) targets FMCG procurement teams, not roasters. Also note the ICO figure is an intra-month trough-to-peak rebound; the June _average_ declined 2.8% — the current phrasing invites misreading. **Correction:** reframe "why now" around volatility/whipsaw and the EUDR wall, fix the pricing sentence, and qualify the ICO figure.

### 5. Entitlement and price anchors are internally inconsistent

PR 1 gates on "existing Parchment Intelligence entitlement" — a real $39/mo / $350/yr Stripe add-on granted via `ppi_access` (`src/lib/server/billing/entitlements.ts:26,92`, `subscription/+page.svelte:77,84`) — while PR 2 describes a "member-facing manual Radar route," and membership (Mallard Studio) is a separate $9/mo role. These are different gates with a 4× price gap; the plan must name one. The deferred interview anchors ($39/$79/$99) also sit above the evidence: no roaster currently pays anything for third-party sourcing discovery, the whole-workflow suites they do pay for start at $29–$79, and Purveyors' own public anchor is a $9 add-on. **Correction:** state explicitly that Radar sits behind `ppi_access`, align PR 2's language, and move the interview anchors down to test the $29–$49 band (keeping $79 as the stretch probe, not the floor).

### 6. PR 2's "existing analytics event pattern" does not exist

The repo has analytics _page_ modules and API-usage accounting, but no client event-tracking helper — no `trackEvent`, no event bus, no product-analytics pipeline (verified by grep across `src/`). PR 2's "minimal events… using the existing event pattern" is therefore new telemetry surface, not reuse, and its scope estimate and privacy constraints ("no criteria in payloads") need to be written against that reality. **Correction:** amend the PR 2 plan to say a minimal pilot-event helper is being _introduced_, define where events land (server log table vs third party), and keep the existing no-criteria/no-free-text constraint.

### 7. Prerequisite status is understated; the pilot has no earliest-start reality check

The plan correctly makes the accepted-publication cutover a hard gate but presents it as if it were near. Per the recovery plan itself, the provenance foundation migration is merged but **not deployed to production** (the 2026-07-16 run failed with `relation "public.scrape_runs" does not exist`, and no workflow applies `supabase/migrations` to production), and the program still requires its builder, auto-invocation, ≥10 shadow runs over ≥14 days including a real failure/recovery, and the reader cutover. Recent history (PRs #478–#481) is docs/blog only. **Correction:** add an honest "earliest start" note — the gate is a multi-PR program with an undeployed foundation, so partner recruiting and pilot scheduling must not begin until the cutover has a date. This also strengthens the plan's own argument: the recovery program is not just a prerequisite, it is the moat (see below).

### 8. Publication freshness may still be too slow for the inventory that matters

The sharpest spot lots sell out quickly and the best allocations go to forward-committed buyers; a daily scrape plus a 48-hour acceptance window can be structurally late for exactly the "unusual evidence" lots Radar exists to surface, and the fail-closed gate may withhold much of the rest. This is not a reason to weaken the gate — it is a pilot measurement. **Correction:** add staleness-at-click (source price/availability still matches at the moment the partner opens the source page) to the secondary pilot metrics, so "the feed is truthful but too slow" is a distinguishable outcome from "the signal is wrong."

## P3 findings

### 9. Cross-repo claims are unverifiable from this repo and should be validated before PR 1 is estimated

Coffee-app computes brief matches locally (`briefMatchSummary.ts:22-48`); the plan's premise that parchment-api already owns `/v1/procurement/briefs/{id}/matches`, signal serving, and entitlement enforcement cannot be checked here (parchment-api is not in this workspace). PR 1's "every primitive already exists" claim should be re-verified in that repo before its scope is treated as small.

### 10. Superseding the shadow-recommendation stage forfeits a planned substrate, acceptably

PR-04 of the May 5 program (stored, ranked, explainable recommendation runs) never shipped — no `recommendations.ts` or run storage exists. What is lost is a planned design, not code, and the Radar slice tests the same product question more cheaply. The supersession note in PR 482 is accurate; no action beyond awareness that ranked-run persistence will need a fresh plan if the pilot passes.

## Competitive analysis: where the durable advantage actually is

**The gap is real.** No current product offers cross-supplier normalized spot-list discovery in the US/EU. Beanstock (2016) is the only true precedent — importer-consented aggregation of a dozen US spot inventories with cross-importer sample requests — and it disappeared without a trace. Greensquare (AU) is the closest living neighbor with consented multi-supplier ordering for ~200 Australian roasters. Directories and spreadsheets are the actual incumbent; importers themselves coach roasters to compare offer sheets manually.

**Ranked durable advantages for Purveyors:**

1. **Longitudinal, lot-level, cross-supplier price and lifecycle history.** Nobody else records it; SCTG is annual and FOB-level. This is the only asset that compounds and that a Cropster feature-copy cannot replicate quickly. It is currently shallow (~90 days) — the moat is time-gated, which makes publication continuity and provenance (the recovery program) the moat's manufacturing line, not merely a Radar prerequisite.
2. **Normalization schema quality** across 40+ heterogeneous offer sheets — hard, unglamorous, and accumulated.
3. **API-first distribution** — the only green-catalog API; small market, but real differentiation and agent-era leverage (ADR-006/007).
4. **Indie cost structure** — survivability at customer counts (tens, not thousands) that killed VC-backed attempts. Napkin SAM: ~2,000–4,000 US+EU roasters who regularly buy spot; 1–3% conversion ≈ 30–100 customers ≈ $15k–90k ARR at plausible prices. A fine indie outcome; the two-PR MVP is correctly sized to it.

**Weak or negative moats:** the scraper itself (a treadmill with legal exposure and unilateral kill-switch risk — see P1-3); network effects and switching costs (currently near zero; briefs plus roast/inventory history are embryonic). The defensible endgame the research points at is two-sided: consented importer participation exchanging listing/sample-request traffic for feed stability, layered on the history dataset.

**Biggest threats, ranked:** importer countermeasures/own-portal deal merchandising; Cropster or artisan.plus (which already has supplier data-import partners) adding a "new arrivals matching your wishlist" feature; the Beanstock/Hub graveyard pattern of thin aggregation demand; free substitutes for price context (SCTG, C-price, importers' own clearance pages); a Greensquare-style consented platform entering the US/EU.

## MVP verdict

The two-PR, index-first, manual, fail-closed shape is the right MVP — this red-team endorses the boundary. The wedge (cross-supplier qualified discovery) is directionally correct and unoccupied. The plan should merge after amendments that change what the MVP _says and measures_, not what it builds:

1. Evidence contract carries crop/arrival age context and anomaly-not-opportunity language (P1-1).
2. Pilot threshold becomes behavioral (source visit + sample request within the freshness window), over 8–12 weeks or an arrival season, with five partners targeted (P1-2).
3. Supply-side risk register plus a source-consent posture, with the pilot's deep links framed as the opening of an importer partnership track (P1-3).
4. Radar explicitly behind `ppi_access`; interview anchors moved to the $29–$49 band; "why now" reframed around volatility, tariff churn, and EUDR; pricing citations corrected (P2-4, P2-5).
5. PR 2 telemetry described as new minimal surface; staleness-at-click added to pilot metrics; earliest-start note tied to the recovery program's actual undeployed status (P2-6, P2-7, P2-8).

The strategic reframe worth writing into the program doc: the Radar pilot is the demand test, but the compounding asset is the multi-harvest price-history dataset the recovery program makes trustworthy. Every scope decision should protect that dataset's continuity — it, not the alert, is what survives a competitor.

## Final verdict

```text
VERDICT: corrections_required
P0: 0
P1: 3
P2: 5
P3: 2
NEXT_ACTION: amend_plan_docs_then_merge
CONFIDENCE: high
SCOPE_ASSESSMENT: right_boundary_wrong_signal_framing_and_pilot_arithmetic
```

## Key sources

External claims above were verified against primary or corroborating sources during this review, including: ICO CMR June 2026 (via ico.org and trade-press corroboration), USDA FAS Coffee: World Markets and Trade (Dec 2025, June 2026 update), FAO 2024 price statements, transactionguide.coffee (2024 Guide: 123 donors, >100k contracts, quality/lot-size/origin differentiation), Daily Coffee News (Beanstock launch 2016; Cropster Hub sale to Vollers 2021; Cafe Imports portal 2020; Sucafina Specialty 2020), Covoya (past-crop deals page, forward-contract and account-gated pricing docs), Royal NY (account approval FAQ, 2026 arrivals calendar), Sweet Maria's green-freshness library, Green Coffee Collective (clearance and spot-vs-forward glossary), Algrano (how-it-works, pricing, Direct Sourcing Calendar 2026-27), Greensquare, artisan.plus pricing and Supplier Partners, RoastLog/RoasterTools/Cropster pricing pages, Vesper (GetApp pricing listing), StoneX coffee subscriptions, hiQ v. LinkedIn commentary (Farella, Morgan Lewis) on scraping exposure, a16z/First Round/YC design-partner and sales guidance, and July 2026 tariff/EUDR coverage (CNN, Supply Chain Dive, Sprudge, EU Access2Markets).
