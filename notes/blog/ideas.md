# Blog Ideas

Atomic blog ideas extracted from purveyors notes, brain captures, and conversations. Each idea is a potential post or section of a post.

**Format:** `- [ ] Idea title | Source: file | Pillar: category | Status: raw/developing/outlined/drafted/published`

---

## AI-First Product (GenUI)

- [ ] Sycophancy, the final hurdle: alignment debt and why frictionless implementation makes software worse | Source: #blog discussion 2026-03-13 | Pillar: agentic-stack | Status: outlined | Outline: brain/blog/outlines/sycophancy-the-final-hurdle.md
- [ ] Building product philosophy into the codebase: agents as blank-slate coworkers and the onboarding problem at scale | Source: #blog discussion 2026-03-25 | Pillar: agentic-stack | Status: outlined | Outline: brain/blog/outlines/building-product-philosophy-into-codebase.md
- [ ] The Friction We Can't Afford to Lose | Source: #blog discussion + attached essay (2026-04-23) | Pillar: ai-first-product | Status: drafted (PR #287) | Outline: notes/blog/outlines/the-friction-we-cant-afford-to-lose.md | Draft: src/content/blog/the-friction-we-cant-afford-to-lose.svx | Note: AI is best when it removes incidental friction and risky when it removes load-bearing friction in learning. Grounded with the Nature spacing/retrieval review, MIT Media Lab's cognitive-debt preprint, Anthropic's education report, and Gerlich's correlational survey.

- [ ] The canvas is a whiteboard, not a sidebar. Why spatial persistence changes AI chat. | Source: notes/genui-platform-transition-plan.md | Pillar: ai-first-product | Status: raw
- [ ] Progressive disclosure through conversation: replacing menus with intelligence | Source: notes/genui-platform-transition-plan.md | Pillar: ai-first-product | Status: raw
- [ ] The propose/confirm pattern: teaching AI to never touch your data | Source: notes/genui-platform-transition-plan.md (Phase 3) | Pillar: ai-first-product | Status: outlined | Outline: brain/blog/outlines/why-should-an-ai-agent-stop-at-the-write-boundary.md | Note: Picked because ai-first-product is still underrepresented in published posts and this is the sharpest transferable idea in the GenUI work. Angle: the best agent is maximally helpful right up until the write boundary, then deliberately hands control back with an editable proposal instead of executing blindly.
- [ ] "Structured output should feel like expression, not insertion." Making AI-rendered UI feel natural. | Source: notes/genui-platform-transition-plan.md (Design Philosophy §3) | Pillar: ai-first-product | Status: raw
- [ ] The two-surface architecture: why chat + canvas is the right primitive | Source: notes/genui-platform-transition-plan.md | Pillar: ai-first-product | Status: raw
- [ ] Block reference tokens: teaching LLMs to author spatial interfaces | Source: notes/genui-platform-transition-plan.md (§0.6) | Pillar: ai-first-product | Status: raw
- [ ] Workspace memory as moat: why persistence across sessions changes everything | Source: notes/genui-platform-transition-plan.md (Phase 2) | Pillar: ai-first-product | Status: raw
- [ ] From LangChain to Vercel AI SDK: why we rewrote our entire AI stack | Source: notes/genui-platform-transition-plan.md (Phase 0) | Pillar: ai-first-product | Status: raw
- [ ] The death of page-based navigation in domain-specific tools | Source: notes/genui-platform-transition-plan.md (Phase 4) | Pillar: ai-first-product | Status: raw
- [ ] What "AI-first" actually means when you strip away the hype | Source: notes/genui-platform-transition-plan.md (Vision) | Pillar: ai-first-product | Status: outlined
- [ ] Embeddings are not search: enterprise RAG needs a ranking layer | Source: #blog discussion 2026-03-10 (embedding vs authority ranking) | Pillar: ai-first-product | Status: outlined (`brain/blog/outlines/embeddings-are-not-search.md`)
- [ ] Why we migrated roast + GenUI charts from D3 to LayerCake: shared components, less glue code, cleaner AI-era chart primitives | Source: coffee-app commits b51a399/ae20d8b/9dab806 | Pillar: ai-first-product | Status: raw

## Coffee Data Pipeline (Scraper)

- [x] Building a multi-supplier coffee data pipeline from scratch | Source: coffee-scraper ARCHITECTURE.md | Pillar: coffee-data-pipeline | Status: published (PR #18)
- [ ] The CI feedback loop: scrape, normalize, rank, surface, improve | Source: coffee-scraper workflow | Pillar: coffee-data-pipeline | Status: folded into pipeline post
- [ ] Generic vs custom scrapers: when to abstract and when to specialize | Source: coffee-scraper (Shopify generic vs Playwright custom) | Pillar: coffee-data-pipeline | Status: raw
- [x] Fair use and the LLM content pipeline: stripping marketing language from supplier data | Source: conversation 2026-02-19 | Pillar: coffee-data-pipeline | Status: published (PR #43/#45)
- [ ] Data normalization challenges: grading systems, origin naming, processing methods across 21 suppliers | Source: coffee-scraper SUPPLIERS.md | Pillar: coffee-data-pipeline | Status: raw
- [ ] Testing scrapers without a database: the test harness pattern | Source: coffee-scraper test-source.ts | Pillar: coffee-data-pipeline | Status: raw
- [ ] Scaling to 28 suppliers: what happens when your largest source has 623 products and no structured data | Source: happy-mug scraper (PR #70) | Pillar: coffee-data-pipeline | Status: raw
- [ ] From 12 to 21 suppliers: what actually made one-week onboarding velocity possible | Source: coffee-scraper commits (CopanTrade, Yellow Rooster, Coffee Project, Mill City, Java Bean Plus) | Pillar: coffee-data-pipeline | Status: raw
- [ ] Rapid supplier growth without quality collapse: audit-driven fixes, regex hardening, and backfill loops | Source: coffee-scraper fixes 6eeb9ec/a11d2ba/e8647bf/a0f33bd | Pillar: coffee-data-pipeline | Status: raw

## Market Intelligence

- [ ] Green coffee market pulse: what the data shows right now | Source: dev DB coffee_catalog analysis | Pillar: market-intelligence | Status: raw
- [ ] Origin deep dive template: pricing, availability, processing trends by country | Source: scraped data | Pillar: market-intelligence | Status: raw
- [ ] Which suppliers carry what: a data-driven comparison | Source: scraped data | Pillar: market-intelligence | Status: drafted (PR #87) | Outline: brain/blog/outlines/green-coffee-information-gap.md | Note: Reframed as "The 13x Information Gap" — the angle is that product metadata transparency, not price transparency, is coffee's real information asymmetry problem. Akerlof's lemons applied to seller-controlled disclosure. Data from scraping 30 suppliers shows decision-critical fields (cup scores, arrival dates, farm provenance) are disclosed by <33% of sellers while generic fields (country) are near-universal.
- [ ] Seasonal patterns in green coffee availability | Source: scraped data (stocked_date/unstocked_date) | Pillar: market-intelligence | Status: raw

## API Architecture (B2CC)

- [ ] Your API docs are your new landing page: building for agent customers | Source: [[b2cc-agents-as-customers]], notes/API_notes/API-strategy.md | Pillar: api-architecture | Status: outlined
- [ ] The dual-audience API: B2B walled gardens + hobbyist marketplace from one data layer | Source: notes/API_notes/API-strategy.md | Pillar: api-architecture | Status: raw
- [ ] "Test with agents first" as a real QA methodology | Source: [[b2cc-agents-as-customers]] | Pillar: api-architecture | Status: raw
- [ ] Usage-based pricing for data APIs: lessons from building purveyors tiers | Source: notes/API_notes/APITIER.md | Pillar: api-architecture | Status: raw
- [ ] Why normalized, proprietary data is the real moat when switching costs collapse | Source: [[b2cc-agents-as-customers]], API strategy | Pillar: api-architecture | Status: raw
- [ ] From MCP to REST: why we chose API-first over protocol-first | Source: notes/archive/MCP-FIRST-ARCHITECTURE.md, notes/archive/MCP-SERVER-PROPOSAL.md | Pillar: api-architecture | Status: outlined | Outline: brain/blog/outlines/protocol-first-is-the-new-microservices-first.md | Note: Reframed as "Protocol-First Is the New Microservices-First." The angle: MCP hype cycle is repeating the microservices mistake (choosing tools before understanding problems). Five concrete ways MCP-first broke a web product evaluation, with the one-question test that resolves the decision. GenUI as the exception that proves the rule.
- [ ] The B2CC blind spot: agents optimize integrations, but humans still control the allowlist | Source: brain/references/b2cc-agents-as-customers.md (tension section) | Pillar: api-architecture | Status: outlined | Outline: brain/blog/outlines/agents-dont-pick-their-own-tools.md | Note: Reframed as "Agents Don't Pick Their Own Tools." The angle: the B2CC narrative assumes agents autonomously choose the best API, but agents only operate within human-configured allowlists. Torii 2026 data shows governance is getting stricter (61% shadow IT, only 15.5% sanctioned), and Stocker & Lehr's principal-agent framework explains why human gatekeeping persists. The real competitive surface is a dual gate: human approval first, then agent execution. Picked because api-architecture has zero published posts.

## Agentic Stack

- [x] Why does enterprise AI cost more and deliver less? | Source: Reed's direct enterprise Copilot experience, inference cost math, RLHF alignment tax research | Pillar: agentic-stack | Status: published | Outline: `brain/blog/outlines/published/why-does-enterprise-ai-cost-more.md`
- [ ] Managing a production codebase with an AI agent: PRs, code review, testing | Source: daily workflow | Pillar: agentic-stack | Status: raw
- [x] Benchmark leaders, agentic laggards: why coding-in-the-loop performance matters more than leaderboard rank | Source: conversation 2026-03-01 (#blog) | Pillar: agentic-stack | Status: published (PR #47/#48)
- [ ] Agentic workflows follow power laws: a few tight feedback loops drive most output | Source: brain/ideas/power-laws-soc.md | Pillar: agentic-stack | Status: raw
- [x] Deterministic core, adaptive edge: use AI to improve systems, not impersonate them | Source: #blog discussion 2026-03-05 (LinkedIn blurb critique) | Pillar: agentic-stack | Status: published (PR #66/#67, slug: inference-is-in-the-name)
- [ ] Human-in-the-loop is not always safer: when human-out-of-the-loop becomes lower-risk | Source: #blog discussion 2026-03-05 (control frameworks) | Pillar: agentic-stack | Status: outlined (`brain/blog/outlines/human-in-vs-out-of-loop-safety.md`)
- [x] Two weeks with an AI co-developer: what works and what breaks | Source: memory/\*.md, reflections, system files, PR history | Pillar: agentic-stack | Status: published (PR #30)
- [ ] Second brain as operating system: zettelkasten meets agentic workflows | Source: brain/ structure, AGENTS.md | Pillar: agentic-stack | Status: raw
- [ ] The blog as recursive loop: how writing about work improves the work | Source: conversation 2026-02-19 | Pillar: agentic-stack | Status: raw
- [ ] Memory architecture for AI assistants: what works and what breaks down | Source: MEMORY.md patterns | Pillar: agentic-stack | Status: raw
- [ ] Cron jobs, heartbeats, and the operational loop of a 24/7 AI collaborator | Source: HEARTBEAT.md, cron config | Pillar: agentic-stack | Status: raw

## Supply Chain + Industry

- [x] Beyond the coffee belt: rare origins you've never heard of (St Helena, Galapagos, New Caledonia, Canary Islands) | Source: Sea Island Coffee supplier data (46 products, exotic origins) | Pillar: supply-chain | Status: published (PR #63/#64) | Note: Expanded with monoculture risk analogy (bananas/TR4), immediate vs tail risk map, and weekly coffee-intelligence product implications.
- [x] Who profits when coffee data stays scarce? (was: 13x information gap) | Source: scraper field coverage data, Geertz bazaar economy, Levitt & Syverson real estate study | Pillar: market-intelligence | Status: published (PR #87) | Note: Missing hero image, generate later when OpenAI credits restored.
- [ ] Co-fermentation in specialty coffee: fruit, hops, and experimental processing (Prime Green Coffee as case study) | Source: prime_green_coffee scraper data | Pillar: supply-chain | Status: drafted (PR #208) | Outline: brain/blog/outlines/co-fermentation-exposed-coffees-real-transparency-gap.md | Note: Reframed as "Is Co-Fermentation Cheating? Wrong Question." The angle: the co-ferment debate accidentally exposed that most suppliers don't provide structured processing data at all (~28% coverage). The industry is arguing about exotic 9-word process descriptions while most sellers can't tell you if a lot was washed or natural. Wine's natural movement parallel; the real legacy was disclosure pressure, not a new category.
- [ ] Box-priced microlots and hidden unit economics: why 22lb specialty lots force per-lb normalization for fair comparison | Source: royal_coffee Crown Jewels scraper integration (2026-03-05) | Pillar: supply-chain | Status: raw

- [x] What is purveyors? Origin story + vision. | Source: notes/MARKET_ANALYSIS.md | Pillar: supply-chain | Status: published (PR #13)
- [ ] The green coffee supply chain explained for non-specialists | Source: domain knowledge | Pillar: supply-chain | Status: raw
- [ ] Why the specialty coffee market needs better data infrastructure | Source: notes/MARKET_ANALYSIS.md | Pillar: supply-chain | Status: raw
- [ ] Bridging traditional industry and technology: lessons from manufacturing + startups | Source: Reed's background | Pillar: supply-chain | Status: raw

## Data Quality / Pipeline

- [ ] The "natural" problem: why keyword extraction on marketing prose produces false positives (and how to fix it) | Source: java_bean_plus processing regex fix (PR #39) | Pillar: coffee-data-pipeline | Status: raw | Note: Standalone word patterns like `\bnatural\b` match adjective uses ("natural sweetness") not processing labels. Broader lesson about context-aware extraction vs. naive keyword matching in scraping pipelines.
- [ ] Audit precision debt: separating scraper regressions from pipeline backlog signals | Source: coffee-scraper audit run 2026-03-03 | Pillar: coffee-data-pipeline | Status: raw | Note: Findings like missing embeddings can dominate alert volume while being backfill-state issues, not extraction breakages. A two-lane rubric (pipeline-state vs parser defects) improves triage quality.
- [ ] Process style vs origin name collision: when product titles include "Kenya/Burundi Process" but origin remains El Salvador | Source: Aida Batlle Selection supplier integration (aida_batlle) | Pillar: coffee-data-pipeline | Status: raw
- [ ] Backfill loops that only patch NULLs can trap invalid data forever | Source: coffee-scraper rescrape repair (2026-03-05), validation guard fix (2026-03-06 PR #60) | Pillar: coffee-data-pipeline | Status: outlined | Outline: brain/blog/outlines/null-means-two-things.md | Note: Reframed as "Null Means Two Things (and Your Pipeline Can't Tell Which)." The angle: defensive merge logic that "protects good data" is the exact mechanism that freezes bad data forever, because null carries two opposite semantic meanings (extraction failed vs value rejected). Anchored in Codd's 1990 A-Values/I-Values proposal, Kimball's Design Tip #43, and Chad Sanderson's data contracts. Fix pattern: post-merge validation guards that enforce format invariants regardless of provenance.

- [ ] Graceful degradation in multi-step pipelines: always run deterministic steps even when upstream fails | Source: coffee-scraper PR #66, unifiedCleaner post-processor fallback (2026-03-08) | Pillar: coffee-data-pipeline | Status: raw | Note: When an AI extraction step fails (API quota, network error), deterministic post-processing (country normalization, continent derivation, format validation) was silently skipped. The fix: treat deterministic steps as independent of upstream API success. General principle: if a pipeline step doesn't require the output of the failed step, it should still run. Related to the "unit confusion" class: feet-as-meters bugs happen when normalizers ignore unit indicators in input data. A defensive normalizer should detect and convert, not assume units.

## Velocity / Growth

- [ ] From 21 to 28 suppliers in one week: how infrastructure investment compounds onboarding velocity | Source: coffee-scraper PRs #40-#64 (Mar 2-8 sprint) | Pillar: coffee-data-pipeline | Status: raw | Note: 7 new suppliers in 7 days (Aida Batlle, BC Green Coffee, Royal Coffee Crown Jewels, Primos, Cafe Juan Ana, Home Roast Coffee, Coffee Crafters Green). Enabled by 6-phase refactor (shared utils, JSON parse guards, page limits, product filter, dead code, Vitest). The investment in infrastructure created the conditions for rapid onboarding. Pairs with the original pipeline post as a "6 weeks later" sequel.
- [ ] Six-phase refactor without breaking production: modernizing a live scraping codebase | Source: coffee-scraper PRs #41-#46 (refactor phases 1-6) | Pillar: agentic-stack | Status: raw | Note: Shared HTTP base, HTML utils, standardized JSON parsing, centralized page limits, product filter extraction, dead code removal, Vitest setup with 85 unit tests. All done while the scraper ran in production daily. The key: each phase was independently shippable with no behavior changes.
- [ ] Wholesale as a data classification problem: price tiers, volume thresholds, and the retail/wholesale spectrum | Source: coffee-scraper PRs #47-#50, coffee-app PRs #56-#60 | Pillar: market-intelligence | Status: drafted (PR #118) | Outline: brain/blog/outlines/why-same-coffee-costs-20-and-6.md | Note: Reframed as "Why Does the Same Coffee Cost $20/lb and $6.58/lb?" The angle: the wholesale/retail binary is an arbitrary threshold on a continuous nonlinear pricing curve, and it destroys useful information for buyers. Anchored in Wilson's nonlinear pricing framework and Pigou's second-degree discrimination. Real tier data from the scraper shows 34-50% price spreads within single products.

## Documentation / Reference

- [ ] Getting started with the Purveyors API | Source: notes/API_notes/ | Pillar: api-architecture | Status: raw
- [ ] Artisan .alog file format: a complete technical reference | Source: notes/artisan-upload/artisan-data-mapping-analysis.md | Pillar: coffee-data-pipeline | Status: raw
- [ ] Purveyors data model explained | Source: schema.sql, notes/API_notes/APITODOS.md | Pillar: api-architecture | Status: raw
- [x] The real AI moats aren't software: data, work-output pricing, and why enterprise SaaS is stickier than you think | Source: brain/ideas/ai-saas-disruption-thesis.md, Citrini "2028 GIC" report | Pillar: ai-first-product | Status: published (PR #40/#41)

- [ ] We Built a Real-Time Specialty Coffee Price Index | Source: PPI implementation plan | Pillar: market-intelligence | Status: raw | Notes: Launch post when PPI ships. Data journalism angle: 6-month origin price trends, volatility by process, correlation with harvest cycles. Hook: nobody else has daily-resolution specialty green pricing.

### What an AI Center of Excellence Actually Needs

- **Status:** outlined
- **Pillar:** agentic-stack
- **Tags:** enterprise-ai, governance, agentic-workflows
- **Source:** DaVita TPM AI rejection feedback (Mar 17). Winning candidates had AgentForce implementation or AI CoE process definition experience. The post argues that AI CoE success comes from enterprise adoption governance, not platform selection.
- **Thesis:** Most AI CoEs fail because they start with tool selection instead of workflow governance. Enterprise adoption PMs are better positioned to build AI CoEs than AI specialists, because the organizational scaffolding is the hard layer.
- **Outline:** `brain/blog/outlines/what-an-ai-center-of-excellence-actually-needs.md`
