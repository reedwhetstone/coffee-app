# Outline: What Should a Data API Actually Sell?

**Pillar:** api-architecture
**Target:** 1,500–2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/API_notes/APITIER.md, repos/coffee-app/notes/API_notes/API-strategy.md, brain/references/b2cc-agents-as-customers.md

## Thesis

Action APIs (Stripe, Twilio) should charge per unit of work — the action IS the value. Data APIs copied this model without asking whether "a call" is the right unit. It isn't. For a data API, the value lives in coverage, freshness, and quality; the call is just the pipe. This mistake was tolerable when humans made all the calls. AI agents making 100x more calls per user will expose it.

## Voice Constraints
- Short and punchy. 1,500–2,000 words max.
- Gladwell/Freakonomics framing: the conventional wisdom (usage-based pricing = good) is right for the wrong kind of API.
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Cite numbers, specific tier data, concrete evidence.
- 2–3 citations that directly reinforce specific claims.
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist
- [ ] Confirm Explorer tier limits: 200 calls/month, 25 rows/call (APITIER.md)
- [ ] Confirm Roaster+ tier: $99/month, 10,000 calls/month (APITIER.md)
- [ ] Confirm Integrate tier: $1,500+/month, unlimited calls (APITIER.md)
- [ ] Confirm row-limiting by tier (API-strategy.md: "25 rows viewer, unlimited for paid tiers")
- [ ] Confirm the feature-gating in Explorer: no advanced cupping filters, no CSV/JSON export (APITIER.md)
- [ ] Verify Caleb John B2CC quote: "A developer makes 100 API calls/day. That developer with an agent makes 10,000."
- [ ] Verify Bain report: confirm title and core claim about AI breaking per-seat model

## External References

1. **Caleb John, "B2CC: Claude Code Is Your Customer" (2025).**
   Core data point: "A developer makes 100 API calls/day. That developer with an agent makes 10,000. Agent-to-agent communication compounds this further." Also: "Per-seat pricing dies. One human + agent replaces a team of 5. Usage-based pricing is the only model that survives." — note the important distinction: John means usage-based over per-seat, not per-call over subscription. The per-call problem is a layer below this.
   - https://calebjohn.xyz/blog/b2cc/
   - Already in brain/references/b2cc-agents-as-customers.md

2. **Bain & Company, "Per-Seat Software Pricing Isn't Dead, but New Models Are Gaining Steam" (2025).**
   Documents the shift from seat-based to usage/outcome-based models as AI agents replace headcount. Key finding: "In the short term, the customer still needs both the employee and the AI agent while it evaluates outcomes. The customer must raise its cost by 50% for an undefined period." Useful framing for why the transition is forcing pricing model redesigns across software.
   - https://www.bain.com/insights/per-seat-software-pricing-isnt-dead-but-new-models-are-gaining-steam/

3. **Financial data API precedent (contextual, use inline):**
   Bloomberg Terminal: flat subscription (~$25k/year), unlimited queries. Polygon.io: tiers by data FRESHNESS (real-time vs 15-min delayed) and coverage breadth, not by call count. Alpha Vantage: free = delayed + 25 calls/day; paid = real-time, 75–1,200 calls/min. The financial data industry settled on "tier by data quality" decades ago. The pattern is established; the B2B SaaS world just didn't copy it.

## Structure

### The Action API Mistake (~300 words)
Open with the contradiction: "usage-based pricing" is supposed to be the modern model. Per call. Pay for what you use. It works brilliantly for Twilio (charge per SMS sent), Stripe (charge per transaction processed), Mapbox (charge per map tile rendered). In each case, the API call IS the unit of value. The billing and the value align.

Data APIs copied this model without questioning the assumption. "Pay per call" sounds neutral and fair. It isn't, for data products. The data exists whether or not you query it. The call doesn't create the value — the underlying coverage, freshness, and normalization do. Charging by call is like charging a library by how many times patrons open books, rather than by the quality and size of the collection.

Concrete evidence: the standard freemium playbook for data APIs caps monthly calls (200, 1,000, 5,000). This "limits" access without actually gating the VALUE dimension. A hobbyist making 200 calls to casually browse coffee origins gets less value than an enterprise customer making a single strategic bulk query to populate a sourcing tool. Same call count, radically different value.

### What Data APIs Actually Sell (~350 words)
Break down what the actual product is for a data API, using the purveyors API as a concrete example.

What purveyors sells:
- **Coverage:** green coffee from 30+ suppliers, normalized into a single schema. No one else has this.
- **Freshness:** daily scrape cycle, so availability and pricing are current. Stale data is worthless.
- **Quality:** AI-enriched descriptions, standardized processing labels, semantic embeddings for natural language search. Raw marketing copy scrubbed out.

None of these dimensions are measured by "API calls." A customer who queries once with a complex filter (fruity Ethiopian naturals under $8/lb, in stock, washed) and gets 8 results has extracted enormous value from all three dimensions. A customer who makes 1,000 calls to poll for price changes is using the pipe, not the product.

The purveyors tiers partially understand this already. The Explorer tier (free) is limited to 25 rows per call AND restricted from advanced cupping filters and exports. The Roaster+ tier ($99/month) unlocks full filter access, CSV export, and alerts. That feature-gating is the right signal. The call limits (200 vs 10,000) are mostly noise.

The correct pricing lever for a data API: gate by data access depth, not call volume.

### The Agent Multiplier (~300 words)
The B2CC dynamic makes this urgent. Caleb John's 2025 piece documents what's already happening: a developer using AI agents generates 100x the API calls of a human developer doing the same task. A coffee sourcing agent might make 500 calls in a single session to build a comparison table that a human buyer would have assembled in one deliberate query.

Per-call limits create a structural misalignment: your highest-value customers (businesses building agentic workflows against your data) are also your highest call-volume customers. If calls are the billing unit, you're either over-charging them (relative to the value of each marginal call) or capping them at the worst moment (when their workflow is running hot).

The right model: agentic customers should pay for data access tier, not call bandwidth. An agent making 10,000 calls to the full-coverage, freshest-data tier is doing exactly what you want a customer to do. Throttling that on call count is anti-product.

Concrete implication: the Explorer tier at 200 calls/month will be exhausted by a single agent session. That's not a freemium funnel; it's a wall. The tier limit for free access should be row-count or data-scope restricted (25-row cap, basic fields only) — not call-capped. Let explorers browse freely; restrict what they can see.

### What Bloomberg Figured Out 20 Years Ago (~300 words)
Financial data companies solved this problem before the web API era.

Bloomberg Terminal: flat annual subscription (~$25k/year). You don't pay per query. You pay for access to the best-coverage, most-current financial data product. The value is the data, not the pipe.

Polygon.io (the developer-friendly modern alternative): tiers by data FRESHNESS. Free = 15-minute delayed data, limited real-time. Paid = real-time, sub-second latency. The pricing dimension is: how current is the data you're accessing? Not: how many times did you access it.

This pattern is stable and well-understood in data markets. Coverage + freshness + quality = value. Calls = neutral. The modern API-first world reinvented the wheel poorly by importing the Twilio/Stripe per-action model into a fundamentally different product category.

Data APIs should look at financial data APIs for their pricing primitives, not at SaaS action APIs. The precedent is 20 years old and the logic is airtight.

### Gate Features, Not Pipes (~250 words)
Close with the concrete prescription.

The right gating structure for a data API:

**Tier by data access depth:**
- Free: limited field set (basic filters), small result windows (25 rows), no export, daily-cached data
- Pro: full field set, all filters, CSV export, price/availability alerts, still daily-fresh
- Enterprise: custom coverage (add sources on request), real-time or near-real-time, webhooks, SLA

Call limits, if they exist at all, should be generous rate limiters (preventing abuse), not commercial gating mechanisms. A call limit that a human developer hits is a problem; a call limit that an agentic workflow hits in 10 minutes is a broken product.

The purveyors Explorer tier already has the right instincts: it gates by row count AND feature set, not just calls. The 200-call monthly cap is a legacy of the action-API playbook. Drop it (or set it at 10x) and gate on what actually correlates with value: how much data can you see, how fresh is it, and what can you do with it.

One-sentence takeaway: charge for the data, not the pipe.
