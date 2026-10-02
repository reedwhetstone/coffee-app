# Does coffee farm quality persist? Evidence from 25 years of Cup of Excellence results

First-party dataset and analysis built 2026-10-02 for the Purveyors.io post on reputation as stored quality history. All records come from Alliance for Coffee Excellence (ACE) result pages. No record was inferred or filled in by hand.

## Bottom line

Coffee quality does persist across harvests, but weakly, and the market pays only a small premium for a track record.

1. **Repeat placement is the exception.** About 1 in 4 first-time placers places again within five years (26.6%), and about 1 in 3 places again at some later point (32.4% ever, among farms with at least 5 years of follow-up). In a given year, about 1 in 5 placing farms is back the next year (20.5%), and about 1 in 3 is back within three years (32%).
2. **Higher placings predict returning.** Farms ranked in the top 10 come back within three years 43% of the time, against 26% for lower-ranked placers (p < 1e-20).
3. **Scores carry over modestly.** Between a farm's consecutive appearances, competition-adjusted scores correlate at r ≈ 0.19–0.24. Randomly pairing farms from the same country and year gives r ≈ 0.00 (95% band ±0.06–0.08). Among farms that return, a top-10 farm is top-10 again 45% of the time, against 32% for the others.
4. **The price premium for a track record is small.** At the same score, lot size and competition, a lot from a farm that placed before sells for about 3% more. That is roughly a fifth of what one extra cupping point is worth (about 13.5%). The premium sits almost entirely with farms that previously placed **top 10**: about 6% more than a farm with no prior placement, while a prior placement outside the top 10 is worth about 0. A given farm's prices do not rise noticeably as it piles up placements (+0.8% per prior placement, p = 0.28).
5. **Buyer relationships repeat more than chance, but are rare.** In 11.6% of a farm's consecutive appearances, at least one of the same buyers wins it again. Chance would give 4.9%, so that is 2.4×, or 3.9× if Wataru, a bidding agent present on about 16% of lots, is excluded. A repeat is far more likely when the farm's appearances are a year apart (16%) than when years pass between them (7%).

Interpretation for the post: CoE does create a public quality record, and a minority of estates build long records. Examples: El Injerto, Guatemala, placed in 19 of 23 years; Las Macadamias, Guatemala, 13; La Montañita, El Salvador, 12. But most placings are one-offs, year-to-year score persistence is modest, and auction buyers pay mainly for this year's score. Reputation adds only a thin premium, concentrated on farms with prior top-10 finishes. Wine-style accumulated reputation exists in coffee only for a small elite of repeat estates, and even for them it is priced far more weakly than in wine.

## Data

- **Source:** ACE results index <https://allianceforcoffeeexcellence.org/competition-auction-results/>, linking to one page per competition, e.g. <https://allianceforcoffeeexcellence.org/el-salvador-2015/>. 164 pages fetched 2026-10-02, all HTTP 200, 1.5 s between requests, no blocking. The list of URLs with fetch times is in `sources.csv`. The raw HTML and the lot-level CSVs are not committed (see `README.md` in the parent folder); `fetch_pages.py` re-downloads the pages into `raw/pages/`.
- **Countries:** all seven long-running Latin American programs, since the page format was uniform enough to parse them all. The three longest continuous series, El Salvador, Guatemala and Honduras, are reported alongside the pooled numbers.

| country     | years     | competition years                                                              | CoE-tier lots | with score | with price | with buyer |
| ----------- | --------- | ------------------------------------------------------------------------------ | ------------- | ---------- | ---------- | ---------- |
| Brazil      | 1999–2025 | 25 (33 competitions; separate Naturals and Pulped Naturals contests 2012–2018) | 919           | 845        | 918        | 873        |
| Colombia    | 2005–2023 | 18 (North/South regional contests alternated 2005–2015)                        | 555           | 555        | 555        | 555        |
| Costa Rica  | 2007–2026 | 19                                                                             | 568           | 568        | 568        | 568        |
| El Salvador | 2003–2026 | 23 (no 2016)                                                                   | 686           | 686        | 686        | 686        |
| Guatemala   | 2001–2026 | 23 (no 2003–2005)                                                              | 627           | 579        | 627        | 626        |
| Honduras    | 2004–2026 | 22 (no 2020)                                                                   | 655           | 653        | 653        | 653        |
| Nicaragua   | 2002–2026 | 22 (no 2013, 2016, 2019)                                                       | 639           | 602        | 639        | 636        |

The total is 4,927 lots: 4,649 CoE-tier winners plus 278 "National Winner" (NW) lots.

**Fields per lot** (`coe_lots.csv`): country, year, competition, tier (CoE/NW), category (2024+ process categories), rank, score, farm, farmer/representative, region, variety and process (published from about 2017 onward), weight, high bid ($/lb), winning bidder(s), lot total, and source URL. 99.4% of lots were matched to their auction row. The unmatched lots are NW lots whose auction rows the source omits.

Source data problems found, and how they were handled:

- Nicaragua 2002: the results table on the ACE page is corrupt. Every score is 0.00, the farm list does not match the auction list, and it includes a Honduran region. The 37-lot auction table was used as the lot list, with no scores.
- Brazil Pulped Naturals 2002 lists every score as -1.00, Honduras 2009 has two lots scored 0.00, and Guatemala 2001 publishes no scores. All of these are treated as missing.
- The 2020 competitions (online-only) publish only an auction table, so farmer and region are missing that year.
- 2018 auction tables label lots "Farm – Farmer". Split lots (1a/1b) appear as separate auction lots.
- Brazil 2023 uses decimal commas.
- `brazil-2026` and `colombia-farmers-collection-2026` had no result tables at fetch time. Colombia 2024–2025 are not linked from the ACE index.

## Methods

**Universe.** The primary analyses use CoE-tier winners only, the lots ACE lists as Cup of Excellence winners. The cut-off rose over time: about 84–85 points in the 2000s, and 87+ once the National Winner tier was split off around 2019–2020. A sensitivity check that includes NW lots gives the same results.

**Farm identity** (`analyze.py: resolve`):

- Farm names are normalized: accents removed; prefixes stripped (Finca, Hacienda, Granja, Sítio, Fazenda, Faz., Chácara, Beneficio, Estate, articles); suffixes stripped (lot numbers, Roman numerals, single letters, years, parentheticals).
- Many unrelated farms share names ("La Esperanza", "Santa Rosa"), so the same name alone is not enough to merge two lots. The **standard** rule links lots with the same normalized farm name when either:
  - the farmer/owner names share at least 2 tokens, or
  - both are listed as the same single token, or
  - they share one token that is either rare among that country's farmer names or accompanied by an overlapping region token. A single shared token is never enough on its own, even when one owner is listed by that token alone ("Martinez" and "Juan Martinez").
- Company suffixes (S.A. de C.V., Ltda…) are dropped from the farmer names before comparison.
- The same farmer with a near-identical farm spelling is also merged.
- Lots without a farmer name (2020) attach to a farm name only if exactly one farm with that name exists in the country.
- Two bounds bracket the standard rule. **Strict** requires 2 shared farmer tokens, or both owners listed as the same single token. **Name-only** merges every same-named farm, which overstates persistence.
- Multiple lots from one farm in one year (split lots, Brazil's two contests, multiple entries) are collapsed to one farm-year using the best score.

**Score comparability.**

- Score scales drift over time, so scores are compared as **score minus the competition mean** and as the **percentile within the competition**.
- Raw-score results are shown for reference. Year-level drift inflates their null to about 0.12.
- The null is a permutation test (2,000 draws): each farm's next appearance is replaced by a random _other_ farm placing in the same country and year.

**Price.** OLS of log(high bid $/lb) on score − 87, (score − 87)², a prior-placement indicator, log lot size, and competition fixed effects. Standard errors are clustered by farm. "Prior placement" means a CoE-tier placement by the same farm in an earlier calendar year within the data window. In the top-10 model the prior-top-10 indicator is nested inside the prior-placement indicator, so the premium for a prior top-10 farm against a farm with no prior placement is the sum of the two coefficients, tested jointly.

**Buyers.**

- Bidder strings are split on commas, "//", "/", ";", "and", "for".
- Names are normalized: legal suffixes, "coffee"/"roasters" and country tags are removed.
- For each pair of consecutive appearances, the test is whether any buyer is shared. Chance is estimated by drawing a random other farm's buyers from the later year (500 draws). The Wataru-excluded check draws only from farms that still have a non-Wataru buyer, matching how its observed pairs are selected (300 draws).

Run with: `uv run --with requests python fetch_pages.py`, then `uv run --with beautifulsoup4 --with lxml --with pandas python parse_coe.py`, then `uv run --with pandas --with numpy --with scipy --with statsmodels python analyze.py`. The result pages are live, so a fresh fetch can differ from the 2026-10-02 capture; the frozen `coe_lots.csv` behind these numbers is the private copy described in the parent `README.md`. Every number below is printed in `analysis_output.txt`; tables are in `results_tables/`.

## Results

### 1. Repeat appearance

Standard rule: 2,650 farms and 4,348 farm-years. 810 farms (30.6%) placed in 2+ years, 363 in 3+, 117 in 5+; the maximum is 19.

Each window counts a return only if it happens within that many years of the source placement. "Ever" counts any later return among farms first seen at least five years before the data ends, so it includes returns more than five years later.

|                                               | within 1 yr | within 2 yrs | within 3 yrs | within 5 yrs      | ever (≥5 yrs follow-up) |
| --------------------------------------------- | ----------- | ------------ | ------------ | ----------------- | ----------------------- |
| First-time placers, pooled (n ≈ 2,200–2,565)  | 14.3%       | 19.8%        | 23.2%        | 26.6% (585/2,197) | 32.4% (711/2,197)       |
| Any placement, pooled (n ≈ 3,400–4,151)       | 20.5%       | 27.3%        | 31.8%        | 35.6%             | —                       |
| El Salvador, first-timers                     | 17.3%       | 23.9%        | 27.5%        | 31.9%             | 37.2%                   |
| Guatemala, first-timers                       | 17.9%       | 26.4%        | 30.3%        | 35.3%             | 44.8%                   |
| Honduras, first-timers                        | 16.7%       | 22.0%        | 25.1%        | 28.4%             | 32.9%                   |
| Brazil / Costa Rica / Nicaragua, first-timers | 12–18%      | 18–24%       | 23–28%       | 28% / 30% / 28%   | 35% / 35% / 35%         |
| Colombia, first-timers                        | 4.9%        | 8.2%         | 8.3%         | 9.1%              | 13.3%                   |

Colombia is low partly because of its structure: alternating North/South regional contests through 2015, a 2016 gap, and data ending in 2023. It should not be read as lower persistence.

Bounds: within five years, first-time placers return 20.8% under the strict rule and 34.0% under the name-only rule, which over-merges; "ever" is 24.7% strict and 42.9% name-only. The share placing within one year (any placement) is 16.1% strict and 24.5% name-only.

Placement position predicts returning. Of placements in the top 10, 42.7% return within three years (505/1,183), against 26.5% of placements below the top 10 (642/2,427), chi² p = 1e-22. In a logit with country controls, moving from the 10th to the 90th percentile of within-competition score raises the return probability from 20% to 44%.

The most frequent placers were:

| farm                        | country     | years placed | span      |
| --------------------------- | ----------- | ------------ | --------- |
| El Injerto                  | Guatemala   | 19           | 2002–2026 |
| Las Macadamias              | Guatemala   | 13           | 2009–2026 |
| La Montañita                | El Salvador | 12           | 2004–2022 |
| Recreio                     | Brazil      | 11           | —         |
| Villaure                    | Guatemala   | 11           | —         |
| Santa Rosa (J. Raúl Rivera) | El Salvador | 11           | —         |
| Buenos Aires                | Nicaragua   | 10           | —         |
| El Morito                   | Guatemala   | 10           | —         |
| Guatalón                    | Guatemala   | 10           | —         |

The full list is in `results_tables/most_frequent_farms.csv`.

### 2. Score / rank persistence

Pairs are consecutive appearances of the same farm (standard rule).

| max gap | pairs (farms) | score − comp. mean: r | percentile: r | Spearman | null r (95% band)      |
| ------- | ------------- | --------------------- | ------------- | -------- | ---------------------- |
| 1 yr    | 810 (449)     | 0.239                 | 0.202         | 0.203    | −0.001 (−0.078, 0.079) |
| ≤3 yrs  | 1,287 (629)   | 0.194                 | 0.195         | 0.177    | −0.003 (−0.065, 0.058) |
| any     | 1,622 (772)   | 0.167                 | 0.151         | 0.144    | −0.002 (−0.057, 0.051) |

Every permutation p-value is below 0.001. For raw scores, r = 0.30 (1-year gap) against a null of 0.13, which reflects year-level score drift.

- **By entity rule** (≤3 yr, demeaned): strict r = 0.190 (1,075 pairs); name-only r = 0.182 (1,533); including NW lots r = 0.209 (1,393).
- **By country** (≤3 yr): Guatemala 0.41 (240 pairs), Honduras 0.25 (197), Brazil 0.20 (216), Costa Rica 0.16 (179), El Salvador 0.11 (245, p = 0.09), Nicaragua 0.04 (157, ns), Colombia −0.17 (53, ns).
- **Top 10 again:** among returners within 3 years, a top-10 farm is top 10 again 45.4% of the time, against 32.0% for a farm that was not top 10. Overall, 31% of placements are top 10.

Persistence is real but modest. Two factors push the true value higher than these figures: only lots above the cut-off are observed, which compresses the score range, and cupping has measurement noise. Farm-level quality is therefore likely more persistent than r ≈ 0.2 suggests, but it cannot be measured from winners-only data.

### 3. Reputation premium in price

4,487 CoE-tier lots have both a price and a score; 41.5% come from a farm with a prior placement.

| model                                                   | effect                                                                                             | p      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| score, score², competition FE                           | prior placement +2.1%                                                                              | 0.10   |
| + log lot size                                          | **+3.1%**                                                                                          | 0.007  |
| + Geisha indicator                                      | +2.5%                                                                                              | 0.02   |
| + placement-position buckets (1 / 2–3 / 4–10 / 11+)     | +2.7%                                                                                              | 0.005  |
| drop each country's first 3 data years (left-censoring) | +2.7%                                                                                              | 0.015  |
| number of prior placements                              | +1.5% per placement                                                                                | <0.001 |
| prior **top-10** vs no prior placement                  | **+6.5%** (p < 0.001); +8.4% over a prior placement outside the top 10, which is itself −1.7% (ns) |        |
| same, + position buckets                                | +5.8% vs no prior placement (p < 0.001)                                                            |        |
| within-farm (farm FE)                                   | +0.8% per prior placement                                                                          | 0.28   |

- **Scale:** one cupping point near 87 is worth about +13.5% in price. The model explains R² ≈ 0.89, with score dominant.
- **By country:** El Salvador +6.8% (p = 0.007), Guatemala +4.9% (p = 0.06); Brazil, Colombia, Costa Rica, Honduras and Nicaragua are not significant (−3% to +3%).
- **By era:** 1999–2010 +4.0% (p = 0.03), 2011–2018 −0.6% (ns), 2019–2026 +4.0% (p = 0.04).

The premium is cross-sectional: well-known top estates sell for a little more at the same score. Unobserved farm traits (exporter relationships, marketing, farm brand, lot presentation) could explain this as easily as "reputation" could. A farm does not measurably earn more as its placement count grows.

### 4. Buyer relationships

- 4,585 lots have parsed buyers, with 1,652 distinct normalized buyer names. The most frequent are Wataru (727 lots), Maruyama (174), Kyokuto Fadie (154), Kaffebrenneriet (124), Time's Club (120), Nippon Trading (110) and TOA (103).
- **Pairs with buyer data on both sides:** 1,673 consecutive-appearance pairs (799 farms). In 11.6% (194) a buyer repeats, against 4.9% by chance (95% 3.9–5.7%), a 2.4× lift.
- **Excluding Wataru:** 11.4% against 3.0%, a 3.9× lift (n = 1,347), with the chance draw restricted to farms that still have a non-Wataru buyer.
- **By gap:** 16.3% when appearances are a year apart, against 6.9% when the gap is longer.
- **By country:** Nicaragua is highest at 21%; El Salvador (6%) and Colombia (5%) are lowest.
- **Per farm:** of the 799 farms with buyer data in 2+ years, 197 (24.7%) had some buyer win them in 2+ years, giving 301 distinct repeat buyer–farm pairs.
- **Longest relationships:**
  - Maruyama won El Injerto in 5 years.
  - The REC/TAOCA/GESHARY group (Taiwan) won Hacienda Copey–Itadaki in 4 years.
  - Wataru won El Topacio and Santa Rosa (both El Salvador) in 4 years each.
  - Kyokuto Fadie won El Morito in 4 years.
  - Nozy won La Gran Manzana in 4 years.

## Caveats (read before quoting)

- **Selection.** CoE entry is voluntary, and only placers are published. ACE pages do not give entrant counts, so a base rate ("what share of _entrants_ place twice") cannot be computed. A farm missing from a year may not have entered, may have lacked a qualifying lot, or may have sold privately. All persistence here is conditional on entering _and_ placing. These are statements about the visible tail of the quality distribution, not all farms.
- **Range restriction.** Only lots above the cut-off are seen, which compresses scores and attenuates the correlations in §2.
- **Thresholds and structure changed** over 25 years: cut-off from 84 to 87, the NW tier introduced, category-split rankings from 2024, two Brazilian contests in 2012–2018, and Colombia's regional rotation. Score-based within-competition percentiles and competition fixed effects absorb most of this, not all.
- **Entity resolution** is heuristic. Results are bracketed by the strict and name-only rules, and the conclusions hold across them. Family succession (a farm passing to a son or daughter) is linked through a shared surname only when the owner names share a second token, the surname is rare in the country, the regions overlap, or both owners are listed by that surname alone. A farmer who renames the farm is not linked.
- **Prices** are nominal USD $/lb high bids (competition fixed effects absorb year-level inflation). Split lots count separately, with errors clustered by farm. "Prior placement" is observed only inside the data window; dropping each country's first three years did not change the result.
- **Buyer names** are noisy. Agents (Wataru) and buying groups bid on behalf of many roasters, so a repeat buyer is not necessarily the same end roaster.
- **Data gaps:** see "Source data problems" above.

## Files

- `sources.csv`: 164 page URLs and fetch times.
- `fetch_pages.py`, `parse_coe.py`, `analyze.py`: downloader, parser and analysis.
- `analysis_output.txt`: full numeric output.
- Not committed (`.gitignore`; republishing rights unresolved): `raw/` fetched HTML, `coe_lots.csv` lot-level dataset (4,927 rows, with source URL per row), `coe_entities.csv` lots plus resolved farm ids, and `parse_log.csv` per-page parse diagnostics.
- `results_tables/*.csv`: coverage, repeat appearance, score persistence (pooled and by country), price regressions (pooled and by country), return by top-10, most frequent farms, top buyers, repeat buyer–farm pairs.
