# Outline: Building a Coffee Data Pipeline from Scratch

**Pillar:** coffee-data-pipeline
**Target:** 2,500-3,000 words
**Status:** outlined
**Source material:** coffee-scraper/ARCHITECTURE.md, coffee-scraper/SUPPLIERS.md, notes/DEVLOG.md

## Thesis

The most interesting thing about the purveyors data pipeline isn't the scraping. It's the recursive feedback loop: scrape, audit, fix, scrape again. An AI agent runs the full cycle, collecting clear pass/fail signals from the data itself, and a human directs strategy while the agent executes. This is a concrete example of a broader shift: the economy of directors, where people who can organize and envision work, then hand it off to agents, are finding massive leverage. Data pipelines with deterministic quality signals are the perfect proving ground.

## Verification Checklist

- [ ] Architecture description matches actual code flow
- [ ] Supplier count and types match reality (12 live: 8 custom, 4 Shopify config)
- [ ] LLM usage description matches cleaning/unifiedCleaner.ts
- [ ] Audit system description matches audit/auditAgent.ts
- [ ] CI/feedback loop description matches actual daily cron behavior
- [ ] External citations are accurate and link correctly

## External References

1. **TIME**: "AI Changed Work Forever in 2025" (Jan 2, 2026) - "When anyone with a creative spark can orchestrate a cloud of AI agents to build prototypes, analyze markets, and test hypotheses, the cost of trying something new plummets." https://time.com/7342494/ai-changed-work-forever/
2. **Analytics Vidhya**: "15 AI Agents Trends to Watch in 2026" (Jan 3, 2026) - "Employees are no longer valued for completing tasks end to end, but for directing, supervising, and even refining the work done by agents. The core human skill becomes intent-setting." https://www.analyticsvidhya.com/blog/2026/01/ai-agents-trends/

## Structure

### Opening: The Loop, Not the Scraper (350 words)

Don't open with the technical scraping problem. Open with the feedback loop in action.

A day in the life: the scraper runs overnight. By morning, an audit report lands with data quality findings. My AI agent reviews the findings, identifies the root cause, writes a fix, tests it, opens a PR. I review the PR over coffee (literally), merge it, and by the next morning the data is cleaner. Repeat.

This is the real product. Not the scraper itself, but the recursive improvement cycle. Scrape → feedback → update → scrape → feedback. Each cycle makes the data better. And the cycle runs fast because an AI agent handles the full execution while I focus on direction.

The scraper has gone from messy prototype to 12 live suppliers producing clean, normalized data. Not because I sat down and perfected it. Because the feedback loop compounds. Every day it gets a little better, automatically.

### Why Data Pipelines Are Perfect for Agents (400 words)

Not all work suits autonomous agents equally. The sweet spot is where you have **clear pass/fail criteria**. Data is either clean or dirty. A field is either extracted correctly or it isn't. An altitude value is either valid MASL or garbage.

This is fundamentally different from creative work, strategy, or anything with subjective quality. When the agent can see whether it succeeded or failed, it can close its own loop. It doesn't need a human to judge every output. It needs a human to set the goal and review the edge cases.

This connects to a broader pattern playing out across the economy right now. TIME called 2025 the year [AI changed work forever](https://time.com/7342494/ai-changed-work-forever/), noting that "when anyone with a creative spark can orchestrate a cloud of AI agents to build prototypes, analyze markets, and test hypotheses, the cost of trying something new plummets." The enabling insight isn't that agents can do everything. It's that agents can do everything with deterministic quality signals autonomously, while humans focus on vision, strategy, and the judgment calls that don't have clear pass/fail criteria.

Analytics Vidhya's [2026 agent trends analysis](https://www.analyticsvidhya.com/blog/2026/01/ai-agents-trends/) puts it more directly: "Employees are no longer valued for completing tasks end to end, but for directing, supervising, and even refining the work done by agents. The core human skill becomes intent-setting."

I call this the economy of directors. The alpha right now isn't in doing the work. It's in directing it. People who can clearly articulate what needs to happen, set up the feedback loops that let agents self-correct, and focus their own time on the decisions agents can't make. That's the leverage. And a data pipeline is one of the cleanest demonstrations of this pattern.

### Architecture Overview (500 words)

Now get technical. Walk through the pipeline:

1. **Source adapters:** Each supplier gets a Source class. Three patterns: custom Playwright scrapers for complex sites, generic Shopify adapter (hits /products.json, no browser needed), generic WooCommerce adapter.
2. **URL collection:** Each source implements `collectInitUrlsData()`. Returns product URLs + prices + basic metadata.
3. **Stock sync:** Compare collected URLs against the database. Mark missing products as unstocked. Update prices. Queue new products.
4. **Product scraping:** Visit each new product page, extract raw HTML/text.
5. **LLM cleaning:** Raw data through `unifiedCleaner.ts`. Max 3 API calls per product: extraction, validation, retry if needed. The prompt is auto-generated from the canonical column schema.
6. **Post-processing:** Deterministic cleanup: continent lookup, MASL validation, date normalization, country standardization.
7. **Storage:** Upsert to Supabase.
8. **Enrichment:** AI descriptions, tasting notes, vector embeddings.
9. **Audit:** Post-scrape audit agent runs data quality checks.

Key design decision: the LLM prompt auto-generates from the schema. Add a column, the extraction prompt updates. This means the agent can add fields to the schema and the pipeline adapts without manual prompt engineering.

### The Recursive Feedback Loop in Detail (500 words)

This is the core section. Walk through real examples of the loop in action:

**Example 1: A supplier redesigns their site.** The scraper runs, extraction rates drop. The audit catches it: "Sweet Maria's completeness dropped from 94% to 61%." The agent investigates, identifies changed selectors, writes an updated adapter, tests it against live pages, opens a PR with before/after extraction rates. I merge. Next run is back to 95%+.

**Example 2: A new supplier onboarding.** I say "add Cafe Kreyol." The agent researches the site, identifies it as WooCommerce, writes a config, runs the test harness, validates output against the schema, opens a PR with sample data. Total hands-on time for me: reviewing the PR.

**Example 3: Data quality drift.** The audit notices that altitude data for a supplier is coming through as "1400-1800" instead of "1400-1800 MASL". The post-processor catches some but not all variations. The agent adds a new normalization rule, tests it against historical data, opens a PR. The next scrape cleans up retroactively.

Each of these follows the same pattern: automated detection → agent investigation → agent fix → human review → merge → improvement compounds. The human role is director: set the quality bar, review the work, decide priorities. The agent handles everything else.

### The Onboarding Velocity (300 words)

Emphasize how fast this moves with an agent in the loop. Adding a new Shopify supplier used to take a day of research, configuration, testing. Now it takes minutes of agent time and a quick PR review.

The OpenClaw instance (the AI agent running this) maintains context about the entire scraper codebase, the supplier rubric, the testing requirements, the PR conventions. It doesn't start from scratch each time. It has institutional memory of how the pipeline works and applies it to new work.

This is the "economy of directors" in practice. I'm not writing scraper code. I'm saying "this supplier looks interesting" and reviewing the output. The velocity difference is 10x, conservatively.

### What the Data Shows (250 words)

Brief teaser of the market intelligence potential. 1,258 coffees across 12 suppliers. Pricing data, availability patterns, origin distribution. The pipeline doesn't just serve the app; it generates market intelligence nobody else has.

This data tells a story, and we're going to start publishing it. (Tease the market intelligence pillar.)

### Closing: The Trend and Where It's Going (200 words)

This pattern won't stay niche. As LLMs get better, the range of tasks with clear pass/fail criteria expands. Today it's data pipelines. Tomorrow it's test suites, compliance audits, financial reconciliation. Anywhere the output is verifiably correct or incorrect, agents can close their own loops.

The interesting question is whether "economy of directors" is a stable equilibrium or a transitional phase. Maybe LLMs get good enough that they don't need human directors at all for these tasks. But right now, the alpha is clearly in leveraging agents for the full execution cycle and focusing human attention on direction, strategy, and the judgment calls that don't have clean pass/fail signals.

That's what we're doing with purveyors. And the blog will keep tracking how it evolves.
