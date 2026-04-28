# Outline: Which Moats Survive When AI Makes Everything Else a Commodity?

**Working title:** Distribution, Data, Compliance, Speed: Which Moats Actually Survive an AI Economy?
**Pillar:** ai-first-product
**Tags:** ai, moats, defensibility, strategy, competitive-advantage
**Target word count:** 2,500–3,000
**Status:** outlined (expanded)

---

## Thesis

AI compresses the time it takes to build software. It does not compress the time it takes to accumulate defensible assets. The moats that survive fall into two buckets: (1) **time-locked assets** that required real-world elapsed time to build and that no improvement in AI capability can replicate faster, and (2) **compounding assets** that get *stronger* the faster AI moves because they feed on the output AI generates. Most moat taxonomies stop at "data" and "network effects." The full picture is more interesting and more useful — and it has a critical limit the discourse is missing.

---

## Why this post, why now

- The existing published post ("The Real AI Moats Aren't Software," Feb 2026) reacted to Citrini's viral report and focused on data moats and outcome-based pricing. Good post, but a reaction piece — not a systematic framework.
- Michael Bloch (Quiet Capital) published a viral thesis in Mar 2026 identifying five surviving moat categories. Forbes covered it. Euclid Ventures, Codurance, Edison Partners, and Baytech Consulting have all published on this in Q1 2026. The discourse is live.
- Reed's instinct to go beyond the standard list is correct. Most pieces stop at data + network effects. The interesting moats are the ones people underweight.
- This post synthesizes the best thinking into one taxonomy, adds moats the conversation is missing, stress-tests each one, and gives builders a decision framework.

---

## Differentiation from existing "Real AI Moats Aren't Software"

| Existing post covers | New post covers |
| --- | --- |
| Data as moat | Data as moat (deeper: compounding vs static distinction; flywheel mechanism) |
| Work-output pricing | Distribution moats (most underweighted in discourse) |
| Enterprise switching costs | Compliance/regulatory moats |
| General "build on data" advice | Speed-as-moat critique (Euclid/NFX tension) |
| | Workflow embedding (Edison Partners) |
| | Capital at scale (Bloch) |
| | Network effects (three types distinguished) |
| | Standards and protocols as moat |
| | Trust as signal in a commoditized market |
| | Integration depth vs surface adoption |
| | The Kodak test: why moats can be real AND irrelevant |
| | Moat durability ranking + 2×2 decision framework |
| | Red-team: which moat claims are weaker than they look |

---

## Structure

### Opening: The Question Everyone Is Asking Wrong (200 words)

- Most AI moat pieces ask "what's defensible?" The better question: **which advantages actually deepen as AI gets cheaper?**
- The Citrini/Citadel debate (Feb 2026) framed it as binary: SaaS dies or doesn't. The real shift is more nuanced. Some moats compress. Others compound faster *because* of AI.
- Michael Bloch's viral Quiet Capital thesis (Mar 2026): five categories. Good start, but missing some and conflating others.
- Introduce the two-bucket frame early and use it as a spine: **time-locked** vs **compounding**. These aren't just different moats — they respond to AI acceleration in opposite ways.
- One thing neither bucket guarantees: that the asset you're building remains *relevant* to the value chain in an AI-transformed world. Flag this — it's the Kodak problem — and promise to return to it in the framework section.

---

### Section 1: What AI Actually Erodes (300 words)

- AI compresses "things that are hard to do." Software features, integrations, UI polish, basic automation — measured in months; now measured in hours.
- **The thin-wrapper death.** VCs stopped funding generic AI SaaS. Baytech data: AI captured 50% of all global startup funding in 2025, but concentrated in infrastructure and foundation models. Application-layer generic wrappers are effectively unfundable. Note: this is *generic* wrappers — Cursor, Perplexity, and other deep-application-layer products DID get funded. The distinction matters.
- What this means practically: if your moat is "we built it first" or "our UI is better," that moat is evaporating. The CIO reviewing a $500k renewal is asking "can we just build this ourselves?" That's not speculation; that's budget meetings right now.
- **But:** the gap between "technically possible" and "actually adopted at enterprise scale" is measured in years. Enterprise SaaS has <1% monthly churn. Not because the software is irreplaceable, but because switching costs are enormous — data migration, workflow retraining, integration dependencies, compliance certification.
- The near-term dynamic isn't replacement; it's the Fortune 500 procurement manager who renewed at a 30% discount. Pricing pressure, not extinction. That's the actual curve.

---

### Section 2: The Time-Locked Moats (600 words)

*These assets required real-world elapsed time. No amount of AI acceleration can build them faster.*

**Distribution.** The most underweighted moat in current discourse. Once you own the customer relationship and the channel, you decide which tools get adopted. Bloch: "Whoever holds the liquidity already compounds; everyone else fights for scraps." DoorDash's three-sided network (drivers, restaurants, customers) can't be cloned by building better software — the cold-start problem gets *harder* as AI makes it trivial to build competing products. A hundred well-built alternatives compete to bootstrap the same network. Distribution isn't just go-to-market; it's the asset that decides which AI gets deployed.

- **Red-team:** Uber subsidized its way into distribution — doesn't that mean capital can buy elapsed time? *Response:* Uber spent $30B+ over a decade and nearly went bankrupt doing it. Subsidized distribution acquisition is a special case, not a general playbook. And they still needed elapsed clock time.

**Regulatory permission.** Government timelines move at the speed of politics, not technology. Bank charters, FDA approvals, defense procurement contracts, classified clearances. Bloch cites Anduril: classified contracts and procurement clearances that no AI can shortcut. As AI capability increases, regulatory surface area expands — the EU AI Act is creating compliance moats where strategic navigation of complex regulation is a barrier to entry (Codurance).

- **Red-team:** Regulations change — executive orders, deregulation, harmonization. *Response:* Correct, which is why regulatory moats alone are fragile. The durable version is regulatory permission *plus* a compounding moat built inside the protected window. The permission buys time; the compounding asset is what you build with that time.

**Capital at scale.** The endgame of the AI cycle is physical: chip fabs (~$20B), nuclear plants (~$10B), satellite constellations (billions). The ability to finance and deploy at that scale depends on institutional trust, track record, and relationships built over decades. AI doesn't make it easier to raise $20B.

**Physical infrastructure.** Factories, power plants, battery networks, data centers. Base Power: 100+ MWh of residential battery capacity across Texas, building its own manufacturing facility. A competitor needs to replicate years of physical deployment, not just the software that runs it.

**Standards and protocols.** The moat the discourse misses almost entirely. Whoever writes the canonical standard controls the ecosystem. SWIFT controls international wire transfers. IEEE controls wireless protocols. OpenAPI is becoming the contract for how agents talk to services. When your schema, your data format, or your protocol becomes the thing others build against, you control what "correct" looks like — and every integration built to your standard is a switching cost you didn't have to create.

- **Observation for the post:** Purveyors' listing schema (from ADR-004) is an early bet on this moat. If the normalized green-coffee listing object becomes what roasters build their sourcing workflows around, the schema is the moat — not the scraper, not the web app.

---

### Section 3: The Compounding Moats (600 words)

*These get stronger the faster AI moves. They're not time-locked; they're time-amplified.*

**Proprietary data — the compounding kind, not the static kind.** This is the distinction most "data moat" claims skip. Static datasets that were expensive to collect are not durable moats — they can be re-collected, purchased, or scraped with better tools. The durable version is data generated *continuously through operations that are themselves defensible*. Orchard Robotics: cameras on farm equipment tracking billions of fruit across millions of trees, season after season. A competitor needs to drive the same cameras through the same orchards for years. Every cycle adds signal. Every user interaction sharpens the model.

- **The flywheel mechanism** (make this explicit in the post): data → better model → better product → more users/usage → more data. Breaking any link breaks the compounding. The moat is the flywheel, not the dataset.
- **Red-team:** Couldn't a well-funded competitor just collect the same data faster with better AI? *Response:* For some datasets, yes — this is why "data moat" is overused. The test is whether the data requires the passage of real operations to generate. You can't scrape longitudinal crop-health data faster by having better scrapers. You can scrape static product listings faster.
- **Purveyors application:** The normalized coffee dataset across 41 suppliers isn't just a static scrape — it accumulates corrections, normalization edge cases, and supplier-specific parsing logic learned over months of daily runs. That accumulated cleaning intelligence is the compounding asset. Someone starting today would collect the raw HTML faster; they'd spend months relearning the same edge cases.

**Workflow embedding.** Edison Partners' thesis: "AI becomes infrastructure when removing it introduces operational risk." The moat isn't the software — it's the operational dependency. Removing the system means retraining staff, re-certifying compliance, and re-learning edge cases accumulated over years of production use.

- **Distinction from switching costs:** Switching costs are a one-time friction. Workflow embedding is an ongoing compounding effect — the longer the system runs, the more it has learned the organization's specific exception patterns, the more its removal disrupts.

**Network effects — three types distinguished.** The post should differentiate because they have very different durability profiles:
1. *Data network effects:* more users → more data → better model → more users. Durable and compounding. (Waze, Google Maps.)
2. *Social/communication network effects:* value comes from who else is on the platform. Strong but vulnerable to identity shifts. (WhatsApp is entrenched; MySpace was not.)
3. *Platform/marketplace network effects:* multi-sided markets where each side attracts the other. Most durable because both sides face switching costs simultaneously.

Most moat discussions conflate all three. For AI-era products, data network effects are the most relevant and the most commonly misidentified.

**Integration depth.** Surface-level API connections are trivial to replicate. Deep integrations into mission-critical workflows — where the AI system has learned the organization's specific edge cases, exception patterns, and institutional knowledge — are not. Euclid Ventures: "Vertical AI that can graduate into a lasting platform will need to do more than innovate at a single layer of the customer value chain."

**Speed — but not the way most people think.** NFX and Altimeter argue speed is the moat: execution velocity, learning loops, talent magnetism. Euclid pushes back: "Speed is the moat until it isn't." The Nokia/Yahoo problem: both companies moved fast for years and still got disrupted — not because a faster competitor showed up, but because the architecture shifted under them (smartphones, search). Speed creates optionality; optionality expires if not converted to durable assets. The durable version of the speed moat is *accumulated learning from speed* — the iterations completed, the insights gathered, the course corrections made. Moving fast for longer.

---

### Section 4: The Red Team (400 words)

*The strongest counterarguments to the whole framework — and what they actually reveal.*

**The Kodak test.** This is the framework's critical limit. Kodak had real, defensible moats: physical manufacturing infrastructure (factories, film production), proprietary chemistry data accumulated over decades, regulatory-adjacent supply chain relationships, and strong distribution through every drugstore in America. All of those moats were genuine. They were disrupted not because a competitor replicated their film formula faster, but because digital photography made film *irrelevant*. The moat protected against commodity competition within the existing value chain. It provided zero protection against an architectural shift that moved the value chain elsewhere.

The lesson: **defensible** and **valuable** are two separate questions. The moat framework answers the first. You still have to answer the second independently. Ask not just "can this be replicated?" but "is this still in the value chain in five years?"

- **AI-era version of the Kodak problem:** A company that builds a strong workflow-embedding moat around legacy enterprise software (e.g., deep integration into a pre-AI ERP system) faces this risk. The moat is real; the asset may become structurally irrelevant as AI-native competitors replace the underlying system.

**OpenAI stress test.** Run the framework against OpenAI, since they're at the center of this conversation. Distribution moat: strong — ChatGPT has 300M+ weekly active users, the strongest consumer AI distribution on the planet. Compounding data: unclear — they don't publish details, and their RLHF data advantage may be less durable than it appears. Regulatory: early mover in government and enterprise relationships, but also regulatory target. Physical infrastructure: limited without Microsoft partnership. The stress test reveals that OpenAI's most durable moat is distribution, not model quality — which explains their strategic choices (consumer products, API ubiquity) better than their stated mission does.

**"Can't big capital just buy all of this?"** Yes — and that's the point. Acquiring time-locked assets requires capital *and* elapsed time, which is why they're moats at all. You can buy a factory; you can't buy the years of production experience embedded in the workers who run it. You can buy a dataset; you can't buy the flywheel that generates new signal daily. Capital is necessary but not sufficient.

**The open source accelerant.** Open source compresses software commodity faster than proprietary AI alone. LLaMA, Mistral, and Llama 3 have already commoditized model capabilities that cost millions to train in 2023. This *strengthens* the argument for time-locked moats: as software becomes cheaper to replicate, the non-software assets become relatively more valuable. The open source wave is an argument for the framework, not against it.

---

### Section 5: Trust as the Meta-Moat (200 words)

When software is a commodity, trust becomes the differentiator. This shows up in three forms:

- **Brand as signal.** In a market flooded with AI-generated content and AI-built products, provenance matters. Who built this? Who vouches for it? Who stands behind it when it's wrong? Brand isn't a feeling; it's a promise with accountability attached. The mechanism: brand reduces evaluation cost for buyers who can no longer assess quality directly (because everything looks polished now).
- **Audit trails and explainability.** Banks deploying AI credit scoring need explainable models and audit trails for regulators. That infrastructure is a moat — and it compounds: every audit cycle adds to the institutional record. Note that this is domain-specific; it matters enormously in financial services, healthcare, and defense, less so in consumer apps.
- **Human-in-the-loop as asset, not cost.** The systems that keep humans in the loop aren't slower; they're more trustworthy. In high-stakes domains, trustworthiness is the product. "AI-assisted human judgment" is a more defensible market position than "autonomous AI" when mistakes have professional or legal consequences.

**Note:** Trust is closer to a table stake in high-trust domains than a standalone moat. Call this out — don't oversell it. The post should be honest that trust amplifies other moats rather than standing on its own.

---

### Section 6: A Durability Framework (300 words)

Not all moats are equal. Rank by durability in an AI-accelerated world and explain the ordering:

**Durability ranking:**

1. **Regulatory permission** — hardest to compress; government timelines are fixed and expanding as AI stakes rise
2. **Physical infrastructure** — requires atoms and years; no software shortcut
3. **Capital at scale** — institutional trust takes decades; can't be faked or rushed
4. **Standards and protocols** — whoever defines the canonical object controls the ecosystem; durable until architectural shifts
5. **Compounding proprietary data** — gets stronger over time, but requires an operational flywheel; vulnerable if flywheel breaks
6. **Distribution / multi-sided network effects** — hard to bootstrap; once established, very sticky; cold-start problem worsens as AI lowers software barriers
7. **Workflow embedding** — strong, but vulnerable to "good enough" AI-native alternatives that bypass the embedded system entirely
8. **Social network effects** — real but historically vulnerable to identity/platform shifts
9. **Speed / execution velocity** — real but temporary; durable only if converted to learning

**The 2×2 decision tool** (this is the "choose accordingly" framework for builders):

|  | **Commodity threat** (AI replication) | **Architectural threat** (value chain shift) |
|---|---|---|
| **Time-locked moat** | Well-protected | *Exposed* — moat is real but asset may be irrelevant (Kodak problem) |
| **Compounding moat** | Well-protected and strengthening | *Exposed* — flywheel may point at a shrinking market |

The test every builder should apply to their moat claim:
1. Does this advantage deepen as AI gets cheaper? (commodity threat test)
2. Is the asset this moat protects still in the value chain in five years? (architectural threat test)

If both answers are yes, build hard. If only the first is yes, keep building but watch the horizon. If neither is yes, it's a feature, not a moat.

---

### Closing: Choose Accordingly (200 words)

The moats are shifting, not vanishing. Everything that can be replicated in a sprint will be. Everything that takes years of accumulated data, domain knowledge, regulatory permission, or physical presence to build won't be — *as long as the value chain holds*.

The builders who understand this distinction will make better bets. Build on data that compounds, not data that's static. Own the distribution channel, not just the product. Turn compliance from cost into barrier. Move fast, but convert speed into learning, not just shipping. And every six months, run the Kodak test: is the asset I'm building still going to be in the value chain, or am I defending a film factory in a digital world?

**The Purveyors closing example** (use this to make it concrete and personal):

The moat isn't the web app or the scraper code — both could be replicated in weeks with better AI than I used to build them. The moat is the normalized dataset across 41 suppliers, the listing schema that encodes how green coffee should be compared, and the daily operational flywheel that adds signal every time a scraper run corrects a new edge case. The software is the vehicle. The schema is the standard. The data is the asset. None of those compound if the AI-transformed specialty coffee market stops caring about supplier comparison — which is why the Kodak test matters more than the moat taxonomy.

---

## Source references

1. Michael Bloch (Quiet Capital), "Five Moats That Survive AI Compression," Mar 2026. Covered by Forbes (Josipa Majic Predin, Mar 31, 2026).
2. Euclid Ventures, "Dude, Where's My Moat?" Jul 2025. Speed-as-moat critique, workflow + data as immutable primitives.
3. Codurance, "Beyond Functionality: Building Durable Moats in the AI Era," Mar 2026. Compliance moats, niche specialization, regulatory barriers.
4. Edison Partners, "What Actually Creates Defensibility in Mission-Critical AI," Feb 2026. Workflow embedding, operational switching costs, edge-case learning.
5. Baytech Consulting, "Why Generic AI Startups Are Dead," Mar 2026. VC funding concentration, thin-wrapper death, distribution moats.
6. NFX, "Speed and AI," 2025. Execution velocity as competitive advantage.
7. Altimeter (Jamin Ball), "Clouded Judgment #53025: Moats in AI," 2025. Speed taxonomy.
8. Citrini Research, "2028 Global Intelligence Crisis," Feb 2026. (Context for the existing published post; this piece builds forward from it.)
9. Orchard Robotics case study — compounding data flywheel from physical operations.
10. Base Power case study — physical infrastructure moat in residential battery deployment.
11. Anduril — defense procurement / regulatory permission moat.

---

## Writing notes

- **Voice:** First-person, opinionated, no hedging. Challenge something the reader thinks they already know.
- **Opening hook options:**
  - "The AI moat conversation has a blind spot. It's obsessed with defensibility. It barely asks whether the asset being defended still matters."
  - "Michael Bloch's thesis went viral for the right reason: people are scared, and they want a list. But lists without a framework just generate checklist thinking."
  - "There are two kinds of moat claims. One passes the commodity threat test. The other passes the Kodak test. Most companies only ask the first question."
- **Avoid:** Naming every company in the taxonomy as a hero. One or two concrete examples per section max; don't let it become a listicle of logos.
- **The red-team section is unusual** — consider whether to make it an explicit section or weave the counterarguments inline. Inline feels more like the blog's voice; explicit section is more useful as a reference. Probably inline, with the Kodak test as the standalone moment.
- **Word count by section (approximate):**
  - Opening: 200
  - Section 1 (Erosion): 300
  - Section 2 (Time-locked): 600
  - Section 3 (Compounding): 600
  - Section 4 (Red team): inline, woven into Sections 2–3 + standalone Kodak moment ~400 total
  - Section 5 (Trust): 200
  - Section 6 (Framework): 300
  - Closing: 200
  - **Total: ~2,800 words**





