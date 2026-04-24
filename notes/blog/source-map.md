# Blog Source Map

Maps strategy docs, code, and audit findings to extracted ideas and published posts. This is the traceability + coherence layer between what is written publicly and what exists in the repos.

_Last coherence audit: 2026-04-19_

## Core strategy sources

| Source File                                       | Current role                                         | Blog links                                                                      |
| ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `notes/PRODUCT_VISION.md`                         | Canonical product direction                          | Grounds product, intelligence, API, and public-surface framing for future posts |
| `notes/BLOG_STRATEGY.md`                          | Canonical blog positioning, cadence, and quality bar | Governs pillar balance, cadence, and maintenance rules                          |
| `notes/genui-platform-transition-plan.md`         | Primary ai-first-product source                      | Feeds GenUI, canvas, propose/confirm, and memory ideas                          |
| `notes/API_notes/API-strategy.md`                 | Primary API / B2CC source                            | Feeds dual-audience API, agent-first QA, pricing, and docs-as-product ideas     |
| `notes/archive/legacy-product/MARKET_ANALYSIS.md` | Historical source for early supply-chain posts       | Feeds `what-is-purveyors` and legacy supply-chain infrastructure framing        |
| `brain/references/b2cc-agents-as-customers.md`    | External theory / reference                          | Feeds agents-as-customers, docs-as-product, and allowlist-governance ideas      |

## Recent source material checked in this audit (2026-04-12 → 2026-04-19)

| Source File                                                                                | Audit use                                           | Outcome                                                                                           |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `notes/big-ideas/2026-04-09-open-coffee-listing-standard.md`                               | New strategic source from coffee-app work           | Added new raw idea: `The listing schema is the market`                                            |
| `notes/implementation-plans/2026-04-13-public-surface-crawlability-llm-discoverability.md` | Public discoverability + agent legibility           | Refreshed `Test with agents first`; strengthened api-architecture priority                        |
| `src/lib/server/catalogResource.ts` + `src/lib/docs/content.ts`                            | Anonymous catalog hardening + docs canonicalization | No post covers this shipped work directly yet; use as evidence for the next api-architecture post |
| `repos/coffee-scraper/scrape/llmClient.ts`                                                 | Retry hardening across 429 / 5xx / network failures | Added new raw idea: `Retry budgets are data quality policy`                                       |
| `repos/coffee-scraper/SUPPLIERS.md` + `repos/coffee-scraper/scrape/sources/index.ts`       | Current supplier/source count check                 | Refreshed drift flags on posts still citing 30 / 35-supplier snapshots                            |
| `src/content/blog/*.svx`                                                                   | Full published-post drift scan                      | 5 posts flagged for updates, 7 clean, 1 watch                                                     |

## Published Posts

| Post                                                                    | Slug                                               | Date       | Pillar               | PR        | Drift Status |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ---------- | -------------------- | --------- | ------------ |
| What is Purveyors?                                                      | `what-is-purveyors`                                | 2026-02-20 | supply-chain         | #13       | Needs update |
| Building a Coffee Data Pipeline from Scratch                            | `building-a-coffee-data-pipeline`                  | 2026-02-20 | coffee-data-pipeline | #18       | Needs update |
| What I Learned Running OpenClaw as a Solo Dev for Two Weeks             | `two-weeks-with-ai-co-developer`                   | 2026-02-22 | agentic-stack        | #30       | Clean        |
| The Real AI Moats Aren't Software                                       | `ai-moats-arent-software`                          | 2026-02-27 | ai-first-product     | #40/#41   | Needs update |
| What the Fair Use Conversation Is Missing About LLM Data Extraction     | `llm-fair-use-data-extraction`                     | 2026-03-01 | coffee-data-pipeline | #43/#45   | Clean        |
| Benchmark Leaders, Agentic Laggards                                     | `benchmark-leaders-agentic-laggards`               | 2026-03-02 | agentic-stack        | #47/#48   | Clean        |
| Beyond the Coffee Belt                                                  | `beyond-the-coffee-belt`                           | 2026-03-04 | supply-chain         | #63/#64   | Clean        |
| Inference Is in the Name                                                | `inference-is-in-the-name`                         | 2026-03-05 | agentic-stack        | #66/#67   | Clean        |
| Who Profits When Coffee Data Stays Scarce?                              | `who-profits-when-coffee-data-stays-scarce`        | 2026-03-11 | market-intelligence  | #87       | Needs update |
| Why Does Enterprise AI Cost More and Deliver Less?                      | `why-does-enterprise-ai-cost-more`                 | 2026-03-12 | agentic-stack        | —         | Watch        |
| The Codebase Is the Onboarding Manual                                   | `building-product-philosophy-into-codebase`        | 2026-03-26 | agentic-stack        | #174      | Needs update |
| Sycophancy Is the Last Hard Problem in AI-Assisted Software Development | `sycophancy-is-the-last-hard-problem`              | 2026-03-26 | agentic-stack        | #173      | Clean        |
| What a New Hire Learns That Enterprise AI Still Misses                  | `enterprise-second-brains-are-not-knowledge-bases` | 2026-04-07 | agentic-stack        | #226/#227 | Clean        |

## Drift Flags (2026-04-19)

### Posts needing updates

- **`building-a-coffee-data-pipeline`**

  - Still claims 31 suppliers, 12 live suppliers, and 1,876 coffees across 35 suppliers.
  - Current source registry is at 41 live sources, while current public marketing copy has moved to a 41+ supplier narrative.
  - Architecture mix has also shifted from the post's 5 Playwright / 7 generic Shopify split to roughly 6 Playwright / 7 generic Shopify / rest HTTP.
  - Fix path: refresh counts throughout, or explicitly label the post as a February 2026 snapshot.

- **`what-is-purveyors`**

  - Uses `35 suppliers` twice in present-tense product copy.
  - Current public product surfaces have moved beyond that count.
  - Fix path: update to a `40+` / `41+` supplier narrative, or time-scope the count.

- **`ai-moats-arent-software`**

  - Moat example still cites a normalized dataset across 35 suppliers.
  - Fix path: update to the current supplier narrative or generalize to `40+ suppliers` to reduce future drift.

- **`who-profits-when-coffee-data-stays-scarce`**

  - Description and intro use 35 suppliers, while the body uses a 30-supplier dataset snapshot.
  - The thesis still holds, but the current copy mixes live-product language with a historical dataset.
  - Fix path: rerun the disclosure analysis for the current supplier surface, or explicitly label the article as a March 2026 snapshot.

- **`building-product-philosophy-into-codebase`**
  - GitHub link to `notes/MARKET_ANALYSIS.md` broke after the 2026-04-13 archive move.
  - Fix path: replace with `notes/PRODUCT_VISION.md` or `notes/archive/legacy-product/MARKET_ANALYSIS.md`, depending on the intended reference.

### Watchlist

- **`why-does-enterprise-ai-cost-more`**
  - Pricing table is clearly publish-time market data, not code-drift.
  - No repo contradiction this week, but the external pricing references will keep aging.

### Verified accurate in this audit

- `two-weeks-with-ai-co-developer`
- `llm-fair-use-data-extraction`
- `benchmark-leaders-agentic-laggards`
- `beyond-the-coffee-belt`
- `inference-is-in-the-name`
- `sycophancy-is-the-last-hard-problem`
- `enterprise-second-brains-are-not-knowledge-bases`

## New idea capture from last 7 days of repo changes

- **coffee-app**

  - `The listing schema is the market: why a scraped catalog should become a publishing standard`
    - Source: `notes/big-ideas/2026-04-09-open-coffee-listing-standard.md`
  - `Test with agents first` moved up in priority after anonymous catalog hardening, teaser pagination, `llms.txt`, and public docs canonicalization made the pre-auth surface much more concrete.

- **coffee-scraper**
  - `Retry budgets are data quality policy: rate limits, network flaps, and upstream failures should not share the same counter`
    - Source: `repos/coffee-scraper/scrape/llmClient.ts` and the 2026-04-17 retry-hardening commits

## Pillar balance snapshot

- Published posts: agentic-stack 7, supply-chain 2, coffee-data-pipeline 2, ai-first-product 1, market-intelligence 1, api-architecture 0
- Priority gap: **api-architecture** remains the clearest underrepresented published pillar
