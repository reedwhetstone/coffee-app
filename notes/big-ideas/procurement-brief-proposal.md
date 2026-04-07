# Proposal: Purveyors Procurement Brief

_Created: 2026-04-07_
_Status: Proposal_
_Priority: High; first revenue product candidate_

## The Idea

A weekly 1-page intelligence brief delivered to paying subscribers. Not a blog post. Not a newsletter. A procurement tool that tells green coffee buyers what changed this week and what it means for their purchasing decisions.

Think: the coffee equivalent of a commodity trading desk's morning brief. Dense, data-driven, opinionated.

## Why This, Why Now

We already have the data infrastructure:
- 41 live suppliers scraped daily
- `price_index_snapshots` with 90+ days of history
- `market_daily_summary` with trend deltas (7d, 30d)
- `supplier_daily_stats` with per-supplier health metrics
- Arrivals and delistings tracked with timestamps
- Wholesale vs retail segmentation
- Origin-level price distributions with IQR/stdev

The analytics page shows this data to authenticated users. The Procurement Brief packages it into a decision-ready format for buyers who don't have time to explore dashboards.

The gap in the market: no one is doing systematic, cross-supplier green coffee price intelligence at this granularity. Individual importers publish their own offering lists. Trade publications cover macro trends. Nobody is doing the weekly cross-section analysis that a buyer with 3-5 supplier relationships actually needs.

## Minimum Viable Brief (Week 1)

One page. PDF or styled HTML email. Five sections:

### 1. Price Movers

Biggest week-over-week median price changes by origin. Pull from `price_index_snapshots` comparing latest vs 7 days prior.

Example output:
```
Ethiopia Yirgacheffe: $7.20/lb -> $6.85/lb (-4.9%)  down
Colombia Huila: $5.90/lb -> $6.40/lb (+8.5%)        up
Kenya AA: stable at $8.10/lb (+/-0.3%)               flat
```

### 2. Notable New Arrivals

Beans stocked in the last 7 days that stand out. Criteria: unusual origin, competitive pricing, high score, rare processing method, or from a supplier that rarely adds inventory.

Pull from `coffee_catalog` where `stocked_date >= 7 days ago`, cross-reference with historical pricing for the same origin to flag whether the price is above or below recent median.

### 3. Origin Supply Signals

Origins where the number of stocked listings is expanding or contracting meaningfully. This is a leading indicator: when Ethiopia listings drop 20% in a week, it usually means a harvest transition or importer allocation shift.

Pull from `supplier_daily_stats` and `price_index_snapshots` to show supply count trends by origin over 30 days.

### 4. Supplier Reliability Shifts

Flag suppliers whose catalog size, update frequency, or data completeness changed significantly. A supplier that dropped 30% of listings or stopped updating for 5+ days is a signal.

Pull from `supplier_daily_stats` comparing current week to 4-week rolling average.

### 5. Value Lots

Beans priced meaningfully below their origin's current median with reasonable quality indicators. The "you should look at this before it sells out" section.

Pull from `coffee_catalog` where `stocked = true` and `price_per_lb < origin_median * 0.85` (or similar threshold), filtered to exclude known low-quality sources.

## Data Sources (All Existing)

| Section | Primary Table | Supporting Tables |
|---|---|---|
| Price Movers | `price_index_snapshots` | `market_daily_summary` |
| New Arrivals | `coffee_catalog` | `price_index_snapshots` (for context pricing) |
| Origin Supply | `supplier_daily_stats` | `price_index_snapshots` |
| Supplier Reliability | `supplier_daily_stats` | `coffee_catalog` (listing counts) |
| Value Lots | `coffee_catalog` | `price_index_snapshots` (origin medians) |

No new scraping. No new data collection. This is a packaging and analysis layer on top of existing infrastructure.

## Go-to-Market: Design Partner Cohort

### Structure
- 5 slots, direct outreach
- Target: small roasters (5-50 bag/month volume) and independent green buyers
- Monthly subscription: **$350/month** (positions it as a business tool, not content)
- 3-month minimum commitment
- Includes: weekly brief + a quarterly 30-min call to calibrate what's useful

### Why $350/month
- A roaster buying 20 bags/month at $6/lb spends ~$8,400/month on green coffee
- Finding one better deal per month at even $0.50/lb savings on 5 bags = $165 saved
- The brief pays for itself if it surfaces one good deal every other month
- $250 felt too cheap for a B2B procurement tool; $500 might scare off the first 5
- $350 signals "this is serious data" without requiring enterprise budget approval

### Finding the First 5
- Direct outreach to roasters who already use purveyors.io (we have signup data)
- Coffee Twitter/Instagram DMs to roasters who publicly discuss sourcing
- Specialty coffee forums (Home-Barista commercial section, r/roasting)
- One blog post that functions as a product launch announcement, not generic content

### What Design Partners Get Beyond the Brief
- Input on what sections matter most (we'll iterate the format based on their feedback)
- Early access to API endpoints for programmatic price data (if they want it)
- Name recognition as founding PPI members when we scale

## Build Plan

### This Week (MVP)
1. Write a SQL query or script that generates each section's raw data
2. Format it into a clean 1-page template (could start as markdown, convert to PDF)
3. Generate the first brief manually from this week's data
4. Review it ourselves: does this feel like something worth $350/month?

### Week 2
5. Send the sample brief to 10-15 prospective design partners
6. Pitch: "We built this for ourselves. We think you'd find it useful. $350/month for early access, 5 slots."
7. If 3+ say yes: we have a product. Build the delivery pipeline (automated generation + email delivery).
8. If 0 say yes: learn why. Is it the content? The price? The format? The audience?

### Week 3+
9. Automate brief generation (cron job: query data, format, generate PDF/email)
10. Build a simple subscription management flow (Stripe, likely reuse existing purveyors.io billing)
11. Iterate format based on design partner feedback

## What This Is Not

- Not a newsletter (newsletters are free, ad-supported, or low-value)
- Not a blog post series (blog posts are marketing; this is product)
- Not a dashboard (dashboards require the user to interpret; the brief is pre-interpreted)
- Not a general market report (it's specific to US specialty green coffee importers we track)

## Revenue Math

At scale (not design partner pricing):

| Cohort | Price | MRR | ARR |
|---|---|---|---|
| 5 design partners | $350 | $1,750 | $21,000 |
| 20 subscribers | $400 | $8,000 | $96,000 |
| 50 subscribers | $450 | $22,500 | $270,000 |
| 100 subscribers | $500 | $50,000 | $600,000 |

The US specialty roaster market is ~4,000 companies. Even 1% penetration at $400/month is $192K ARR. And the marginal cost of serving each additional subscriber is near zero since the data infrastructure already exists.

## Risk and Open Questions

1. **Is the data good enough?** Our scraper covers 41 suppliers. The US specialty green market probably has 80-100 meaningful importers. We cover maybe 50-60% of the market. Is that enough for a buyer to trust our price signals?

2. **Legal/terms risk?** We're reselling derived intelligence from scraped supplier data. Most supplier websites don't prohibit price aggregation, but some might push back if they realize their pricing is being systematically compared. Mitigation: we never republish raw listings or identify specific beans. The brief shows origin-level trends, not "Supplier X has Bean Y at $Z."

3. **Competitive moat?** If this works, what stops someone with more resources from replicating it? Answer: 90+ days of historical data, established scraping infrastructure, and the embedded analytics platform. By the time someone catches up on data collection, we'll have iterated the product 10 times based on real buyer feedback.

4. **Does the audience even read weekly reports?** Some buyers might prefer real-time alerts ("Ethiopia dropped 5% today") over weekly summaries. The brief is the starting point; alerts could be a natural upsell.

## Decision

Ship the first brief this week. Use existing data. Don't overengineer the delivery mechanism. The question isn't "can we build this?" (we already have the data). The question is "will 5 people pay $350/month for it?"

Everything else follows from the answer to that question.
