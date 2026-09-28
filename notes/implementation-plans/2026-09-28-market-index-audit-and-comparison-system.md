# Market Index audit and comparison system

**Date:** 2026-09-28
**Status:** Audit and proposal; nothing in this note has shipped
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

### 4. Market watcher

Importer staff, writers, analysts, and Purveyors itself through Market Brief.

- **Questions:** How is the market changing? Is anaerobic growing? Are suppliers disclosing more?
- **Market Index job:** Movement with significance, plus metadata trends. This is the public proof and content engine more than a revenue line.

### 5. Developer or agent

This persona does not browse the page, but it needs every read on the page to be reproducible through the API, CLI, and Cherry. Today it cannot reproduce the market read (see A-1).

### Anonymous visitor

Usually persona 1 or 2 deciding whether the data is real. The public page should give them one credible read, one example of a value signal with its evidence, and one example comparison, then ask them to sign up.

### Design rule

The Market Index should be ordered for the owner-buyer, with the scaling buyer's depth one level down and the market watcher's story at the bottom. The home roaster is served mainly by the catalog. This follows ADR-015 ("value signals first"), which the current page doesn't yet do.

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

Anonymous visitors get section 1, one fully evidenced example signal, one static example comparison, and the upgrade summary. That extends ADR-010 by one example comparison, so it needs a product decision rather than an incidental change.

### Value signals rebuilt

- Benchmark each lot against a comparable set, not a raw origin × process segment. Exclude decaf and blends from single-origin segments, separate Gesha and competition lots, and use a price band or grade when available. If the comparable set is too small, don't emit a signal.
- Require freshness: first stocked within a set window, or a current crop year when known.
- Apply a Purveyor Score floor, or show the score next to the discount so a cheap, thinly described lot reads as what it is.
- Rank by discount × evidence confidence (comparable-set size, supplier count, and how tight the distribution is), not by discount alone or by supplier-stated score.
- Suppress `price_drop` when a tier, bag-size, or unit change explains it.

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

### Access level (decision needed)

ADR-005 puts comparison workflows at Member. The proposal:

- **Anonymous:** A static, real example comparison as proof.
- **Viewer:** Compare two lots, enough to feel the value.
- **Member or Intelligence:** Up to six lots, segment comparison, baselines, saved and shared comparisons, and Cherry comparisons.

This is a product call for Reed.

## Sequenced slices

| #   | Repo                       | Slice                                                                                                                                                                                                                            | Why now                                                                                 |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0   | coffee-app                 | Trust fixes: T-2 null prices, T-3 median plus a three-supplier floor and the `$` sign, T-4 headline thresholds and "Flat" formatting, T-5 server-rendered last read, T-6 gap labels, E-2 significance-filtered same-coffee strip | Wrong numbers are live today; small and independent                                     |
| 1   | parchment-api              | Value-signal comparability, freshness, confidence ranking, and artifact suppression (T-1, A-2)                                                                                                                                   | The anchor module is untrustworthy                                                      |
| 2   | parchment-api → SDK        | Segment comparison aggregate and lot comparison annotations                                                                                                                                                                      | Foundation for every comparison surface                                                 |
| 3   | coffee-app                 | Lot comparison tray and `/catalog/compare`                                                                                                                                                                                       | The most-requested buyer interaction; v1 can start before slice 2 on existing endpoints |
| 4   | coffee-app                 | Catalog "Compare by…" segment comparison                                                                                                                                                                                         | Covers the processing-method comparison use case                                        |
| 5   | parchment-api → coffee-app | `market/read` contract; reorder `/analytics` by question; replace supplier modules with comparison presets; demote score telemetry                                                                                               | Moves intelligence upstream (A-1) and delivers the persona-ordered page                 |
| 6   | coffee-app, purveyors-cli  | GenUI `comparison-table` block and CLI commands                                                                                                                                                                                  | Surface parity                                                                          |

Slices 0 and 1 can run in parallel. Slice 3 can start on existing endpoints while slice 2 is built.

## How to know it worked

- Share of Intelligence sessions that open a value signal or comparison (target: most sessions do something beyond reading).
- Comparison views created per active member per week, and shares of comparison URLs.
- Value-signal click-through to supplier links, and signals later tracked or bought.
- Anonymous-to-signup conversion from `/analytics` before and after the server-rendered read and example comparison.
- Zero known-wrong values on the page, backed by a canary that fails on $0 prices, "Flat%", or unlabeled gaps.

## Open decisions for Reed

1. Confirm the owner-buyer as the Market Index anchor persona, with home roasters served mainly by the catalog.
2. Choose the access level for lot comparison (the proposal above, or Member-only).
3. Decide whether to hide `below_market` signals until slice 1 ships. The recommendation is to hide `below_market` now and keep only verified `price_drop` signals, because the current top signals would teach a buyer not to trust the feed.
4. Decide whether the anonymous page may add one static example comparison. This amends ADR-010.
