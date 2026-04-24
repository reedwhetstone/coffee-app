# Outline: What is Purveyors?

**Pillar:** supply-chain
**Target:** 1,500-2,000 words
**Status:** drafted (PR #13)
**Source material:** notes/MARKET_ANALYSIS.md, notes/API_notes/API-strategy.md, brain/projects/purveyors-blog.md

## Thesis

The green coffee supply chain is built exclusively for commercial buyers. If you're a hobbyist, you're an afterthought. Purveyors exists because that misalignment of incentives is both a real problem and a real opportunity: the same platform that opens up sourcing for home roasters can serve commercial needs for efficiency and scale through shared data infrastructure.

## Verification Checklist

- [ ] Supplier count matches reality (currently 12 live)
- [ ] Feature descriptions match actual codebase
- [ ] Pricing tiers match what's deployed
- [ ] Competitive claims are defensible
- [ ] Decent Espresso claims verifiable (prosumer → commercial crossover)

## Structure

### Opening: How I Got Here (400 words)

Personal origin story. I'm a home roaster. When I started trying to source green coffee, I hit a wall. The entire supply chain is built for B2B. If you're a hobbyist wanting to get into the space, you're left with a fragmented mess and no real understanding of what makes one coffee better than another.

You see it on Reddit constantly: "Where do I buy green coffee?" And the answers are all over the place. People buying from Amazon, of all places. Green coffee is closer to fresh produce than it is to something that should sit indefinitely in an uncontrolled warehouse next to iPhones. The quality degradation is real, and most beginners don't even know to worry about it.

There is genuine demand for super high quality at reasonable prices in the hobby market. People are willing to pay for the best. But nobody has built the tools or the market access to serve them well.

### The Incentive Misalignment (350 words)

The core problem isn't just fragmentation. It's a structural misalignment of incentives between commercial and consumer.

Commercial coffee indexes for scale and efficiency. Consistency at volume. That's rational for a cafe doing 200 drinks a day. But consumers, especially the growing hobby market, want craft. Unique experience. Excellence. These are fundamentally different value functions, and the entire supply chain is optimized for only one of them.

You can see this playing out in hardware already. Companies like Decent Espresso built prosumer machines for coffee nerds, and the quality was so good that legitimate cafes started putting them on the counter. The prosumer market didn't just coexist with commercial; it started pushing commercial innovation forward. The best cafes now signal legitimacy to customers by using gear designed for obsessives, not industrial equipment.

The same dynamic exists in green coffee sourcing, but nobody has built the bridge. The best supply chains are indexed exclusively to bulk buying at commercial quantities. A home roaster wanting 2 lbs of a specific lot from a specific farm? Good luck. The infrastructure doesn't exist for you.

### What Purveyors Actually Is (400 words)

- A coffee intelligence platform: catalog, inventory tracking, roast profiling, profit analysis
- A data pipeline: scrapers pulling from 12+ suppliers, normalizing into a single schema
- An API: the same data served to the web app, to developers, to AI agents
- An AI layer: semantic search ("find me a washed Ethiopian under $8 with bright acidity"), tasting note generation, recommendations

What it's NOT: a coffee e-commerce site. We don't sell beans. We aggregate, normalize, and serve the data that helps people make better sourcing and roasting decisions.

The key insight: the same platform can serve both sides. Open up the market for hobbyists who need discovery, comparison, and quality signals. And connect the commercial market's need for efficiency and scale through the same API tools and data infrastructure. One data layer, two very different user needs, served by the same architecture.

### Where It's Going (350 words)

- **GenUI / AI-first interface:** Moving from page-based navigation to a conversational workspace. The AI doesn't just answer questions; it orchestrates the entire experience. (Tease the GenUI posts coming later.)
- **API-first architecture:** Everything the web app does goes through the same API we sell externally. If an AI agent wants to query our coffee catalog, it uses the same endpoints a human-facing dashboard uses. This is how the hobbyist tools and the commercial integrations live on the same platform without compromise. (Tease the B2CC post.)
- **Market intelligence:** The scraper data tells a story about the market that nobody else is publishing. Pricing trends, availability patterns, origin shifts. We're going to start sharing that publicly.
- **The blog itself:** This blog is part of the product. It's where the thinking happens in public. It's where the architecture decisions get stress-tested by explaining them.

### Closing: Not a Pitch (200 words)

Manufacturing background. Founded purveyors to solve a problem I had as a home roaster. Building it with an AI agent as a co-developer. The blog is the honest record of what it's like to build an AI-first product from scratch.

Not a press release. Not a pitch deck. Just the work.
