# Outline: The 13x Information Gap: Green Coffee's Real Transparency Problem Isn't Price

**Pillar:** market-intelligence
**Target:** 1,500–2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-scraper/SUPPLIERS.md, repos/coffee-app/notes/MARKET_ANALYSIS.md, Supabase coffee_catalog data (26 suppliers, 1,258+ products)

## Thesis

The specialty coffee industry has rallied around price transparency; initiatives like the SCA/Emory Transaction Guide and Azahar's Sustainable Coffee Buyer's Guide address what buyers pay. But the larger, mostly invisible problem is _product metadata_ transparency: across 26 green coffee suppliers, the number of structured data fields per product ranges from 1 to 13. Worse, the gap is inversely correlated with decision relevance; the attributes that matter most to informed purchasing (cup scores, arrival freshness, farm provenance) are the ones least consistently disclosed. This is Akerlof's lemons problem hiding inside a market that thinks it already solved transparency.

## Voice Constraints

- Short and punchy. 1,500–2,000 words max.
- Gladwell/Freakonomics framing: the market solved the wrong transparency problem first.
- No salesmanship, no narrative arc. Get to the data immediately.
- Data and analysis over narrative. The numbers ARE the argument.
- 2–3 research citations that directly reinforce specific claims.
- Every section earns its place. If it doesn't deliver new insight, cut it.
- Purveyors as one-sentence illustration of the normalization problem, not a pitch.

## Verification Checklist

- [ ] Confirm field count ranges (1–13) against current SUPPLIERS.md (counts may shift as scrapers update)
- [ ] Verify scoreValue coverage is still ~19% at draft time (query coffee_catalog for non-null score_value percentage)
- [ ] Verify arrivalDate coverage is still ~31% (query coffee_catalog for non-null arrival_date percentage)
- [ ] Confirm total supplier count matches current live scrapers
- [ ] Check that SCA Transaction Guide reference is still accurate (coffeebuyers.org)
- [ ] Verify Akerlof citation is used correctly (information asymmetry between buyers and sellers, not just about defects)

## External References

1. **Akerlof, G.A. (1970). "The Market for 'Lemons': Quality Uncertainty and the Market Mechanism." Quarterly Journal of Economics, 84(3), 488–500.**

   - Foundation: when sellers control information disclosure and buyers can't observe quality pre-purchase, markets degrade. Green coffee metadata is the same dynamic; buyers can't compare what they can't see.
   - URL: https://academic.oup.com/qje/article-abstract/84/3/488/1896241

2. **Perfect Daily Grind (2018). "Green Coffee Pricing Transparency Is Critical (And Complicated)."**

   - Key quote: Jon Allen (Onyx Coffee Lab): "No one really shares anything about buying green coffee... many people have really no idea what something is worth."
   - Useful for establishing that the coffee industry recognizes its own information problem but has framed it entirely as a _price_ problem.
   - URL: https://perfectdailygrind.com/2018/04/green-coffee-pricing-transparency-is-critical-and-complicated/

3. **SCA/Emory Sustainable Coffee Buyer's Guide (coffeebuyers.org)**
   - Pre-competitive tool using farmer-donated data to display true cost of production across regions. Represents the state of the art in price transparency. Good foil: this is what the industry has built for price. Nothing comparable exists for product metadata.
   - URL: https://www.coffeebuyers.org/

## Structure

### 1. Coffee solved the wrong transparency problem first (~350 words)

Open with the state of price transparency in specialty coffee. SCA/Emory Transaction Guide, Azahar's Buyer's Guide, Counter Culture's cost-per-pound disclosures. The industry is justifiably proud of this progress.

Then the pivot: price transparency tells you what the seller paid. It doesn't tell you what you're buying. When I set out to build a comparison tool across 26 green coffee suppliers, the problem wasn't finding prices. It was finding _anything else_.

Key data point: 17 unique product attributes exist across the market. No single supplier discloses all of them. The range is 1 to 13 fields per supplier. The median is 7. That means the average product listing is missing 60% of the attributes that _exist somewhere_ in the market.

### 2. The data that matters most is the data that's least available (~400 words)

Field coverage breakdown (from scraping 26 live suppliers):

| Attribute         | Coverage | Decision Relevance               |
| ----------------- | -------- | -------------------------------- |
| Country of origin | 92%      | Low (too broad to differentiate) |
| Processing method | 88%      | Medium                           |
| Region            | 73%      | Medium-high                      |
| Cultivar/variety  | 73%      | High                             |
| Grade             | 62%      | High                             |
| Cupping notes     | 65%      | High                             |
| Cup score         | 19%      | Very high                        |
| Arrival date      | 31%      | Very high                        |
| Farm provenance   | 27%      | Very high                        |

The three fields with the highest decision relevance for an informed buyer (cup score, arrival date, farm provenance) are disclosed by fewer than a third of suppliers. Meanwhile, origin country, the broadest and least differentiating attribute, is near-universal.

This isn't random. Broad attributes are cheap to provide (they're on the bag). Decision-critical attributes require investment: cupping the coffee, tracking logistics, maintaining relationships with farms. The information gap maps directly to the cost of producing that information.

### 3. This is the lemons problem, but for metadata (~350 words)

Akerlof's 1970 insight: when sellers know more than buyers about product quality and disclosure is voluntary, the market selects against quality. Buyers can't distinguish good from bad, so they pay average-quality prices, and high-quality sellers exit.

Green coffee has a variant: it's not that bad coffee drives out good coffee. It's that _low-information listings drive out high-information comparisons._ A buyer shopping across suppliers literally cannot compare an Ethiopian Yirgacheffe listed with 3 fields against one listed with 11 fields. They default to price and vibes. The supplier who invested in cupping, tracking arrival dates, and documenting farm relationships gets no market reward for that disclosure because the buyer has no frame of reference.

The fix isn't blockchain or certification. It's aggregation and normalization. When you pull 26 suppliers into one data layer and align their schemas, the metadata gap becomes visible for the first time. Suddenly you can see that one $7/lb Ethiopian has a cup score, a 2024 arrival date, and a named washing station, while another $7/lb Ethiopian has... "Ethiopian."

### 4. This pattern shows up everywhere sellers control disclosure (~300 words)

Green coffee is a particularly clean example, but the pattern is universal in markets where:

- Products are semi-commoditized (similar underlying good, differentiated by attributes)
- Quality is hard to assess pre-purchase (you can't cup the coffee before buying it)
- Sellers control which attributes they disclose (no mandatory reporting standard)

Wine has a version of this (vintage, appellation, vineyard vs. "red wine from France"). Real estate had it before Zillow normalized listings. Job postings have it now (salary transparency laws are the regulatory response to exactly this dynamic).

The general principle: in any market where sellers choose what to disclose, the information gap between listings will be larger than the quality gap between products. Aggregators who normalize seller data create value precisely because they make the gap visible.

### 5. What normalization actually reveals (~250 words)

When you force 26 different data schemas into a common format, three things happen:

First, "comparable" products stop looking comparable. Two coffees from the same origin at the same price diverge sharply once you align their metadata. The informed buyer and the uninformed buyer are shopping in functionally different markets.

Second, the missing data becomes as informative as the present data. A supplier that doesn't list arrival dates is probably not tracking freshness. A supplier that doesn't provide cup scores probably isn't cupping. The absence is a signal, not just a gap.

Third, you discover that some suppliers are massively underpriced relative to their information density. The supplier providing 11 fields and scoring their coffees is often charging the same per-pound as the supplier providing 3 fields. The market hasn't priced in disclosure quality because nobody could see it until the data was normalized.

Brief, one-sentence purveyors reference: this is the core thesis behind building a normalized coffee data layer.

Close with the transferable principle: before you can fix information asymmetry, you have to make the asymmetry visible. In green coffee, as in most markets, the first step isn't better data. It's showing people how much data they're missing.
