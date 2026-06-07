# Outline: What If the Real Coffee Shortage Is Choice, Not Price?

**Pillar:** market-intelligence  
**Target:** under 1,000 words  
**Status:** drafted and tightened  
**Source material:** Purveyors `/analytics/__data.json` snapshot pulled 2026-04-23, `notes/PRODUCT_VISION.md`, `notes/BLOG_STRATEGY.md`, ADR-003 public analytics gate

## Thesis

The coffee market's most useful weekly signal is not the headline price. It is shelf depth. Global benchmark narratives still fixate on the C market, macro production, and whether the median listing price moved. But live catalog data shows a different pattern: supply tightness often appears first as fewer comparable options, narrower supplier coverage, and a wider retail-versus-wholesale access gap. By the time sticker price clearly signals scarcity, the best choices are already gone.

## Voice Constraints

- Data-first, no narrative padding.
- Question-format title.
- Keep the post concrete and decision-useful for roasters.
- Purveyors appears as the measuring instrument, not the pitch.
- One cross-industry analogy only if it clarifies the structure. Airline seat depth / hotel room class depth is the likely candidate.

## Verification

- [x] Re-pulled `https://www.purveyors.io/analytics/__data.json` before handoff and updated the draft to the current public snapshot.
- [x] Confirmed `stats.lastUpdated` is `2026-04-23` and noted the absolute date in the post.
- [x] Updated weekly deltas: retail median +0.5%, supply -2.5%.
- [x] Updated current stocked totals: 1,073 retail / 820 wholesale / 38 suppliers / 3,945 total beans tracked.
- [x] Confirmed latest available paired snapshot is `2026-04-23` in the public dataset.
- [x] Updated spread examples to Guatemala +90.2% and Ethiopia +77.6%, both with thin wholesale supplier coverage.
- [x] Confirmed origin range outlier examples still hold: Ethiopia max near $230, Indonesia max near $433.64.
- [ ] If using the visible arrivals/delistings country window, explicitly label it as the visible 50-row public window rather than the full 30-day universe.

## External References

1. **USDA FAS, Coffee: World Markets and Trade**  
   https://www.fas.usda.gov/data/coffee-world-markets-and-trade  
   Use for macro framing: global coffee analysis is usually production / consumption / stocks first.

2. **ICE Coffee C Futures contract page**  
   https://www.theice.com/products/15/Coffee-C-Futures  
   Use for benchmark framing: the industry has a clear macro price signal, but that is not the same thing as listing-depth visibility.

3. **Sustainable Coffee Buyer’s Guide / Coffee Buyers Guide**  
   https://www.coffeebuyers.org/  
   Use as the foil: coffee has improved price and cost transparency tools, but still lacks good shelf-depth / listing-comparability intelligence.

## Internal Evidence Stack

### Core platform stats (2026-04-08)

- 3,745 total beans tracked
- 1,086 stocked retail beans
- 844 stocked wholesale beans
- 36 suppliers represented in current stocked inventory
- Combined stocked catalog: 1,930 listings
- Weekly change: retail median price +3.5%; supply -10.4%
- 30-day change: retail median price flat to slightly down (~-0.8%); supply -10.4%

### Process structure

- Retail visible process mix is still dominated by washed coffees (~63.7%), then naturals (~23.1%)
- Wholesale is even more concentrated in washed coffees (~75.1%)
- This is useful supporting evidence that "choice compression" is not just about price, but also about process diversity

### Origin spread / bifurcation examples (latest paired public snapshot: 2026-04-03)

- Colombia: retail median $10.51/lb vs wholesale median $6.66/lb, spread +57.8%, suppliers 25 retail / 3 wholesale
- Ethiopia: retail median $10.60/lb vs wholesale median $8.61/lb, spread +23.1%, suppliers 24 retail / 4 wholesale
- Guatemala and Brazil likely useful as additional examples if needed

### Cross-section range examples

- Ethiopia current cross-section median roughly $8.50/lb, but max visible listing ~${230}/lb
- Indonesia current cross-section median roughly $8.74/lb, but max visible listing ~${433.64}/lb
- Core insight: average or maximum price headlines get distorted by prestige microlots; median + supplier-count tells the operational story better

## Structure

### 1. Coffee buyers are watching the wrong gauge

Open with the familiar macro toolkit: C market, production reports, price headlines. Then pivot immediately: those are real, but they are not the first signal most buyers actually feel. In a sourcing workflow, scarcity appears first as fewer comparable options at the quality/quantity window you need.

Key move: distinguish **benchmark price visibility** from **market depth visibility**.

### 2. The current catalog says tightness is showing up in depth first

Lead with the current internal numbers:

- 1,930 stocked listings across 36 suppliers on 2026-04-08
- Retail median up just 3.5% week-over-week
- Supply down 10.4% over the same window

Core interpretation: the market is not screaming through price yet. It is quietly thinning.

### 3. The market is splitting into retail and wholesale access bands

Use Colombia and Ethiopia as the cleanest examples.

Points to make:

- Same origin can effectively be two different markets
- Spread matters, but supplier count matters just as much
- A cheap wholesale median with only 3 suppliers is not the same thing as broad market relief
- This is an access problem, not just a price problem

### 4. Headline prices lie because microlots distort the picture

Use Ethiopia and Indonesia max-vs-median examples.

Argument:

- High-end microlots create eye-popping maxima
- Median buyer reality often remains far lower
- This is why "coffee is exploding" can be simultaneously true in headlines and false in day-to-day purchasing
- Better weekly intelligence asks: how many viable options are left at my target spec and quantity?

### 5. Immediate vs tail risk map

**Immediate risks**

- Fewer comparable listings at target quantity
- Wholesale relief concentrated in too few suppliers
- Process choice compresses faster than price signals suggest
- Roasters delay substitution planning because median price still looks manageable

**Tail risks**

- Buyers overfit to macro benchmark narratives and miss local assortment deterioration
- Process/origin concentration increases flavor and blend fragility
- Access stratification becomes structural: sophisticated buyers arbitrage spread, smaller buyers absorb the retail surface

### 6. Opportunity map: what smart buyers can do now

Actionable plays:

1. Track supplier count per origin alongside price median
2. Pre-plan substitution bands before scarcity hits price
3. Compare price at actual working volume, not a single headline number
4. Treat wide retail/wholesale spreads as access signals, not just discount signals
5. Buy optionality early in origins where process diversity is thinning

### 7. Product implication for Purveyors

This post should end with a product-level conclusion, not a pitch.

What the platform should track next:

- daily supplier count by origin/process/quantity band
- origin-level retail vs wholesale spread
- listing churn velocity (new arrivals vs delistings)
- process diversity score by origin
- effective price at 5 lb / 25 lb / 65 lb, not just a single per-pound number
- harvest season separate from arrival timing when the source supports it

Tie to ADR-003 lightly: public analytics should make the value legible by surfacing market structure, not just a pretty price chart.

## Likely title / subtitle pair

- **Title:** What If the Real Coffee Shortage Is Choice, Not Price?
- **Deck / description direction:** Weekly coffee-market data suggests roasters should watch supplier depth and access spread before they watch the next headline price move.
