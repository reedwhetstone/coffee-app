# Market Index audit and comparison system

**Date:** 2026-09-28
**Status:** Audit and proposal; Reed's product decisions recorded 2026-09-28 (see "Decisions"). Nothing in this note has shipped.
**Scope:** `/analytics` (Parchment Market Index) and `/catalog`
**Governing direction:** `notes/PRODUCT_VISION.md`, ADR-005 (access levels), ADR-007 (Parchment owns shared logic), ADR-010 (public proof surface), ADR-015 (actionable insight)

## Verdict

The Market Index has the right architecture of ideas (ADR-015's value signals, movement significance, metadata trends) and a lot of real data, but it does not yet deliver actionable intelligence to a specific person. Three problems dominate:

1. **Trust.** Several modules show numbers that are wrong or misleading on the live page today (a $0.00 supplier, "Flat%", buy signals that compare commodity lots against Gesha-inflated medians, a headline built from a 1% change). A sourcing buyer who catches one of these stops trusting the rest.
2. **No anchor user.** About fifteen modules render at roughly equal weight. The anchor question from ADR-015, "what should I buy right now?", is the fourth block, below a ticker of twenty origins that each moved less than 1.5%.
3. **No comparison primitive.** Almost every buying question is a comparison (this lot versus alternatives, washed versus natural, this supplier versus the market, retail versus a full bag). The page answers these with fixed charts over unlike items. The catalog has no multi-lot comparison at all.

The recommendation is to fix the trust defects immediately, rebuild value signals on comparable sets, and build one comparison engine (lots, segments, suppliers) that the catalog, the Market Index, Cherry, and the CLI all consume.

## Evidence base

- Code: `origin/main` at `c94556cf` (`src/routes/analytics/+page.svelte`, `+page.server.ts`, `src/lib/components/analytics/**`, `src/routes/catalog/**`, `CoffeeCard.svelte`, `SimilarCoffeePanel.svelte`).
- Parchment contract: `parchment-api` `openapi.json` on `origin/main`; value-signal SQL in `supabase/history/coffee-app/20260705_02_market_index_compute.sql`.
- Live production page as a Parchment Intelligence member and anonymous server-rendered HTML, both captured 2026-09-28 against the September 27 index.
- Prior plans: `market-index-decision-surface-plan.md`, `2026-05-08-analytics-intelligence-reframe.md`, `analytics-chart-audit.md`.

## Who uses these pages

Personas are defined by the buying decision they make, not by demographics. Volume drives almost every difference, because it changes which price tier applies, which suppliers are reachable, and how much a wrong buy costs.

### Primary archetype 1: small-to-medium roaster (Market Index and catalog)

A roaster buying roughly 100 to 2,000 lb a month from a mix of retail-scale sellers and importers. At the small end, this is the owner who also roasts. At the larger end, it is a head roaster or buyer at a growing multi-coffee operation. They own the menu and the margin, buy every few weeks, and replace coffees as they run out.

- **Questions:**
  - What needs my attention right now?
  - What should I buy to replace the coffee I'm running out of?
  - Is this price fair for what it is?
  - Is anything good arriving before it's gone?
  - Would a full bag from an importer beat what I'm paying now?
  - Which suppliers are reliably good for the origins I buy?
- **Catalog job:** Shortlist lots for a menu slot, then compare them directly.
- **Market Index job:** Put the few things that matter to their buying at the top, then let them dig into the evidence and the comparison.
- **Range handled by depth, not separate personas:** The owner-buyer mostly stops at the top of the page. The larger buyer drills further: longer windows, supplier comparison on a basket, and origin detail. Both use the same page.
- **What they pay for:** Time saved, dollars per pound saved, and avoiding a bad buy. This is the Parchment Intelligence buyer and the anchor persona ADR-015 names.

### Primary archetype 2: serious home roaster (catalog)

Buys 5 to 50 lb at a time, almost entirely retail. Price-sensitive, curious, and loyal to a few sellers.

- **Questions:** Where can I get a great Ethiopia natural? Am I overpaying at my usual seller? What's new?
- **Catalog job:** Discovery, and comparing two to four lots directly (two free as a viewer).
- **Market Index job:** None required. The catalog carries the market context they need, such as "13% above median" and arrival freshness.
- **What they pay for:** Mallard Studio context, and membership for the full comparison tool. This is the largest top-of-funnel audience.

### Not primary archetypes

**Large-scale buyers** (importers, container-scale and multi-site roasters) buy through forward contracts, importer relationships, and pre-shipment samples. What they want is supply security for blend components, cost-of-goods forecasting, substitution options when a component gets scarce or expensive, and leverage when negotiating differentials. Purveyors' data covers the U.S. spot and small-lot market across about 41 sellers. That is an early indicator for some of those questions (spot tightness by origin, substitution through similarity matching), but it doesn't reach contract pricing. The dashboard should not be designed for them. If demand appears, serve them through the API, bulk data, or a later procurement product, not dashboard sections.

**Analysts and market watchers** are served by Market Brief and the blog. The metadata and disclosure trends feed that publication, and they don't need to take up dashboard space.

**Developers and agents** don't browse the page, but every read on it must be reproducible through the API, CLI, and Cherry. Today it isn't (see A-1).

### Anonymous visitor

Usually one of the two primary archetypes deciding whether the data is real. The public page should give them one credible read and one example of an evidenced value signal, then ask them to sign up. The comparison tool is for signed-in viewers and members only (see Decisions), so the anonymous page describes it rather than rendering it.

### Design rule

Two primary archetypes. The catalog is where both find and compare coffee. The Market Index is the small-to-medium roaster's decision surface, built with progressive disclosure (next section), not as a longer list of modules.

## Module scorecard (live Intelligence view)

In the recommended structure, a "Keep" module moves into a level 1 evidence view or a level 2 or 3 tool, rather than staying on the page body.

| Module                                                | Question it answers                    | Primary user                | Verdict                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Market read headline                                  | What happened this week?               | All                         | **Fix.** It overclaims and is computed only in the browser (T-4, A-1).                                                             |
| KPI strip                                             | How big was the move?                  | SMB roaster                 | **Fix.** "Flat%" bug; "supplier-origin positions" is jargon.                                                                       |
| Insight cards (availability, price posture, coverage) | What moved and how much to trust it?   | SMB roaster                 | **Fix.** Price posture leads with the noisiest origins (T-3).                                                                      |
| Same-coffee prices, 30 days                           | Did like-for-like prices move?         | SMB roaster                 | **Promote and reframe.** This is the most rigorous metric on the page, but it's shown as a flat ticker of noise-level moves (E-2). |
| What should I consider buying?                        | What should I buy now?                 | SMB roaster                 | **Rebuild.** The anchor module is the least trustworthy (T-1).                                                                     |
| Origin price trends                                   | Where is each origin priced over time? | SMB roaster (deeper levels) | Keep. It should default to the matched index once it has enough history.                                                           |
| Processing mix donut                                  | What is the supply made of?            | Market Brief                | Demote. It's a snapshot with no decision attached.                                                                                 |
| Origin price ranges                                   | How spread out is each origin?         | SMB roaster (deeper levels) | Keep. It's a good base for a fair-price check.                                                                                     |
| Who has it cheapest?                                  | Which supplier is cheapest?            | SMB roaster                 | **Replace** with a supplier comparison on the same basket (E-3).                                                                   |
| Lot-level supplier price table                        | What are all the lots for this origin? | SMB roaster                 | **Replace** with segment and lot comparison (E-4).                                                                                 |
| Arrivals and delistings                               | What's new and what's leaving?         | SMB roaster                 | Keep. Add season context and tracked-lot emphasis.                                                                                 |
| Supplier catalog health                               | Which suppliers have depth?            | SMB roaster (deeper levels) | **Fix** the $0 bug (T-2), then fold into supplier comparison.                                                                      |
| Origin benchmarks table                               | What does an origin cost?              | SMB roaster (deeper levels) | Fix: use median and interquartile range, not mean (T-3).                                                                           |
| Price spread analysis                                 | Would buying wholesale save me money?  | SMB roaster                 | **Keep and promote.** Reframe as "retail versus a full bag" at a quantity.                                                         |
| Process and disclosure trends                         | Is the market changing?                | Market Brief                | Keep at the bottom. Label the August gap (T-6).                                                                                    |
| Purveyor Score and confidence trends                  | Is listing metadata improving?         | Internal                    | **Demote or cut.** This is data-quality telemetry: flat lines and no buyer action.                                                 |

## Findings

### Trust defects (fix first)

**T-1. Buy signals surface cheap lots, not good buys.** On the live page, all six signals had a Purveyor Score of 45 to 60 (Developing or Limited), against a retail median of 70. Two were listings first stocked in July and October 2025. The top card, a Panama washed SHB at $8.99/lb, was labeled "-70.8% vs the Panama Washed median of $30.75/lb". That median is inflated by Gesha lots up to $114/lb, so the comparison is between different products. The cause is structural. `below_market` benchmarks against an origin × process × market segment and ranks by raw discount magnitude, with a boost from supplier-stated `score_value`. The most mixed segments (Panama, Colombia honey, anything with a competition or Gesha tail) produce the largest "discounts," so the ranking rewards mixed segments rather than value. One `price_drop` signal, a Mexico Cup of Excellence lot at $19.99 "-53.9% vs its own 30-day median of $43.36", looks like a tier or unit artifact and should be checked before it is shown to anyone. The "6 buy signals" label is also the display cap (`MAX_CARDS`), not the count.

**T-2. Supplier catalog health shows Royal Coffee at $0.00.** `+page.server.ts` maps `retailAverage ?? 0`, `retailMin ?? 0`, and `retailMax ?? 0`. Royal Coffee (449 stocked, 402 of them wholesale) renders "$0.00, $0.00–$0.00". The footer average ($10.57) weights those zeros by 449 lots. Stocked counts include wholesale while price columns are retail-only, and the Retail scope still shows wholesale counts. Missing prices must be null and excluded, not zero.

**T-3. Price reads lead with the thinnest evidence.** The price posture card says "Hawaii leads retail movement, −3.49/lb week-over-week", followed by Yemen and Saint Helena. The dollar sign is missing, and these are three- to four-supplier origins whose per-origin mean moves whenever one lot changes. The next card says Saint Helena is thin evidence. Origin benchmarks use the mean (Costa Rica shows $18.86 with a $175 maximum). Movement and benchmark reads should use medians, require at least three suppliers, and rank by significance, not absolute dollars.

**T-4. The headline overclaims, and the significance note contradicts itself.** "Supply is expanding faster than it is leaving the visible market" came from 64 arrivals against 55 delistings on 910 listings, a net change of about 1%. The headline branches on arrivals versus delistings with no threshold, and ranks that ahead of price. The significance note reads "0.0% weekly retail move: smaller than most recent moves, driven by suppliers repricing continuing lots," which attributes a driver to a zero move. The KPI renders "Flat%" and the detail line renders "Flat/lb (+0.0%)" because `formatSigned` returns "Flat" before the unit is appended.

**T-5. Search engines and link previews see a loading message as the headline.** The anonymous server-rendered HTML has the H2 "The latest index snapshot is in; movement and coverage signals are streaming next." That is the public proof surface's most visible sentence, and it's a placeholder. The last computed read should be rendered on the server.

**T-6. Metadata trends silently skip August.** The process, disclosure, and score charts go Mar, Apr, May, Jun, Jul, Sep. This matches the publication gap in the DEVLOG P0 ("Complete Market Index aggregate recovery"). Gaps should be labeled, not closed up.

### Experience and structure

**E-1. There's no hierarchy for the anchor persona.** The read, KPIs, three insight cards, and a twenty-origin ticker all come before "What should I consider buying?" The owner-buyer's two questions, what to buy and whether a price is fair, are either lower on the page or unanswered.

**E-2. The best metric looks like noise.** "Same-coffee prices · 30 days" uses matched listings with equal weight per supplier (`matched-supplier-median-log-v1`). That's the right method. It's displayed as twenty origins between −0.95% and +1.29% with no significance. It should say "No origin moved meaningfully in 30 days (all within ±1.3%)" and only list moves outside normal variance, using the same stats that drive `moveStats`.

**E-3. "Who has it cheapest?" can't be answered as posed.** It sorts 32 suppliers by the median across whatever they sell, on an axis from $4 to $212. Villa Coffee (1 lot) ranks first and Sea Island's premium catalog anchors the far end. "Cheapest" only means something for a defined basket (for example, washed Ethiopia grade 1 at 10 lb). That is a supplier comparison, and it belongs in the comparison system.

**E-4. The lot-level table compares unlike lots.** Ethiopia lists 98 rows with decaf, blends ("Yirgathon Espresso signature blend"), grade 4 and grade 1 mixed together. "Best" goes to a $5.00 decaf. Prices mix a 1 lb retail price with 132 lb bag pricing. A buyer needs to filter to comparable lots and see price at their quantity.

**E-5. There's too much jargon.** Examples: "supplier-origin positions", "comparison-grade coverage", "proof slice", "catalog turnover". Per the customer-copy rule, each should become a plain buyer statement.

**E-6. The scope control's promise isn't true.** "Every chart on this page follows the scope you set here," but the Disclosure Index is retail-only and the spread chart always shows both markets. Each exception is disclosed separately. Either narrow the promise or scope the charts.

**E-7. Catalog header stats are page-scoped.** "9 origins shown on this page", "1 supplier shown on this page", and "15 priced rows shown" describe pagination, not the market. They should describe the current query, or be removed.

### Architecture

**A-1. The market read is computed in the browser.** `+page.svelte` (1,454 lines) derives the headline, detail, KPI tones, insight cards, per-origin movers, thin-coverage flags, and origin benchmarks from raw snapshots. Cherry, the CLI, Market Brief, and API customers can't reproduce the read a member sees, which is the parity ADR-007 and ADR-015 ask for. The noise defects in T-3 and T-4 exist in only this one surface for the same reason. The read should become a Parchment contract (for example `GET /v1/market/read?market=&window=`) that returns the headline, significant moves, and evidence, and the page should render it.

**A-2. Value-signal ranking uses supplier-stated scores.** The rank boost multiplies by `score_value`. The display already hides `value_quality` because supplier scores are inconsistent, and ADR-015 says `score_value` must not be a comparison metric. Ranking should switch to the Purveyor Score or evidence confidence.

## Recommended Market Index shape: progressive disclosure

Progressive disclosure means the most urgent and useful intelligence comes first, and each item lets the user go deeper into its evidence and into the tools. It does not mean reordering a long page or adding sections at the bottom. The current page, and this note's first draft, both treat the Market Index as a stack of modules. Instead, charts and tables become drill-down destinations reached from an item, not the body of the page.

### Level 0: "What needs your attention" (the whole top of the page)

A short ranked list, usually three to six items, each written as one claim plus one evidence line. If nothing clears the bar, say that plainly. Item types:

- A tracked lot or inventory coffee changed price, is running low, or was delisted.
- A new arrival matches a sourcing brief or the user's buying profile.
- A value opportunity: a rebuilt value signal, or a quality-aware value score once slice 7 ships.
- An origin or process the user buys moved outside normal variance on matched prices.
- A supplier the user relies on changed materially (stopped carrying an origin, or repriced broadly).

Rank items by **urgency × relevance × significance × confidence**:

- **Urgency:** time-sensitive supply (new arrivals, delistings) ranks above slow trends.
- **Relevance:** tracked lots, Mallard Studio inventory, sourcing briefs, and a short buying profile (origins, processes, volume, price band, use) captured at onboarding and editable.
- **Significance:** the move measured against normal variance, not raw size.
- **Confidence:** how many suppliers and comparable lots are behind the claim.

Users with no profile get a market-wide default ranking and a one-step prompt to set their buying profile.

### Level 1: the evidence, inline

Expanding an item shows why the claim is true, in place:

- the lot against its comparable set;
- its price history;
- the supplier's quality profile;
- matched price movement for the segment.

This is where most of today's charts belong, each scoped to the item instead of the whole market.

### Level 2: the working tool, prefilled

Each item links into the tool that answers the next question, with the context already filled in:

- lot or segment comparison;
- the "Is this price fair?" check;
- retail versus a full bag at a quantity;
- supplier comparison on the basket;
- origin detail;
- "Ask Cherry" with the item attached.

### Level 3: full detail and export

Origin, process, and supplier detail views; longer windows; tables; export; API and CLI equivalents. This is where the larger buyer in archetype 1 spends time, and where analysts can find the metadata trends if they want them.

### Always available, never in the way

- A compact market pulse line: matched price movement with significance, and net arrivals. Each part opens its detail view.
- Scope controls (retail, wholesale, all; 7 or 30 days) that apply to every level, or say clearly where they don't.

### Anonymous and non-member views

- **Anonymous:** level 0 with market-wide items only, one item expandable to level 1 as proof, and the upgrade summary. This stays within ADR-010.
- **Viewers:** market-wide level 0 and level 1, and two-lot comparison.
- **Members:** personalized ranking and every level.

### ADR-015 alignment (resolved 2026-09-28)

ADR-015 principle 3 originally limited personalization to GenUI and agents. Reed agreed it was too narrow, and ADR-015 is amended in this PR. The Market Index may rank intelligence against the user's own data. One Parchment attention-feed contract produces the ranking for the page, Cherry, and the CLI, and the page still avoids per-persona tabs.

### Value signals rebuilt

- Benchmark each lot against a comparable set, not a raw origin × process segment. Exclude decaf and blends from single-origin segments, separate Gesha and competition lots, and use a price band or grade when available. If the comparable set is too small, don't emit a signal.
- Require freshness: first stocked within a set window, or a current crop year when known.
- Apply a Purveyor Score floor, or show the score next to the discount so a cheap, thinly described lot reads as what it is.
- Rank by discount × evidence confidence (comparable-set size, supplier count, and how tight the distribution is), not by discount alone or by supplier-stated score.
- Suppress `price_drop` when a tier, bag-size, or unit change explains it.

## Quality-aware value (the leverage step)

A comparison table that highlights the lowest price is a spreadsheet. The leverage is a tool that understands coffee well enough to judge when quality is worth paying for and when price should win. Reed's direction on 2026-09-28: cheapest is not best, and the product should understand which suppliers carry higher-quality material and where quality matters versus price.

### What "quality" can honestly mean here

- **Not supplier-stated cup scores as-is.** ADR-015 already rules them out as a cross-supplier comparison metric, because each supplier scores differently.
- **Not the Purveyor Score.** It measures how complete and comparable a listing's sourcing facts are, not cup quality. It is a useful confidence input, but it must never be labeled as quality.
- **Evidence the platform can defend:**
  - Lot facts: grade and screen, elevation, variety, traceability depth (farm or producer versus region only), process disclosure, crop recency, and competition or auction provenance.
  - Supplier-calibrated scores: supplier-stated scores normalized within each supplier. A supplier's 88 means "near the top of this supplier's range," not a universal 88. This turns inconsistent scores into a within-supplier rank that can be compared.
  - Supplier quality profile: each supplier's mix across grades, traceability, and price tiers, and how its price for a comparable lot sits against the market. This shows which suppliers consistently carry higher-quality material in each origin.
  - First-party tasting: Mallard Studio cupping and tasting ratings, aggregated only with consent and minimum-count thresholds. This is the one quality signal no competitor has, and it grows with usage.

### Where quality matters versus price

Value depends on what the coffee is for. Let the buyer state a use, then weight quality and price for it:

- **Blend base or volume espresso:** price, consistency, and availability dominate. The cheapest comparable lot above a quality floor wins.
- **Single-origin feature or seasonal menu slot:** quality and distinctiveness dominate. Pay up when the quality evidence is strong.
- **Decaf:** a separate comparison set.
- **Competition or showcase:** quality only.

This becomes a "Use" selector in comparison views and a filter on value signals. The same lot can be a great buy for one use and a poor one for another.

### Output

- **Value score per lot and use:** price versus the comparable set, adjusted by quality evidence and its confidence. It is shown with a short reason, for example "Priced 18% under comparable washed Guji G1; supplier's top-quartile lot; farm-level traceability."
- **"Worth the premium" and "cheap for a reason" flags** in comparisons, so the tool explains a price gap instead of only highlighting the lowest number.
- **Supplier quality profile** in supplier comparison: where each supplier sits on quality versus price for the selected basket.

Rebuilt value signals (slice 1) use the comparable-set and freshness rules now. They adopt the value score when this layer ships.

## Comparison system

### Principle

Build one comparison engine with three entity types (lots, segments, and suppliers) and one visual language, used by the catalog, the Market Index, Cherry GenUI, and the CLI. Comparison is how buyers decide; most Market Index modules are comparisons with fixed inputs.

### Lot comparison (catalog)

- **Selection:** A "Compare" checkbox on every `CoffeeCard` and a sticky tray holding 2 to 6 lots. The ⇆ icon currently opens Matches, so the two actions need distinct icons and labels.
- **View:** `/catalog/compare?ids=…`, a shareable URL that works with "Copy filtered link" and can be passed to Cherry as context.
- **Rows, grouped:**
  - Price: $/lb at 1 lb, at the user's chosen quantity, and at each tier the lot offers; percentage versus the comparable-set median.
  - Availability: stocked status, days since first stocked, bag sizes, supplier.
  - Origin: country, region, farm or producer, elevation.
  - Process: base method, fermentation, additives, drying, disclosure level.
  - Variety and grade.
  - Tasting notes, with a radar overlay reusing `TastingNotesRadar`.
  - Purveyor Score and data completeness.
- **Visual cues:**
  - Best value per price row gets a subtle accent and a "Lowest" pill. It's computed per quantity, because the cheapest lot at 1 lb is often not the cheapest at 25 lb.
  - Rows where all lots match collapse into a single "Same for all" line.
  - Rows that differ are emphasized.
  - "Not disclosed" is shown differently from "None".
  - A "Show differences only" toggle.
  - "Set as baseline" pins one lot, and every other cell shows its delta (for example "+$1.20/lb (+12%)").
- **Data:** v1 can use the existing `GET /v1/catalog?coffeeIds=` plus `origin-price-stats`. Before the CLI and Cherry use it, move the same/different/best annotations into a Parchment `GET /v1/catalog/compare?ids=&quantityLbs=` so every surface agrees.

### Segment comparison (catalog and Market Index)

This covers comparing processing methods and other dimensions.

- **Entry:** From any catalog filter state, "Compare by…" splits the current results by process, origin, supplier, market (retail or wholesale), or disclosure level, and builds the table immediately. For example, filter Ethiopia and compare by process to get Washed, Natural, Honey, and Anaerobic columns. Users can also add columns by hand, for example "Kenya washed" next to "Ethiopia washed".
- **Metrics per column:**
  - Lots and suppliers, flagged "thin" below three suppliers.
  - Price at a standard quantity (25th percentile, median, 75th percentile) with a small distribution strip.
  - Cheapest comparable lot, with a link.
  - Matched 30-day price change.
  - Arrivals and delistings in 30 days.
  - Top suppliers by depth.
  - Variety mix.
  - Disclosure share.
  - Median Purveyor Score.
  - Top tasting descriptors.
- **Visual cues:** Lowest median gets the best-price accent. A difference marker appears only when the interquartile ranges don't overlap, so users don't read noise as a difference. Diverging bars show each column versus the pinned baseline.
- **Market Index reuse:** "Is this price fair?" (a segment with one pinned value), "Retail or a full bag?" (split by market at a quantity), and "Who should I buy from?" (split by supplier on a fixed basket) are all presets of this one component.
- **Data:** This needs a new Parchment aggregate, for example `GET /v1/catalog/segments/compare?splitBy=processing_base_method&<catalog filters>&quantityLbs=`. It returns per-group aggregates with the same filter semantics as `/v1/catalog`. Existing `stats`, `facets`, and `suppliers` endpoints don't group prices by an arbitrary dimension.
- **Facet readiness:** Per ADR-005's facet quality policy, v1 split dimensions are country, process base method, market, supplier, and disclosure level. Variety, grade, and drying method wait for normalized taxonomies.

### Supplier comparison

Compare suppliers on the same basket (origin, process, and grade band at a quantity): median and lowest comparable price, depth, arrivals cadence, bag sizes and minimums, and delisting rate. This replaces "Who has it cheapest?", the lot-level table, and supplier health.

### Cherry and CLI parity

Add a `comparison-table` GenUI block backed by the same Parchment responses, so "compare washed vs natural Ethiopia under $10" in chat renders the same table. `CanvasLayout` already has a `comparison` mode, and `CoffeeCardsBlock` already says "Compare N coffees". Add `purvey catalog compare` and `purvey catalog segments --split-by` so agents can run the same comparisons.

### Access level (decided 2026-09-28)

- **Anonymous:** No comparison tool. Public pages and the subscription page describe it.
- **Viewer (free, signed in):** Compare two lots side by side.
- **Member or Intelligence:** The full tool: up to six lots, segment comparison ("Compare by…"), baselines, the use selector and value score, saved and shared comparisons, Market Index comparison presets, and Cherry comparisons.

Enforce the viewer limit server-side (ADR-005), not only in the tray UI.

### Subscription and feature copy

Every slice that ships a user-facing capability updates, in the same PR:

- `src/lib/billing/selfServePlans.ts`
- the subscription plan details (`SubscriptionPlanDetails.svelte`)
- the persona router and homepage contracts where plans are summarized
- the docs content

Copy names only what is live, follows the customer-copy rules, and states the viewer/member split plainly (for example "Compare two lots free; compare up to six lots and whole processing methods with a membership").

## Sequenced slices

| #   | Repo                       | Slice                                                                                                                                                                                                                                     | Why now                                                                                 |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0   | coffee-app                 | Trust fixes: T-2 null prices, T-3 median plus a three-supplier floor and the `$` sign, T-4 headline thresholds and "Flat" formatting, T-5 server-rendered last read, T-6 gap labels, E-2 significance-filtered same-coffee strip          | Wrong numbers are live today; small and independent                                     |
| 1   | parchment-api              | Value-signal comparability, freshness, confidence ranking, and artifact suppression (T-1, A-2); hide `below_market` in coffee-app until this ships                                                                                        | The anchor module is untrustworthy                                                      |
| 2   | parchment-api → SDK        | Segment comparison aggregate and lot comparison annotations                                                                                                                                                                               | Foundation for every comparison surface                                                 |
| 3   | coffee-app                 | Lot comparison tray and `/catalog/compare`                                                                                                                                                                                                | The most-requested buyer interaction; v1 can start before slice 2 on existing endpoints |
| 4   | coffee-app                 | Catalog "Compare by…" segment comparison                                                                                                                                                                                                  | Covers the processing-method comparison use case                                        |
| 5   | parchment-api → coffee-app | Progressive-disclosure Market Index: a Parchment attention-feed contract (ranking, evidence, links) shared with Cherry; buying-profile capture; level 0 to 3 page structure; charts moved into item and detail views; `market/read` pulse | Delivers the SMB decision surface and moves intelligence upstream (A-1)                 |
| 6   | coffee-app, purveyors-cli  | GenUI `comparison-table` block and CLI commands                                                                                                                                                                                           | Surface parity                                                                          |
| 7   | parchment-api → coffee-app | Quality-aware value: supplier-calibrated scores, supplier quality profiles, use selector, value score and reasons in comparisons and signals                                                                                              | The leverage step: a tool that understands coffee, not just price                       |

Slices 3, 4, 5, and 7 include the subscription and feature copy updates described above. Slices 0 and 1 can run in parallel. Slice 3 can start on existing endpoints while slice 2 is built.

## How to know it worked

- Share of Intelligence sessions that open a value signal or comparison (target: most sessions do something beyond reading).
- Comparison views created per active member per week, and shares of comparison URLs.
- Value-signal click-through to supplier links, and signals later tracked or bought.
- Anonymous-to-signup conversion from `/analytics` before and after the server-rendered read.
- Share of level 0 items that users expand or act on, and the share of sessions ending at level 0 with an action taken. A good top of page resolves most visits there.
- Zero known-wrong values on the page, backed by a canary that fails on $0 prices, "Flat%", or unlabeled gaps.

## Decisions (Reed, 2026-09-28)

1. **Personas:** Two primary archetypes. Home roasters use the catalog. Small-to-medium roasters use the Market Index and the catalog, and larger buyers within that range go deeper through the same page. Large-scale buyers and analysts are not primary archetypes. A futures comparison was proposed and withdrawn as too literal.
2. **Comparison access:** Viewers compare two lots; members get the full tool. The comparison tool is viewer and member only, with no anonymous example comparison, so ADR-010 is unchanged.
3. **Buy signals:** Agreed that cheapest is not best. Hide `below_market` until slice 1 ships, and treat quality-aware value (slice 7) as the step from comparison table to a tool that understands coffee.
4. **Subscription pages:** New capabilities ship with matching subscription and feature copy in the same PR.
5. **Progressive disclosure:** The Market Index leads with the most urgent, relevant intelligence and lets users dig into evidence and tools from each item. Adding sections to the bottom of the page is not the answer.
6. **ADR-015:** Principle 3 is amended so the page can personalize through a shared Parchment attention-feed contract that it shares with Cherry and the CLI.
