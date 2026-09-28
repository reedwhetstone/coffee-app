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

### 1. Owner-buyer (anchor persona)

Micro to small commercial roaster, roughly 100 to 2,000 lb a month, buying from a mix of retail-scale sellers and importers. Owns the menu and the margin. Buys every few weeks and replaces coffees as they run out.

- **Questions:** What should I buy this week to replace the coffee I'm running out of? Is this price fair for what it is? Is anything good arriving before my competitors grab it? Would a full bag from an importer beat what I'm paying now?
- **Catalog job:** Shortlist lots that fit a menu slot, then compare them directly.
- **Market Index job:** A short weekly read with deals worth acting on, a fair-price check, and arrivals by origin.
- **What they pay for:** Time saved and dollars per pound saved. This is the Parchment Intelligence buyer and the persona ADR-015 already names.

### 2. Serious home roaster

Buys 5 to 50 lb at a time, almost entirely retail. Price-sensitive, curious, and loyal to a few sellers.

- **Questions:** Where can I get a great Ethiopia natural? Am I overpaying at my usual seller? What's new?
- **Catalog job:** Discovery and a direct comparison of two to four lots.
- **Market Index job:** Mostly trust and curiosity. They read the headline and the arrivals, not supplier health tables.
- **What they pay for:** Mallard Studio context, and maybe Intelligence if the deal feed is good. They are the largest top-of-funnel audience.

### 3. Scaling buyer

Green buyer or head roaster at a growing company. Plans seasonally by origin, cares about supplier reliability, and moves between retail and importer channels.

- **Questions:** Where is each origin priced now against last season? Which suppliers carry depth in the origins I need? When do new crops land? What is the spread between retail and wholesale?
- **Market Index job:** Benchmarks, segment comparison, supplier comparison on the same basket, and arrivals by origin.
- **What they pay for:** Intelligence and the API; later, procurement workflows.

### 3b. Large buyer (progressive-disclosure layer)

Importer-scale or multi-site roaster buying containers and forward contracts. These buyers think in macro terms: C-market futures, differentials, currency, origin harvest and logistics risk. Futures show where commodity arabica trades. They do not show what specialty green actually costs at the point of sale, how fast lots arrive and sell out, or how processing and quality tiers are priced. Purveyors' data is a nuanced microcosm of that macro picture.

- **Questions:** How is specialty pricing moving relative to the C market? Which origins are tightening before it shows in futures or differentials? Is the premium for processing or quality widening?
- **Market Index job:** A deeper layer reached through progressive disclosure, not a separate page. It includes origin and process indices over longer windows, matched price trends, supply turnover as an early indicator, and later a specialty-versus-C-market view.
- **Data prerequisite:** A licensed or delayed futures series, plus a clear method statement that a retail/importer listing price is not a contract price. Nothing here should be marketed until the series exists (no-vaporware rule).

### 4. Market watcher

Importer staff, writers, analysts, and Purveyors itself through Market Brief.

- **Questions:** How is the market changing? Is anaerobic growing? Are suppliers disclosing more?
- **Market Index job:** Movement with significance, plus metadata trends. This is the public proof and content engine more than a revenue line.

### 5. Developer or agent

This persona does not browse the page, but it needs every read on the page to be reproducible through the API, CLI, and Cherry. Today it cannot reproduce the market read (see A-1).

### Anonymous visitor

Usually persona 1 or 2 deciding whether the data is real. The public page should give them one credible read and one example of a value signal with its evidence, then ask them to sign up. The comparison tool is for signed-in viewers and members only (see Decisions), so the anonymous page describes it rather than rendering it.

### Design rule

Home roasters are served mainly by the catalog. The Market Index is for small and medium businesses by default: it is ordered for the owner-buyer, with scaling-buyer depth one level down. Large-buyer macro views sit behind progressive disclosure (expand, longer windows, deeper sections), not a separate product. The market watcher's story sits at the bottom. This follows ADR-015 ("value signals first"), which the current page doesn't yet do.

## Module scorecard (live Intelligence view)

| Module                                                | Question it answers                    | Primary persona            | Verdict                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Market read headline                                  | What happened this week?               | All                        | **Fix.** It overclaims and is computed only in the browser (T-4, A-1).                                                             |
| KPI strip                                             | How big was the move?                  | Owner-buyer, watcher       | **Fix.** "Flat%" bug; "supplier-origin positions" is jargon.                                                                       |
| Insight cards (availability, price posture, coverage) | What moved and how much to trust it?   | Owner-buyer                | **Fix.** Price posture leads with the noisiest origins (T-3).                                                                      |
| Same-coffee prices, 30 days                           | Did like-for-like prices move?         | Owner-buyer, watcher       | **Promote and reframe.** This is the most rigorous metric on the page, but it's shown as a flat ticker of noise-level moves (E-2). |
| What should I consider buying?                        | What should I buy now?                 | Owner-buyer                | **Rebuild.** The anchor module is the least trustworthy (T-1).                                                                     |
| Origin price trends                                   | Where is each origin priced over time? | Scaling buyer, watcher     | Keep. It should default to the matched index once it has enough history.                                                           |
| Processing mix donut                                  | What is the supply made of?            | Watcher                    | Demote. It's a snapshot with no decision attached.                                                                                 |
| Origin price ranges                                   | How spread out is each origin?         | Scaling buyer              | Keep. It's a good base for a fair-price check.                                                                                     |
| Who has it cheapest?                                  | Which supplier is cheapest?            | Owner-buyer                | **Replace** with a supplier comparison on the same basket (E-3).                                                                   |
| Lot-level supplier price table                        | What are all the lots for this origin? | Owner-buyer                | **Replace** with segment and lot comparison (E-4).                                                                                 |
| Arrivals and delistings                               | What's new and what's leaving?         | Owner-buyer, scaling buyer | Keep. Add season context and tracked-lot emphasis.                                                                                 |
| Supplier catalog health                               | Which suppliers have depth?            | Scaling buyer              | **Fix** the $0 bug (T-2), then fold into supplier comparison.                                                                      |
| Origin benchmarks table                               | What does an origin cost?              | Scaling buyer              | Fix: use median and interquartile range, not mean (T-3).                                                                           |
| Price spread analysis                                 | Would buying wholesale save me money?  | Owner-buyer, scaling buyer | **Keep and promote.** Reframe as "retail versus a full bag" at a quantity.                                                         |
| Process and disclosure trends                         | Is the market changing?                | Watcher                    | Keep at the bottom. Label the August gap (T-6).                                                                                    |
| Purveyor Score and confidence trends                  | Is listing metadata improving?         | Internal                   | **Demote or cut.** This is data-quality telemetry: flat lines and no buyer action.                                                 |

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

## Recommended Market Index shape

Order the page by question, for the owner-buyer first. Each section title is the question.

1. **This week's read.** One server-computed sentence and at most three bullets: what moved beyond normal variance, what notable supply arrived, and what's leaving. If nothing is significant, say that plainly.
2. **What should I buy?** Rebuilt value signals (see below). Each card shows the comparable set it was measured against and a "Compare with alternatives" action that opens a comparison against the next three comparable lots.
3. **Is this price fair?** A price check. Pick an origin and process, or start from a lot or a price you were quoted, and see where it sits in the comparable distribution at your quantity. This is a segment comparison with one pinned value.
4. **What's arriving and leaving?** Arrivals by origin with crop-season context. Tracked lots and brief matches go first when present, which the watchlist section partly does already.
5. **How are prices moving?** The matched same-coffee index as the primary trend, with significance bands, then origin trends and ranges.
6. **Retail or a full bag?** The spread module reframed at quantities (10 lb, 25 lb, full bag), because the decision to move up a channel is one of the most valuable ones an owner-buyer makes.
7. **Who should I buy from?** Supplier comparison on a defined basket, replacing "Who has it cheapest?", the lot table, and supplier health.
8. **How is the market changing?** Process mix and disclosure trends. Demote or cut the Purveyor Score confidence chart.

Anonymous visitors get section 1, one fully evidenced example signal, and the upgrade summary, which names comparison as a signed-in feature. This stays within ADR-010.

A ninth, collapsed-by-default layer, **"How does this compare to the commodity market?"**, serves the large buyer once a futures series is licensed (persona 3b).

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

| #   | Repo                       | Slice                                                                                                                                                                                                                            | Why now                                                                                 |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0   | coffee-app                 | Trust fixes: T-2 null prices, T-3 median plus a three-supplier floor and the `$` sign, T-4 headline thresholds and "Flat" formatting, T-5 server-rendered last read, T-6 gap labels, E-2 significance-filtered same-coffee strip | Wrong numbers are live today; small and independent                                     |
| 1   | parchment-api              | Value-signal comparability, freshness, confidence ranking, and artifact suppression (T-1, A-2); hide `below_market` in coffee-app until this ships                                                                               | The anchor module is untrustworthy                                                      |
| 2   | parchment-api → SDK        | Segment comparison aggregate and lot comparison annotations                                                                                                                                                                      | Foundation for every comparison surface                                                 |
| 3   | coffee-app                 | Lot comparison tray and `/catalog/compare`                                                                                                                                                                                       | The most-requested buyer interaction; v1 can start before slice 2 on existing endpoints |
| 4   | coffee-app                 | Catalog "Compare by…" segment comparison                                                                                                                                                                                         | Covers the processing-method comparison use case                                        |
| 5   | parchment-api → coffee-app | `market/read` contract; reorder `/analytics` by question; replace supplier modules with comparison presets; demote score telemetry                                                                                               | Moves intelligence upstream (A-1) and delivers the persona-ordered page                 |
| 6   | coffee-app, purveyors-cli  | GenUI `comparison-table` block and CLI commands                                                                                                                                                                                  | Surface parity                                                                          |
| 7   | parchment-api → coffee-app | Quality-aware value: supplier-calibrated scores, supplier quality profiles, use selector, value score and reasons in comparisons and signals                                                                                     | The leverage step: a tool that understands coffee, not just price                       |
| 8   | parchment-api → coffee-app | Large-buyer macro layer: longer-window indices and specialty versus C-market view, after a futures series is licensed                                                                                                            | Progressive disclosure for large buyers                                                 |

Slices 3, 4, 7, and 8 include the subscription and feature copy updates described above. Slices 0 and 1 can run in parallel. Slice 3 can start on existing endpoints while slice 2 is built.

## How to know it worked

- Share of Intelligence sessions that open a value signal or comparison (target: most sessions do something beyond reading).
- Comparison views created per active member per week, and shares of comparison URLs.
- Value-signal click-through to supplier links, and signals later tracked or bought.
- Anonymous-to-signup conversion from `/analytics` before and after the server-rendered read and example comparison.
- Zero known-wrong values on the page, backed by a canary that fails on $0 prices, "Flat%", or unlabeled gaps.

## Decisions (Reed, 2026-09-28)

1. **Personas:** Confirmed. Hobbyists index on the catalog. The Market Index serves small and medium businesses, with progressive disclosure up to what large buyers care about (macro context, where Purveyors is a more nuanced microcosm than futures).
2. **Comparison access:** Viewers compare two lots; members get the full tool. The comparison tool is viewer and member only, with no anonymous example comparison, so ADR-010 is unchanged.
3. **Buy signals:** Agreed that cheapest is not best. Hide `below_market` until slice 1 ships, and treat quality-aware value (slice 7) as the step from comparison table to a tool that understands coffee.
4. **Subscription pages:** New capabilities ship with matching subscription and feature copy in the same PR.
