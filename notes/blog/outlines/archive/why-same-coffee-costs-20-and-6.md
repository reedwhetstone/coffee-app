> **Archived 2026-04-24.** Closed PR #118 because the concept no longer reflects current blog priorities and still felt half-baked. Keep this as source material for future pricing/quantity-tier work, not as an active outline.

# Outline: Why Does the Same Coffee Cost $20/lb and $6.58/lb?

**Pillar:** market-intelligence
**Target:** 1,500–2,000 words (HARD CEILING)
**Status:** outlined
**Source material:**

- `repos/coffee-scraper/scrape/utils/priceTierExtractor.ts` (extraction logic, wholesale threshold)
- `repos/coffee-scraper/scrape/utils/priceTierExtractor.test.ts` (real variant formats from suppliers)
- `repos/coffee-app/src/lib/utils/pricing.ts` (display logic, bulk savings calculation)
- `repos/coffee-app/src/lib/utils/pricing.test.ts` (tier calculation tests)
- `repos/coffee-app/src/lib/data/catalog.ts` (wholesale filtering in queries)
- `repos/coffee-app/src/lib/stores/filterStore.ts` (UI toggle hiding wholesale by default)
- TOOLS.md (wholesale classification rule: min tier > 5 lb)

## Thesis

The green coffee industry sorts suppliers into "wholesale" and "retail," but the data shows pricing is a continuous, nonlinear curve. That binary label isn't a description of reality; it's an arbitrary threshold that hides useful information from buyers and distorts how comparison tools (including ours) present the market. The real question isn't "wholesale or retail?" but "what's the price at my quantity?"

## Voice Constraints

- Short and punchy. 1,500–2,000 words max.
- Gladwell/Freakonomics framing: the binary everyone accepts is the thing that's broken
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Cite numbers and concrete evidence.
- 1–2 research citations that directly reinforce specific claims
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist

- [ ] Confirm `isWholesale` threshold is `> 5` lbs in priceTierExtractor.ts (verified: yes)
- [ ] Confirm catalog default hides wholesale (`showWholesale: false` behavior in catalog.ts)
- [ ] Pull real tier spread examples from scraper test fixtures (e.g., $10/lb at 5lb to $6.58/lb at 100lb)
- [ ] Confirm getBulkSavings shows up to 50% discount in test data
- [ ] Count how many suppliers in catalog have multi-tier pricing vs single-tier
- [ ] Verify the UI defaults to hiding wholesale (filterStore.ts confirmed)

## External References

1. **Robert Wilson, "Nonlinear Pricing" (Oxford UP, 1993)** — The foundational text on pricing that isn't proportional to quantity. Wilson's framework: when unit price changes with volume, the market isn't described by a single price point. A boolean (wholesale/retail) collapses a curve into two dots. Key quote from Stanford GSB summary: "Pricing is nonlinear when it is not strictly proportional to the quantity purchased." URL: https://www.gsb.stanford.edu/faculty-research/books/nonlinear-pricing

2. **Pigou's second-degree price discrimination (1920)** — The classic taxonomy. Second-degree discrimination is when price varies by quantity purchased (quantity discounts). The wholesale/retail binary is a crude proxy for what Pigou formalized as a continuous mechanism. The industry imposes a category boundary on what economics describes as a schedule. URL: https://en.wikipedia.org/wiki/Price_discrimination (Pigou taxonomy section)

3. **DataWeave, "Why Unit of Measure Normalization is Critical for Competitive Pricing Intelligence" (2023)** — Industry analysis of the e-commerce normalization problem. Same core issue: products sold in different quantities at different unit prices require per-unit normalization before comparison is meaningful. Without it, a 5lb bag at $50 looks "cheaper" than a 25lb bag at $175, even though the per-lb price drops from $10 to $7. URL: https://dataweave.com/blog/why-unit-of-measure-normalization-is-critical-for-accurate-and-actionable-competitive-pricing-intelligence

## Structure

### The Same Coffee, Three Prices (~300 words)

Open with the concrete data point: a real supplier sells a single origin at $10/lb (5 lb), $6.94/lb (25 lb), and $6.58/lb (100 lb). That's a 34% spread on the identical product. The "retail price" and the "wholesale price" aren't two products or two markets; they're points on one curve.

Key points:

- Pull 2–3 real tier examples from scraper test data (Shopify variants, Coffee Crafters format, WooCommerce variations)
- Show the savings math: getBulkSavings test shows 50% discount between lowest and highest tier for retail, 44% for wholesale
- Introduce the question: if the price varies continuously, why does the industry (and our own product) treat it as a binary?

### The 5-Pound Line (~400 words)

Our classification rule: if the smallest purchasable quantity is > 5 lbs, it's "wholesale." That's the entire decision. One line of code: `return tiers[0].min_lbs > 5`.

Key points:

- This threshold is arbitrary but not random. It approximates the home roaster / commercial roaster divide. Home roasters typically buy 1–5 lbs; commercial roasters buy 10+ lbs.
- But the threshold creates edge cases that reveal the arbitrariness: a supplier selling in 5 lb minimum quantities is "retail." A supplier selling in 6 lb minimums is "wholesale." The buyer experience is nearly identical; the label flips.
- The UI consequence: wholesale products are hidden by default (`showWholesale: false`). Buyers who would benefit from volume pricing never see it unless they toggle a switch.
- Wilson's framework applies directly: we collapsed a pricing schedule into a boolean, and the boolean now determines visibility.

### Nonlinear Pricing Is the Rule, Not the Exception (~350 words)

The green coffee market isn't unusual. Wilson (1993) showed nonlinear pricing is the dominant structure across industries: utilities, telecom, SaaS, shipping. Quantity discounts are second-degree price discrimination (Pigou 1920). The "wholesale/retail" binary is a folk taxonomy layered on top of a mechanism that economics already understands as a curve.

Key points:

- Every multi-tier supplier in our catalog is practicing nonlinear pricing. The "wholesale" label is a social category, not an economic one.
- The normalization problem (DataWeave): without per-unit price normalization, you can't compare across suppliers with different tier structures. A supplier offering $8/lb at 10 lbs might be cheaper than a "retail" supplier at $9/lb for 1 lb, but only if you're buying 10+.
- The real comparison axis isn't wholesale-vs-retail; it's "price at my quantity." The buyer's volume determines which supplier is cheapest, and that answer changes at every tier break.

### What the Data Destroys (~300 words)

When you classify nonlinear pricing into a boolean, specific information is lost.

Key points:

- **The curve shape.** Some suppliers have steep discounts (50% off at volume); others are nearly flat (5% off). The boolean can't distinguish aggressive volume pricing from token discounts.
- **The crossover point.** Supplier A might be cheaper at 5 lbs; Supplier B cheaper at 50 lbs. The boolean sorts them into different bins, making the comparison impossible without toggling filters.
- **The minimum order signal.** A 10 lb minimum isn't just a pricing statement; it's a signal about who the supplier is designed for. Flattening this to "wholesale = true" loses the operational context.
- General principle: boolean classifications on continuous spectra destroy information, and the threshold choice embeds an opinion that becomes invisible once the label sticks.

### Building for the Curve (~300 words)

What a quantity-aware marketplace would look like instead.

Key points:

- The right primitive is "price at quantity X," not "wholesale or retail." Let the buyer input their volume; show all suppliers ranked by their actual cost at that volume.
- This is what we're building toward with price_tiers as a first-class data type (jsonb array, not a single cost_lb field). The tier structure preserves the curve; the boolean is a convenience filter that can be discarded as the UI matures.
- Practical implication for buyers: if you're a home roaster buying 10 lbs/month, some "wholesale" suppliers are your best deal. If you're a commercial roaster buying 100 lbs, some "retail" suppliers with aggressive volume pricing beat the importers.
- Close with the transferable principle: whenever you see a binary classification on continuous data, ask what information the threshold destroyed.
