# Purveyors Premium Analytics Dashboard — Product Plan

_Created: 2026-03-22_
_Status: Planning_
_Related: `analytics-platform-master-plan.md`, `price-snapshot-strategy-research.md`_

---

## 1. Executive Summary

**What this is:** A market intelligence dashboard for professional green coffee buyers and roasters — showing daily-resolution pricing, supply trends, and sourcing signals across 39 US green coffee suppliers.

**The one-line pitch:** "Real-time retail green coffee market data, across every major US supplier, available nowhere else."

**Who pays for it:** The buyer or sourcing lead at a 200–2,000 bag/year specialty roastery. They spend $20K–$300K/year on green coffee. If this dashboard helps them buy smarter — better timing, cheaper equivalent lots, fewer stockouts — it pays for itself in a single better purchasing decision. At $49–$99/month, the math is trivial.

**Why now:** ICE C arabica futures hit $4.40/lb in late 2025 before falling ~30% by Q1 2026. Roasters are acutely cost-conscious. Price transparency has never mattered more. We have 39 suppliers scraped daily. Nobody else does.

**Why nobody else does this:** Cropster Origin targets producers, not buyers. Algrano is a direct-trade marketplace (relationship-driven, not price-transparent). Sucafina publishes quarterly market reports as PDFs. The SCA Specialty Coffee Transaction Guide is annual and covers FOB prices from origin — not what US importers actually charge today. There is a real gap between "ICE futures are at $2.94/lb" and "what should I actually pay for a washed G1 Ethiopian from my three regular suppliers this week?"

We fill that gap.

---

## 2. Competitive Landscape

### What Exists Today

**ICE Coffee C Contract (arabica commodity futures)**

- What it is: World benchmark for exchange-grade arabica. Hit $4.40/lb late 2025, ~$2.94/lb Feb 2026.
- What it doesn't do: Track specialty premiums, origin differentials, or what US retail importers actually charge. The C price is for commodity grade; specialty coffee trades at significant premiums above it.
- Roaster relationship: Most specialty roasters track it loosely as a macro signal, but they don't buy on it.

**ICO Composite Indicator Price**

- What it is: Monthly blended index across Colombian milds, other milds, Brazilian naturals, robustas. Published by the International Coffee Organization.
- What it doesn't do: Distinguish specialty from commercial, or track US importer pricing.

**Specialty Coffee Transaction Guide (SCA)**

- What it is: Annual survey-based report of FOB prices paid for specialty lots (80+ SCA score), by origin/cupping range. 2024 edition shows $2.66 for 80-83.9 cup lots rising toward $3.36 for higher grades.
- What it doesn't do: Live data. It's a backward-looking annual snapshot. Doesn't track US importer retail pricing. Published as a PDF.
- The gap: "What did people pay at origin last year" ≠ "what should I pay at my importer today."

**Cropster (Origin product)**

- What it is: Operations software for coffee producers and dry mills. Tracks processing, yield factors, quality grading, lot assembly, and selling.
- What it doesn't do: Market intelligence for buyers. It's the sell-side infrastructure tool.
- Pricing: Volume-based monthly plans tied to roasted volume + connected machines.
- Roaster relationship: Roasters use Cropster Roast (roast profiling, QC). Cropster Origin is for farmers and exporters, not buyers.

**Algrano**

- What it is: Direct-trade platform connecting producers directly to roasters. European-founded, US launch 2023.
- What it does: Marketplace for spot and forward contracts direct from farms. Roasters get traceability, stable prices (claims 2x more stable than futures over 3 years), and quality assurance.
- What it doesn't do: Market intelligence across the broader US supply market. You only see coffees listed on Algrano. No cross-supplier price comparison. No US importer visibility.
- Roaster relationship: Good for roasters committed to direct trade and willing to manage forward contracts.

**Sucafina (market reports)**

- What it is: Major green coffee trader that publishes free quarterly/monthly market reports covering macro market conditions, weather, crop forecasts.
- What it doesn't do: Interactive dashboard. No daily data. No per-origin/per-supplier retail pricing. Requires subscribing to their emails; no API or queryable interface.

**StockTrade**

- What it is: Online spot coffee exchange, more active in Europe.
- What it doesn't do: US importer price tracking at scale.

**Coffee Intelligence (intelligence.coffee)**

- What it is: Specialty coffee media/research publication. Publishes industry reports.
- What it doesn't do: Live market data dashboard.

### Our Unique Angle

We scrape the **retail layer** of the US green coffee market — what importers and specialty distributors actually charge roasters today. This is the data that:

- Algrano doesn't have (they see only their own marketplace)
- Cropster doesn't have (they see production/processing data)
- SCA doesn't have in real-time (annual, FOB-level)
- Sucafina doesn't expose (quarterly reports, not queryable)
- ICE doesn't have (commodity futures, not specialty retail)

Our 39-supplier daily scrape gives us something that has never existed: a **daily-resolution, cross-supplier specialty green coffee retail price index** for the US market. This is defensible data. The moat deepens every day we collect it.

**Important caveat on positioning:** We are NOT competing with direct-trade platforms (Algrano) or production tools (Cropster). We are providing the market intelligence layer that sits alongside those tools. A roaster using Algrano for their main relationships still wants to know if they're getting a fair price compared to the broader US spot market.

---

## 3. Dashboard Elements

### 3.1 Market Prices

---

**PPI Time Series — Purveyors Price Index by Origin / Process / Grade**

- What it shows: 30/60/90-day price trend for a selected segment (e.g., "Ethiopia / Washed / G1"). Line chart with range shading. Comparable to a stock chart but for coffee.
- Value to roasters: The single most actionable piece of market intelligence available. "Is Ethiopia washed getting more or less expensive over the past 90 days?" determines whether to buy now or wait.
- Data we have: Price snapshots starting March 2026. Origin, process, grade fields exist on catalog rows (but need normalization). The index aggregation logic exists in planning (`price_index_snapshots` table).
- Data we'd need: The normalization step (canonical origin/process forms) and the `price_index_snapshots` table must exist first. These are Phase 0 prerequisites in the master plan.
- Build complexity: **2-sprint** (normalization + snapshot table + time series API + chart component)
- Priority: **P0** — this is the headline feature that justifies the subscription

---

**Price Distribution per Origin — Box Plot / Quartile View**

- What it shows: For a given origin (e.g., Colombia), the full price distribution across all currently stocked beans from all suppliers. Min, 25th percentile, median, 75th percentile, max. Optionally filter by process or grade.
- Value to roasters: Reveals fair market range instantly. "Am I paying above the median for Colombian washed? What's the cheapest I can get it for without dropping below the 25th percentile (which might signal quality issues)?"
- Data we have: ~1,200 currently stocked beans with prices. Origin field exists (post-normalization). Computable today with a SQL aggregation.
- Data we'd need: Origin normalization to prevent "Ethiopia" / "Ethiopian" / "Yirgacheffe, Ethiopia" fragmenting into different buckets.
- Build complexity: **1-sprint** (SQL aggregation + box plot component; depends on normalization being done)
- Priority: **P0** — fast to build once normalization lands, high ROI

---

**Price Change Alerts**

- What it shows: Configurable price change notifications. "Tell me when any Ethiopia Washed drops >$1/lb" or "alert me when [specific bean] is back in stock." Delivered as in-app notification + optional email digest.
- Value to roasters: This alone could drive sign-ups. Roasters checking supplier sites daily to catch restocks or price drops is real, painful, manual work. We automate it.
- Data we have: Price snapshots give us daily diffs. We can detect drops, restocks, and delistings programmatically.
- Data we'd need: Alert configuration table, notification delivery system (in-app feed + email digest). The price snapshot data is the foundation.
- Build complexity: **2-sprint** (alert config UI + diff engine + notification delivery)
- Priority: **P0** — high standalone value, drives habit formation / daily active usage

---

**Supplier Price Comparison — Same-Origin Cross-Supplier Table**

- What it shows: For a selected origin/process, a table showing every stocked bean matching that profile, with supplier, price, grade, bag sizes, and link to buy. Sorted by price. Like a price comparison engine for green coffee.
- Example: "Ethiopia Natural G1 — Stocked at: [Supplier A $7.80/lb], [Supplier B $8.20/lb], [Supplier C $7.40/lb w/ min 33lb]"
- Value to roasters: Direct cost optimization. A roaster buying 50lb of Ethiopian natural 3x/year can save $100–300/year per lot finding the cheapest equivalent bean. Across a full sourcing list, this is real money.
- Data we have: This is directly computable from the current catalog. We have supplier, price, origin, process, grade. The challenge is bean identity resolution — "are these actually the same quality of bean?"
- Data we'd need: `bean_identity` entity resolution (Phase 0.2 in master plan) makes this much more accurate. Can ship a v1 with fuzzy matching on origin/process/grade without full resolution.
- Build complexity: **1-sprint** for v1 (filter + sort table); **2-sprint** for v2 with identity resolution
- Priority: **P0** (v1), **P1** (v2 with identity resolution)

---

**Wholesale vs. Retail Price Spread**

- What it shows: For any origin/process segment, the spread between wholesale-flagged beans (>5lb minimum tier pricing) and retail beans. Tracks whether the wholesale premium/discount changes over time.
- Value to roasters: At scale (500+ bags/year), qualifying for wholesale pricing is significant. Shows whether the 10-20% typical discount is holding or narrowing at specific origins.
- Data we have: `wholesale` boolean flag on catalog rows. Price tiers in JSONB. Computable now.
- Data we'd need: Enough price history to show the spread trend over time (accumulates naturally).
- Build complexity: **1-sprint** (computed metric + visualization; overlays on PPI chart)
- Priority: **P1** — useful, but secondary to core price tracking

---

**Organic Premium Tracking**

- What it shows: Average price premium of organic-certified beans vs. conventional beans, by origin. Time-series trend.
- Value to roasters: Roasters catering to organic-focused retail need to understand the cost premium. Is the organic Ethiopia premium growing or shrinking? Informs menu/pricing decisions.
- Data we have: Organic certification is partially in descriptions/tasting notes. May need a normalized `certifications` field to do this reliably.
- Data we'd need: Explicit organic certification flag, either scraped from suppliers or extracted via LLM from existing descriptions.
- Build complexity: **2-sprint** (requires LLM extraction of certifications from existing data + normalization)
- Priority: **P2** — niche but real value for organic-focused roasters

---

### 3.2 Supply Intelligence

---

**New Arrivals Tracker**

- What it shows: Beans that became stocked (flipped from unstocked to stocked) in the last 7 / 30 days. Filterable by origin, process, grade. Shows supplier, price, key attributes.
- Value to roasters: New arrivals = new crop lots. Many roasters hunt for specific harvest years or processing experiments. This replaces manually checking 10+ supplier websites.
- Data we have: `in_stock` boolean on catalog rows. With price snapshot history, we can detect the first day a bean appeared stocked. From March 2026 forward, this is trackable.
- Data we'd need: Historical stocking status. Before snapshot start date (March 2026), we can't reconstruct. Going forward: the data builds automatically.
- Build complexity: **1-sprint** (query + list component)
- Priority: **P0** — high standalone value, directly replaces manual work

---

**Delistings Tracker (Supply Tightening Signal)**

- What it shows: Beans that went from stocked to unstocked in the last 7 / 30 days. Grouped by origin. Rising delisting rate for a specific origin = supply tightening signal.
- Value to roasters: "Ethiopian naturals are disappearing fast — 12 beans delisted this month" is a clear buy-now signal for current inventory or for building forward contract relationships. This is real market intelligence.
- Data we have: Same stocking status diffs as new arrivals. Origin-level aggregation.
- Data we'd need: Nothing new. Computable from price snapshot diffs.
- Build complexity: **1-sprint** (same pipeline as new arrivals)
- Priority: **P0** — high signal value, especially in volatile market conditions

---

**Origin Availability Heatmap**

- What it shows: A visual grid or map showing each major origin's current stocking level — count of stocked beans, count of suppliers carrying it, recent trend (up/down). Color-coded: green (well-stocked), yellow (thinning), red (scarce).
- Value to roasters: At-a-glance supply chain risk assessment. "Colombia is well-stocked across 8 suppliers. Sumatra is thin — only 2 suppliers, 3 beans." Informs when to buy ahead vs. wait.
- Data we have: Origin + stocking status. Per-supplier counts are computable now.
- Data we'd need: Origin normalization (canonical form), 30-day trend data.
- Build complexity: **1-sprint** (table/grid view); **2-sprint** (map visualization)
- Priority: **P1** — great visual anchor for the dashboard; start with grid, add map later

---

**Seasonal Patterns (Historical Supply Calendar)**

- What it shows: Month-by-month arrival patterns for major origins based on historical stocking data. Example: "Ethiopian G1 washed typically peaks in stock November–March. Colombia eases May–July." Lets roasters plan forward purchases.
- Value to roasters: Green coffee harvest cycles are predictable but poorly documented at the retail importer level. This is the "when to buy" intelligence layer.
- Data we have: We don't have historical data yet (price snapshots started March 2026). This view requires 12+ months of data to be meaningful.
- Data we'd need: 1 full year of stocking data. Cannot fake this with existing data.
- Build complexity: **needs-new-data** — display is simple once data exists; the data collection is the timeline constraint
- Priority: **P2** — critical long-term feature, but requires a year of data. Mark March 2026 as Year 1 Day 1 and let it accumulate.

---

**Supplier Diversity by Origin**

- What it shows: For each origin, how many distinct suppliers carry it. Single-supplier origins are flagged as concentration risk. Shows trend over time (are more or fewer suppliers entering an origin?).
- Value to roasters: Supply chain resilience. If you source 80% of your Ethiopia from one supplier and they go out of stock, you're stuck. This data lets roasters find backup suppliers before they need them.
- Data we have: Supplier + origin is computable from the current catalog.
- Data we'd need: Nothing new. Supplier count per origin is a simple aggregation.
- Build complexity: **1-sprint** (aggregation + display)
- Priority: **P1** — builds the "supplier risk" narrative

---

### 3.3 Quality Intelligence

---

**Cupping Score Distribution by Origin / Process**

- What it shows: Histogram or violin plot of cupping scores across the catalog, filterable by origin and process method. Shows where the score mass sits for a given segment.
- Value to roasters: "What cupping score range can I expect from a natural Ethiopian at my price target?" Connects quality expectations to market reality.
- Data we have: Cupping scores exist on a subset of catalog rows. Coverage is inconsistent — many suppliers don't publish scores.
- Data we'd need: Wider score coverage. We could potentially use AI to estimate a score range from tasting notes + variety + process + origin, but this would need clear labeling as "estimated." Actual cupping scores are sparsely scraped.
- Build complexity: **1-sprint** (display with what we have); **2-sprint** to add AI score estimation layer
- Priority: **P1** — useful but data coverage limits impact at launch

---

**Tasting Profile Trends — Flavor-Price Correlation**

- What it shows: "Are fruity/fermented naturals commanding a higher price premium over time?" Maps flavor descriptors (from tasting notes) against price trends. Shows whether specific flavor profiles are getting more or less expensive.
- Value to roasters: Menu planning intelligence. If roasters know "tropical naturals are +15% over the past 6 months" they can hedge by diversifying flavor profiles.
- Data we have: AI-generated tasting notes on every bean. Price snapshots from March 2026. Embeddings encode flavor profile in the `tasting` chunk type.
- Data we'd need: NLP pipeline to extract structured flavor descriptors from tasting notes (fruity, floral, chocolate, fermented, etc.) and bucket them. Then correlate buckets with price over time.
- Build complexity: **2-sprint** (flavor extraction pipeline + correlation analysis + visualization)
- Priority: **P2** — compelling differentiation but requires flavor tagging infrastructure

---

**Bean Similarity Recommendations ("If you liked X, try Y at $3/lb less")**

- What it shows: For any bean in the catalog, shows the 5 most similar beans by flavor profile + processing, with price delta. Useful for substitution discovery ("your usual Ethiopia lot is out of stock — here are 3 similar options you might not have seen").
- Value to roasters: Reduces the research burden when a regular lot sells out. Also helps roasters discover value — "I didn't know [Supplier B] had essentially the same bean for $1.50/lb less."
- Data we have: pgvector embeddings exist on all beans using `origin` and `processing` chunk types. The similarity RPC function is planned (Phase 0.1 in master plan). This is very close to being ready.
- Data we'd need: The similarity RPC function (`get_similar_beans`) — planned but not yet built. Once Phase 0.1 ships, this UI is straightforward.
- Build complexity: **1-sprint** (RPC + display — depends on Phase 0.1 completion)
- Priority: **P1** — high value, fast to build after Phase 0.1

---

**Processing Method Trends Over Time**

- What it shows: Time series of how the catalog mix of processing methods changes — are more naturals arriving? Is anaerobic processing growing? Does the washed share thin out seasonally?
- Value to roasters: Sourcing trend intelligence. If anaerobic lots are growing as a share, roasters can plan menu expansion knowing supply is deepening.
- Data we have: Process field on catalog rows. Stocking status history from March 2026.
- Data we'd need: Process normalization (canonical forms: washed, natural, honey, anaerobic, wet-hulled). Then simple time series on stocked counts per process type.
- Build complexity: **1-sprint** (post-normalization; simple aggregation + line chart)
- Priority: **P1**

---

### 3.4 Business Intelligence

---

**Cost Optimization — Cheapest Equivalent Beans**

- What it shows: A workflow tool: enter your current green coffee lineup (origin, process, grade, price paid). The dashboard finds the cheapest in-stock beans that match each profile across all 39 suppliers, shows price delta, and highlights potential savings.
- Value to roasters: This is the closest thing to a direct ROI demonstration. "You could save $340/month on your Colombia washed by switching from [Supplier A] to [Supplier B] for this equivalent lot."
- Data we have: Catalog, prices, supplier, origin, process, grade. Similarity embeddings for profile matching.
- Data we'd need: User "sourcing list" feature — users store their current bean lineup with prices paid. Then we run cross-supplier matching. Requires user data input.
- Build complexity: **2-sprint** (sourcing list UI + matching engine + savings display)
- Priority: **P1** — high-conviction ROI feature; defer slightly to get price index foundations right

---

**Blend Component Tracker**

- What it shows: Users configure 3–5 origins that make up their blend (e.g., 40% Colombia, 35% Ethiopia, 25% Brazil). Dashboard tracks the blended cost, current availability across all suppliers for each component, and alerts when any component has a significant price move or availability issue.
- Value to roasters: Blend economics in one view. Roasters with stable blends (which is most commercial roasters) obsess over blend component costs. This replaces spreadsheets.
- Data we have: Origin availability and pricing is computable. The user-defined blend config needs to be stored.
- Data we'd need: Blend configuration table, blend cost computation logic, component alert rules.
- Build complexity: **2-sprint** (blend config UI + cost tracking + alerting)
- Priority: **P1** — strong retention feature; once set up, users check this daily

---

**Purchase Timing Signals ("Buy Now vs. Wait")**

- What it shows: For a selected origin/process, a signal indicator based on: (a) price trend direction over 30 days, (b) recent stocking activity (new arrivals vs. delistings), (c) seasonal pattern (if available). Outputs a simple signal: "Price trending up, supply thinning — consider buying now" or "Price stable, well-stocked — no urgency."
- Value to roasters: Actionable. This is the answer to "should I buy now or wait?" — the most common question in green coffee buying. It synthesizes our data layers into a single signal.
- Data we have: Price trends (March 2026+), stocking diffs. Seasonal data comes later.
- Data we'd need: Signal logic definition. We're essentially building a rule-based scoring system, not ML. Define it explicitly so it's auditable.
- Build complexity: **2-sprint** (signal logic + UI); first version can be simple rule-based, later versions can weight historical data
- Priority: **P1** — signature differentiating feature; label as "beta" at launch to manage expectations

---

### 3.5 Competitive / Strategic Intelligence

---

**Supplier Catalog Health — Who Has What**

- What it shows: A supplier-by-supplier breakdown of catalog size, origins covered, in-stock count, average price, and recent change velocity. Lets roasters evaluate suppliers they haven't worked with.
- Value to roasters: "Which suppliers carry the most Ethiopian naturals right now?" or "Which supplier has the best selection under $7/lb?" This is currently impossible to answer without manually checking 39 websites.
- Data we have: All computable from current catalog.
- Data we'd need: Nothing new.
- Build complexity: **1-sprint** (aggregation table + filter)
- Priority: **P1** — straightforward to build, real discovery value

---

**Market Summary / Morning Brief**

- What it shows: A daily digest widget on the dashboard home: biggest price moves in last 24 hours, new arrivals, delistings, origin-level summary. Designed to be readable in 60 seconds.
- Value to roasters: Habit-forming. Checking Purveyors first thing becomes part of the morning sourcing routine. This is how Bloomberg Terminal drives engagement — the daily brief.
- Data we have: All computable from price snapshot diffs.
- Data we'd need: Daily diff computation job (runs each morning post-scrape).
- Build complexity: **1-sprint** (aggregation + UI)
- Priority: **P0** — sets the daily engagement habit from day one

---

## 4. Pricing Model Recommendation

### Foundational Principle

The data we have is genuinely scarce and valuable. Price it to reflect that. Specialty coffee roasters at 500+ bags/year are not price-sensitive at $50–100/month if the tool clearly saves them money or time. Under-pricing signals low confidence in the product.

### Tier Structure

**Free (Public / Logged Out)**

- What's free: Catalog browsing, search, current prices on any bean, supplier list.
- Why free: This is the marketing funnel. Getting roasters to see the catalog for free converts to subscription when they want trend data.
- What's gated: All time series, all alerts, all aggregated indices, supplier comparison tables, business intelligence features.

**Roaster ($49/month)**

- Target: 200–500 bag/year specialty roastery
- What they get:
  - PPI time series (30/60/90 days) by origin/process/grade
  - New arrivals + delistings tracker (7/30 days)
  - Price distribution views (current snapshot)
  - Supplier comparison for same-origin beans
  - Email alert digest (daily summary of biggest moves)
  - Origin availability heatmap
  - Bean similarity recommendations (when Phase 0.1 ships)
- Why $49: Below the "have to get budget approval" threshold for most small roasteries. One smarter purchase decision covers 6 months of subscription.

**Roaster Pro ($99/month)**

- Target: 500–2,000 bag/year roastery with a dedicated sourcing role
- What they get: Everything in Roaster, plus:
  - Real-time configurable price alerts (instant, not daily digest)
  - Blend component tracker
  - Cost optimization tool (cheapest equivalent beans)
  - Purchase timing signals
  - Processing method trend analysis
  - Full API access (for integration into their own tools)
  - CSV data export
- Why $99: Equivalent to 2 hours of a professional buyer's time per month. Pays for itself with one better sourcing decision per quarter.

**Enterprise (Custom, starting $299/month)**

- Target: Large multi-roastery groups, green coffee importers/distributors, coffee consultants
- What they get: Everything in Pro, plus:
  - White-label data feeds
  - Custom origin/supplier tracking
  - Historical data export (full dataset)
  - Dedicated account support
  - Data API with higher rate limits
- Positioning: If a company buys $1M+/year in green coffee, $300/month for market intelligence is rounding error.

### What Should NOT Be Behind Paywalls

- Basic catalog search (including price)
- Individual bean pages
- Supplier directory

Locking the catalog itself would hurt SEO, discovery, and the "free tier as funnel" strategy. The intelligence layer (trends, alerts, indices, signals) is the paid product.

---

## 5. Implementation Roadmap

This roadmap assumes the Phase 0 data foundations from `analytics-platform-master-plan.md` are completed (origin normalization, `price_index_snapshots` table, similarity RPC function). Those are prerequisites.

### Phase 1 — Core Market Data Dashboard (Launch)

**Sprint 1: Data Foundation**

- Origin/process normalization (canonical forms)
- `price_index_snapshots` table populated from March 2026 forward
- Daily diff job: compute new arrivals, delistings, price changes

**Sprint 2: PPI Charts + Distribution**

- PPI time series chart component (30/60/90d) by origin/process/grade
- Price distribution box plot per origin
- Supplier comparison table for same-origin beans

**Sprint 3: New Arrivals + Delistings + Morning Brief**

- New arrivals tracker (7/30d filter)
- Delistings tracker (supply tightening signal)
- Dashboard home "Morning Brief" widget
- Role gating: `ppi-member` role required for all of the above

**Sprint 4: Price Alerts (MVP)**

- Daily email digest of biggest price moves + new arrivals
- In-app notification feed
- User alert preferences (origin-level filtering)

**Launch Gate:** PPI time series, new arrivals, delistings, morning brief, daily email digest. This is the P0 set.

---

### Phase 2 — Business Intelligence Layer (Fast Follow, 4-8 Weeks Post-Launch)

- Bean similarity recommendations (requires Phase 0.1 similarity RPC)
- Supplier catalog health table
- Origin availability heatmap
- Supplier diversity by origin
- Cost optimization tool v1 (filter + sort by price for matching origin/process/grade)
- Processing method trends

---

### Phase 3 — Power User Features (8-16 Weeks Post-Launch)

- Blend component tracker
- Purchase timing signals (rule-based, labeled beta)
- Configurable real-time alerts (vs. daily digest)
- Cupping score distribution (with data coverage caveat)
- Full API access for Pro subscribers
- CSV export

---

### Phase 4 — Long-Horizon Features (12+ Months)

- Seasonal pattern calendar (requires 12+ months of data)
- Tasting profile trend analysis (flavor-price correlation)
- Organic premium tracking (requires certification extraction)
- Predictive pricing signals (ML-based, when historical depth justifies it)

---

## 6. Data Gaps

These are things we need that we don't have today. Listed in order of urgency.

**Gap 1: Origin / Process / Grade Normalization (BLOCKING)**
Without this, the PPI is fragmented. "Ethiopia" and "Ethiopian" and "Yirgacheffe" are three different buckets. Washed, Fully Washed, Wet Processed are the same thing but counted separately. This is Phase 0 in the master plan and must ship before any aggregated dashboard module.

**Gap 2: Cupping Score Coverage (SIGNIFICANT)**
Cupping scores exist on a minority of catalog rows. Suppliers who don't publish scores leave gaps. We cannot infer scores reliably from tasting notes without explicit labeling as "estimated." For the Quality Intelligence modules to be meaningful, we need either better scraping coverage of published scores or an honest UI that shows "N of 1,200 beans have published scores — here's the distribution for those."

**Gap 3: Certification Data (MINOR — for Organic Premium feature)**
Organic, Fair Trade, Rainforest Alliance, and similar certifications are referenced in descriptions but not in a structured field. To build the organic premium tracker, we need a `certifications` array on catalog rows, extracted via LLM from existing descriptions + structured scraping where suppliers expose it.

**Gap 4: Seasonal Historical Data (LONG-TERM)**
We have no stocking history before March 2026. The seasonal patterns view requires at least one full annual cycle. There is no shortcut here. We start the clock in March 2026 and build the calendar over 12 months. Note this clearly in marketing — "seasonal intelligence coming Fall 2026 / Spring 2027 for early origins."

**Gap 5: Roaster-Side Data (for Business Intelligence features)**
The Blend Component Tracker and Cost Optimization Tool require users to input their current sourcing lineup. This is user-generated data we don't collect today. We need a "My Sourcing List" data structure — a simple table linking a user to a set of origins/processes/grades with their current price paid. Low engineering lift but requires intentional UX design.

**Gap 6: Supplier Metadata Quality**
Some scraped data has incomplete or inconsistent grade fields. A Peru bean might have grade "SHB/EP" from one supplier and no grade from another even for the same lot. Grade normalization is a subset of the broader normalization gap but worth calling out separately because it directly affects PPI accuracy for premium segment comparisons.

---

## 7. Key Design Principles

These should guide every dashboard build decision.

**Scannable in 60 seconds.** A roaster opening the dashboard between roasts doesn't have 10 minutes. The morning brief, the new arrivals list, the biggest price moves — these must be above the fold and readable at a glance. Depth is always one click away, never required.

**Label data limits clearly.** If cupping score data covers 22% of the catalog, say so. If purchase timing signals are rule-based and not predictive ML, label them "signal (rule-based)." Roasters are professionals who will catch overreach quickly. Trust is harder to recover than it is to build.

**Make the first visit valuable.** The free tier should show enough to make the paid upgrade obvious, not frustrating. A roaster should be able to land on the origin heatmap, see that Ethiopia is thinning and Colombia is well-stocked, and immediately understand "I want the trend data — where do I subscribe?"

**Alerts drive retention, charts drive acquisition.** The PPI charts are the hook. Price alerts are what keeps people subscribed month-over-month. Invest in both but make sure alert delivery is rock-solid from day one.

**Start with tables, add charts.** A well-designed table showing 10 Ethiopia washed beans sorted by price, with supplier and grade, is immediately useful. A complex D3 visualization takes longer to build and longer to understand. Build the table first; layer in the visual polish after you've validated the data structure.

---

_This document is a product strategy plan, not an implementation specification. For technical implementation details, see `analytics-platform-master-plan.md`. For data layer architecture, see `price-snapshot-strategy-research.md`._
