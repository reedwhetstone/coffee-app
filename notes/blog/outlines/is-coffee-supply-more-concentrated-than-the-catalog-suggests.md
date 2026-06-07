# Outline: Is Coffee Supply More Concentrated Than the Catalog Suggests?

**Pillar:** market-intelligence
**Target:** 1,800-2,200 words
**Status:** outlined
**Angle:** Wednesday Coffee Intelligence
**Slug:** is-coffee-supply-more-concentrated-than-the-catalog-suggests

## Thesis

The public green coffee catalog looks broadly diversified when you read it as a shelf. It looks materially more concentrated when you read it as flow. On 2026-04-22, the public Purveyors catalog showed 1,071 in-stock public listings across a broad set of origins, but only 64 were new in the last 30 days. That fresh flow was much more concentrated by country than the full shelf: country HHI rose from 578.2 overall to 918.0 in the last 30 days, and the top five origins rose from 44.0% of the full catalog to 56.3% of recent arrivals. Buyers who optimize around freshness are not shopping the same market suggested by the static shelf.

## Why this is not a duplicate

### Audit against published posts

- **`who-profits-when-coffee-data-stays-scarce`** is about metadata disclosure asymmetry across suppliers. Its core argument is that the industry solved price transparency before product metadata transparency.
- **This post** is about stock versus flow. The new argument is that catalog diversity is overstated if buyers care about what has landed recently rather than what still happens to remain listed.
- **`beyond-the-coffee-belt`** is about monoculture, resilience, and rare origins as structural signals. This post is narrower and more operational: live arrival flow, current concentration, and freshness-weighted sourcing/product decisions.
- **Ideas backlog overlap:** closest matches are `Green coffee market pulse` and `Seasonal patterns in green coffee availability`. This post is the sharper, Wednesday-ready synthesis of both.

## Verified internal evidence

### Catalog snapshot method

- Verified via authenticated `GET https://www.purveyors.io/v1/catalog` on **2026-04-22** with `publicOnly: true` and `showWholesale: false`
- Full result set required pagination: page 1 with 1,000 rows plus page 2 with 71 rows
- Last 30 days defined as `stocked_date >= 2026-03-23`
- Last 14 days defined as `stocked_date >= 2026-04-09`
- Last 7 days defined as `stocked_date >= 2026-04-16`

### Verified numbers to cite

- Full public catalog rows: **1,071**
- New rows in last 30 days: **64**
- New rows in last 14 days: **33**
- New rows in last 7 days: **19**
- Country concentration HHI: **578.2 overall**, **918.0 last 30d**, **1092.7 last 14d**, **1135.7 last 7d**
- Top-five origin share: **44.0% overall** vs **56.3% last 30d**
- Colombia: **14/64 recent = 21.9%** vs **11.5% overall**, **+10.4 pts**
- Brazil: **7/64 recent = 10.9%** vs **5.8% overall**, **+5.1 pts**
- Kenya: **6/64 recent = 9.4%** vs **4.2% overall**, **+5.2 pts**
- Rwanda: **5/64 recent = 7.8%** vs **3.3% overall**, **+4.5 pts**
- Ethiopia: **4/64 recent = 6.3%** vs **10.6% overall**, **-4.4 pts**
- Median price per lb: **$10.10 overall**, **$9.25 last 30d**, **$9.15 last 14d**, **$8.99 last 7d**
- Arrival-date coverage: **44.6% overall** vs **67.2% last 30d**
- Multi-tier pricing coverage: **38.8% overall** vs **51.6% last 30d**
- Score coverage: **35.7% overall** vs **34.4% last 30d**
- Recent 30d process mix: washed 38, natural 8, honey 5, unknown 4, anaerobic 3, semi-washed 2, wet-hulled 2

### Representative recent listings verified in catalog

- 2026-04-21 | `good_brothers` | Colombia Pink Bourbon Washed Microlot By Peñas Blancas GREEN | $21.99 | Washed
- 2026-04-18 | `roastmasters` | Colombia Finca La Primavera Chiroso | $11.60 | Washed
- 2026-04-18 | `sweet_maria` | Colombia Inzá Maria Ilma | $9.85 | Washed
- 2026-04-21 | `good_brothers` | Brazil Serra Negra Natural GREEN | $12.49 | Natural
- 2026-04-18 | `sweet_maria` | Brazil Machado Recanto do Engenho | $9.40 | Natural
- 2026-04-21 | `theta_ridge` | Kenya AB | $7.95 | processing missing in source data
- 2026-04-18 | `sweet_maria` | Kenya Nyeri Kamoini AB | $8.95 | Washed
- 2026-04-10 | `sweet_maria` | Rwanda Nyamasheke Mutovu | $9.05 | Washed
- 2026-04-18 | `burman` | Ethiopian West Arsi Washed Gr. 1 – Refisa | $8.99 | Washed

## External sources to use

1. **Nordic Approach — 2026 First Quarter: Specialty Coffee Harvest Update**

   - Ethiopia harvest later than usual
   - Ethiopia volumes down
   - Red cherry prices more than doubled
   - SPOT availability more selective
   - Washed arrivals from February, naturals from March
   - Kenya volumes down around 10-20%

2. **Nordic Approach — Kenya Specialty Coffee Harvest 2026: Early Peak and Strong AA Quality**

   - Harvest peaked early
   - Best coffees already in circulation
   - Availability is front-loaded
   - Arrivals expected in March, with good-quality lots available through mid-April but lower outturn from March onward

3. **Nordic Approach — Colombia origin page**

   - Harvest windows vary by region
   - Antioquia Oct-Jan, Central Huila Jun-Nov, Southern Huila Sept-Jan, Nariño May-Sep
   - Arrival windows December-February and September-November

4. **ICO Coffee Market Report, March 2026**
   - I-CIP averaged 273.70 US cents/lb in March 2026, up 2.3% vs February
   - Strait of Hormuz closure sent energy costs and shipping freight soaring
   - Global green bean exports in February 2026 were 9.79 million bags, down 9.0% YoY
   - Global exports of all forms of coffee in February 2026 were 11.46 million bags, down 5.7% YoY
   - Brazil total exports in February 2026 were down 21.1% to 2.62 million bags

## Structural argument

### 1. The shelf and the flow are different markets

Open with the misleading comfort of the full shelf. 1,071 public listings feels broad. Then pivot immediately: only 64 of those listings are new in the last 30 days, and the fresh flow is much more concentrated than the shelf. The market looks diversified partly because old inventory accumulates.

### 2. Freshness is what turns catalog diversity into a sourcing illusion

If buyers care about freshness, they are effectively shopping the incoming flow, not the full archive of what is still technically in stock. That is where concentration matters. Use the HHI jump and top-five share jump as the core proof.

### 3. Why the fresh flow narrows right now

Use external seasonality and logistics sources to explain the skew without overselling certainty:

- Colombia can over-index because regional harvest windows and arrival windows are staggered
- Kenya is available now, but early and front-loaded
- Ethiopia is later, tighter, and more selective this season
- Global trade/logistics pressure raises the odds that replacement flow stays uneven

### 4. Immediate vs tail risk map

**Immediate risks**

- Buyers mistake shelf breadth for current sourcing breadth
- Fresh-crop decisions concentrate around fewer origins than the catalog suggests
- Price signals can be misleading because recent flow is narrower but not more expensive
- Teams without stocked-date views can miss supply cliffs until listings disappear

**Tail risks**

- Platforms teach the wrong mental model if they only surface stock, not replenishment flow
- Concentration risk gets understated in planning and procurement
- Arrival-date ambiguity keeps freshness analysis noisy
- The market becomes harder to compare if old inventory and new flow are blended into one static view

### 5. Opportunity map

- **Buyers:** monitor freshness-weighted origin share, not just shelf share
- **Roasters:** treat Colombia's current over-indexing as a timing signal, not permanent diversification
- **Analysts:** compare 7d, 14d, and 30d flow against total shelf to catch narrowing early
- **Platforms:** build “new this month” and “fresh flow by origin/process” as first-class views

### 6. Data fields Purveyors should track next

- `harvest_season` as a dedicated field
- `arrival_date_confidence`
- `first_seen_at` / `stocked_date`
- `last_seen_at` / `unstocked_date`
- replacement-flow metrics by origin and process
- optional warehouse / arrival region when available

### 7. Concrete product implication

Purveyors should stop treating availability as a flat snapshot and start exposing freshness-weighted availability by origin. The simplest product move is a catalog toggle or analytics card that answers: “What share of fresh arrivals in the last 30 days came from each origin, and how does that compare to the full shelf?”

## Tone and writing constraints

- Reed voice, first person singular
- HN-framed and analytical
- No em dashes
- No corporate filler
- Purveyors as illustration, not pitch
- Tight self-edited paragraphs only

## Verification

- [x] Read `notes/PRODUCT_VISION.md`
- [x] Read `notes/BLOG_STRATEGY.md`
- [x] Read `/root/.openclaw/workspace/skills/purveyors-blog/SKILL.md`
- [x] Audited ideas backlog, active outlines, published outlines, and published posts for duplication risk
- [x] Verified live public catalog totals on 2026-04-22 via authenticated `/v1/catalog`
- [x] Verified pagination requirement: 1,071 rows across two pages
- [x] Verified 30d / 14d / 7d stocked-date windows and concentration stats
- [x] Verified representative recent listings against current catalog response
- [x] Verified Nordic Approach Ethiopia / Kenya / Colombia source pages
- [x] Verified ICO March 2026 report metrics from PDF text extraction
- [ ] Draft post and self-edit against outline
- [ ] Generate hero image at `static/blog/images/is-coffee-supply-more-concentrated-than-the-catalog-suggests/hero.webp`
- [ ] Run `pnpm check --fail-on-warnings`
- [ ] Run `pnpm lint --max-warnings 0`
- [ ] Open single draft PR
- [ ] Update `notes/blog/ideas.md` with drafted status and PR number
