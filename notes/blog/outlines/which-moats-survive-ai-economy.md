# Outline: Which Moats Survive When AI Makes Everything Else a Commodity?

**Working title:** Distribution, Data, Compliance, Speed: Which Moats Actually Survive an AI Economy?
**Pillar:** ai-first-product
**Tags:** ai, moats, defensibility, strategy, competitive-advantage
**Target word count:** 1,800-2,000
**Status:** outlined

## Thesis

AI compresses the time it takes to build software. It does not compress the time it takes to accumulate defensible assets. The moats that survive are the ones that required elapsed, real-world time to build and that no improvement in AI capability can replicate faster. Most moat taxonomies stop at "data" and "network effects." The full picture is more interesting and more useful.

## Why this post, why now

- The existing published post ("The Real AI Moats Aren't Software," Feb 2026) reacted to Citrini's viral report and focused on data moats and outcome-based pricing. Good post, but it was a reaction piece, not a systematic framework.
- Michael Bloch (Quiet Capital) published a viral thesis in Mar 2026 identifying five surviving moat categories. Forbes covered it. Euclid Ventures, Codurance, Edison Partners, and Baytech Consulting have all published on this in Q1 2026. The discourse is live.
- Reed's instinct to go beyond the standard list (distribution, compliance, speed) is the right frame. Most pieces stop at data + network effects. The interesting moats are the ones people underweight.
- This post synthesizes the best thinking into one taxonomy, adds moats the conversation is missing, and gives builders a decision framework.

## Differentiation from existing "Real AI Moats Aren't Software"

| Existing post covers | New post covers |
| --- | --- |
| Data as moat | Data as moat (deeper: compounding vs static distinction) |
| Work-output pricing | Distribution moats (underweighted in discourse) |
| Enterprise switching costs | Compliance/regulatory moats |
| General "build on data" advice | Speed-as-moat critique (Euclid/NFX tension) |
| | Workflow embedding (Edison Partners) |
| | Capital at scale (Bloch) |
| | Trust as signal in a commoditized market |
| | Integration depth vs surface adoption |
| | Moat durability ranking / framework |

## Structure

### Opening: The Moat Question Everyone Is Asking Wrong (200 words)

- Most AI moat pieces ask "what's defensible?" The better question is: "which advantages actually deepen as AI gets cheaper?"
- The Citrini/Citadel debate (Feb 2026) framed it as binary: SaaS dies or doesn't. The real shift is more nuanced. Some moats compress. Others compound faster because of AI.
- Michael Bloch's viral Quiet Capital thesis (Mar 2026): five categories. Good start, but missing some and conflating others.
- Thesis: the surviving moats fall into two buckets: (1) time-locked assets that required real-world elapsed time, and (2) compounding assets that get stronger the faster AI moves. Builders need to know which kind they're building.

### Section 1: The Compression Thesis -- What AI Actually Erodes (300 words)

- AI compresses "things that are hard to do." Software features, integrations, UI polish, basic automation. These were measured in months; now measured in hours.
- The "thin wrapper" death: VCs stopped funding generic AI SaaS. Baytech data: AI captured 50% of all global startup funding in 2025, but it concentrated in infrastructure and foundation models. Application-layer generic wrappers are effectively unfundable.
- What this means practically: if your moat is "we built it first" or "our UI is better," that moat is evaporating. The CIO reviewing a $500k renewal is asking "can we just build this ourselves?" That's not speculation; that's budget meetings right now.
- But: there's a gap between "technically possible" and "actually adopted at enterprise scale." That gap is measured in years. Enterprise SaaS has <1% monthly churn. Not because the software is irreplaceable, but because switching costs are enormous.

### Section 2: The Time-Locked Moats (500 words)

These are assets that required real-world elapsed time to accumulate. No amount of AI acceleration can build them faster.

**Distribution.** The most underweighted moat in the current discourse. Once you own the customer relationship and the channel, you decide which tools get adopted. Bloch: "Whoever holds the liquidity already compounds; everyone else fights for scraps." DoorDash's three-sided network (drivers, restaurants, customers) can't be cloned by building better software. The cold start problem gets harder as AI makes it trivial to build competing products: a hundred well-built alternatives compete to bootstrap the same network. Distribution isn't just go-to-market. It's the asset that determines which AI gets deployed.

**Regulatory permission.** Government timelines move at the speed of politics, not technology. Bank charters, FDA approvals, defense procurement contracts, classified clearances. Bloch cites Anduril: classified contracts and procurement clearances that no AI can shortcut. As AI capability increases, the regulatory surface area expands, not contracts, because the stakes rise. Codurance: the EU AI Act is creating "compliance moats" where strategic compliance with complex regulation becomes a barrier to entry.

**Capital at scale.** The most underweighted factor per Bloch. The endgame of the AI cycle is physical: chip fabs (~$20B), nuclear plants (~$10B), satellite constellations (billions). The ability to finance and deploy at that scale depends on institutional trust, track record, and relationships built over decades. AI doesn't make it easier to raise $20B.

**Physical infrastructure.** Factories, power plants, battery networks, data centers. Base Power: 100+ MWh of residential battery capacity across Texas, building its own manufacturing facility. A competitor would need to replicate years of physical deployment.

### Section 3: The Compounding Moats (500 words)

These get stronger the faster AI moves. They're not time-locked; they're time-amplified.

**Proprietary data (the compounding kind).** Not static datasets that were expensive to collect. Data generated continuously through operations that are themselves defensible. Orchard Robotics: cameras on farm equipment tracking billions of fruit across millions of trees, season after season. A competitor needs to drive the same cameras through the same orchards for years. Every cycle adds signal. Every user interaction sharpens the model. The distinction between static and compounding data is critical. Most "data moat" claims are the former; the durable ones are the latter.

**Workflow embedding.** Edison Partners' thesis: "AI becomes infrastructure when removing it introduces operational risk." This happens as systems accumulate workflow embedding, regulatory trust, edge-case learning, and human-in-the-loop controls. The moat isn't the software. It's the operational dependency. Removing the system means retraining staff, re-certifying compliance, and re-learning edge cases accumulated over years.

**Integration depth.** Surface-level API connections are trivial to replicate. Deep integrations into mission-critical workflows, where the AI system has learned the organization's specific edge cases, exception patterns, and institutional knowledge, are not. Euclid Ventures: "Vertical AI that can graduate into a lasting platform will need to do more than innovate at a single layer of the customer value chain."

**Speed (but not the way most people think).** NFX and Altimeter argue speed is the moat: execution velocity, learning loops, talent magnetism. Euclid pushes back: "Speed is the moat until it isn't." Speed creates learning loops (more iterations = more data = tighter product-market fit), but speed alone is a temporary advantage. The durable version is the accumulated learning from speed: the iterations you've completed, the insights you've gathered, the course corrections you've made. The moat isn't moving fast. It's having moved fast for longer.

### Section 4: Trust as the Meta-Moat (200 words)

When software is a commodity, trust becomes the differentiator. This shows up in:
- **Brand as signal:** In a market flooded with AI-generated content and AI-built products, provenance matters. Who built this? Who vouches for it? Who stands behind it when it's wrong?
- **Audit trails and explainability:** Banks deploying AI credit scoring need explainable models and audit trails for regulators. That infrastructure is a moat.
- **Human-in-the-loop as asset, not cost:** The systems that keep humans in the loop aren't slower; they're more trustworthy. Trust compounds.

### Section 5: A Durability Framework (200 words)

Not all moats are equal. A rough ranking by durability in an AI-accelerated world:

1. **Regulatory permission** (hardest to compress; government speed is fixed)
2. **Physical infrastructure** (requires atoms, not bits; years to build)
3. **Capital at scale** (institutional trust takes decades)
4. **Compounding proprietary data** (gets stronger over time, but requires operational flywheel)
5. **Distribution / network effects** (hard to bootstrap, but once established, very sticky)
6. **Workflow embedding** (strong, but vulnerable to "good enough" AI alternatives)
7. **Speed / execution velocity** (real but temporary; durable only if converted to learning)

The test for builders: does your advantage get stronger as AI gets cheaper? If yes, build on it. If no, it's a feature, not a moat.

### Closing: Choose Accordingly (200 words)

The moats are shifting, not vanishing. Everything that can be replicated in a sprint will be. Everything that takes years of accumulated data, domain knowledge, regulatory permission, or physical presence to build won't be.

The builders who understand this distinction will make better bets. Build on data that compounds, not data that's static. Own the distribution channel, not just the product. Turn compliance from cost into barrier. Move fast, but convert speed into learning, not just shipping.

One illustrative example from coffee: Purveyors' moat isn't the web app or the scraper code. Both could be replicated in weeks. The moat is the normalized dataset across 41 suppliers, built over months of daily scraping, cleaning, and enrichment. That's compounding data that gets harder to replicate every day it runs. The software is the vehicle. The data is the asset.

## Source references

1. Michael Bloch (Quiet Capital), "Five Moats That Survive AI Compression," Mar 2026. Covered by Forbes (Josipa Majic Predin, Mar 31, 2026).
2. Euclid Ventures, "Dude, Where's My Moat?" Jul 2025. Speed-as-moat critique, workflow + data as immutable primitives.
3. Codurance, "Beyond Functionality: Building Durable Moats in the AI Era," Mar 2026. Compliance moats, niche specialization, regulatory barriers.
4. Edison Partners, "What Actually Creates Defensibility in Mission-Critical AI," Feb 2026. Workflow embedding, operational switching costs, edge-case learning.
5. Baytech Consulting, "Why Generic AI Startups Are Dead," Mar 2026. VC funding concentration, thin-wrapper death, distribution moats.
6. NFX, "Speed and AI," 2025. Execution velocity as competitive advantage.
7. Altimeter (Jamin Ball), "Clouded Judgment #53025: Moats in AI," 2025. Speed taxonomy.
