# Blog Source Map

Maps strategy docs, code, and audit findings to extracted ideas and published posts. This is the traceability and coherence layer between what is written publicly and what exists in the repos.

_Last coherence audit: 2026-04-26_

## Core strategy sources

| Source File                                                 | Current role                                         | Blog links                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `notes/PRODUCT_VISION.md`                                   | Canonical product direction                          | Grounds product, intelligence, API, public-surface, and marketplace-standard framing |
| `notes/BLOG_STRATEGY.md`                                    | Canonical blog positioning, cadence, and quality bar | Governs pillar balance, cadence, voice, and maintenance rules                        |
| `notes/genui-platform-transition-plan.md`                   | Primary ai-first-product source                      | Feeds GenUI, canvas, propose/confirm, memory, and AI-first product ideas             |
| `notes/API_notes/API-strategy.md`                           | Primary API / B2CC source                            | Feeds dual-audience API, agent-first QA, pricing, and docs-as-product ideas          |
| `notes/decisions/002-api-first-external-internal-split.md`  | API-first architecture decision                      | Supports public discovery, paid API, and endpoint governance posts                   |
| `notes/decisions/004-processing-transparency-schema-api.md` | Structured process metadata decision                 | Supports processing transparency, schema-as-market, and disclosure-quality posts     |
| `notes/archive/legacy-product/MARKET_ANALYSIS.md`           | Historical source for early supply-chain posts       | Feeds `what-is-purveyors` and legacy supply-chain infrastructure framing             |
| `brain/references/b2cc-agents-as-customers.md`              | External theory / reference                          | Feeds agents-as-customers, docs-as-product, and allowlist-governance ideas           |

## Recent source material checked in this audit (2026-04-19 to 2026-04-26)

| Source                                                                          | Audit use                                                                        | Outcome                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/content/blog/*.svx`                                                        | Full published-post inventory and drift scan                                     | 14 published posts found; `co-fermentation-wrong-question` was missing from the ledger and is now listed                  |
| `src/content/blog/co-fermentation-wrong-question.svx`                           | Post-publish drift check                                                         | Added as a new drift flag because it still frames processing as one text field after structured processing fields shipped |
| `notes/decisions/004-processing-transparency-schema-api.md`                     | App-side schema/API evidence                                                     | Added new raw idea: `Processing transparency is a schema problem, not a vocabulary problem`                               |
| coffee-app PRs #289/#291/#293                                                   | Structured catalog process filters, listing-schema outline, schema-lag hardening | Refreshed priority around `What If the Real Marketplace Is the Listing Schema?`                                           |
| coffee-scraper PRs #208/#216                                                    | Processing breakdown extraction and persistence                                  | Confirms the co-fermentation post now trails the implementation and supplies evidence for a schema-focused follow-up      |
| coffee-scraper PRs #209/#215                                                    | Producer column extraction and residue filtering                                 | Added new raw idea: `Producer identity is market infrastructure, not listing copy`                                        |
| coffee-scraper PRs #204/#206                                                    | Conditional source-field contracts and audit compatibility                       | Refreshed the existing `Null Means Two Things` / field-contract backlog theme; no duplicate idea added                    |
| `repos/coffee-scraper/README.md` and `scrape/sources/index.ts` at `origin/main` | Current supplier/source count check                                              | Current public scraper docs say 41 live sources; older posts still cite 30, 31, or 35 supplier snapshots                  |

## Published Posts

| Post                                                                    | Slug                                               | Date       | Pillar               | PR          | Drift Status |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ---------- | -------------------- | ----------- | ------------ |
| What is Purveyors?                                                      | `what-is-purveyors`                                | 2026-02-20 | supply-chain         | #13         | Needs update |
| Building a Coffee Data Pipeline from Scratch                            | `building-a-coffee-data-pipeline`                  | 2026-02-20 | coffee-data-pipeline | #18         | Needs update |
| What I Learned Running OpenClaw as a Solo Dev for Two Weeks             | `two-weeks-with-ai-co-developer`                   | 2026-02-22 | agentic-stack        | #30         | Clean        |
| The Real AI Moats Aren't Software                                       | `ai-moats-arent-software`                          | 2026-02-27 | ai-first-product     | #40/#41     | Needs update |
| What the Fair Use Conversation Is Missing About LLM Data Extraction     | `llm-fair-use-data-extraction`                     | 2026-03-01 | coffee-data-pipeline | #43/#45     | Clean        |
| Benchmark Leaders, Agentic Laggards                                     | `benchmark-leaders-agentic-laggards`               | 2026-03-02 | agentic-stack        | #47/#48     | Clean        |
| Beyond the Coffee Belt                                                  | `beyond-the-coffee-belt`                           | 2026-03-04 | supply-chain         | #63/#64     | Clean        |
| Inference Is in the Name                                                | `inference-is-in-the-name`                         | 2026-03-05 | agentic-stack        | #66/#67     | Clean        |
| Who Profits When Coffee Data Stays Scarce?                              | `who-profits-when-coffee-data-stays-scarce`        | 2026-03-11 | market-intelligence  | #87         | Needs update |
| Why Does Enterprise AI Cost More and Deliver Less?                      | `why-does-enterprise-ai-cost-more`                 | 2026-03-12 | agentic-stack        | not tracked | Watch        |
| The Codebase Is the Onboarding Manual                                   | `building-product-philosophy-into-codebase`        | 2026-03-26 | agentic-stack        | #174        | Needs update |
| Sycophancy Is the Last Hard Problem in AI-Assisted Software Development | `sycophancy-is-the-last-hard-problem`              | 2026-03-26 | agentic-stack        | #173        | Clean        |
| Is Co-Fermentation Cheating? Wrong Question.                            | `co-fermentation-wrong-question`                   | 2026-04-02 | supply-chain         | #208        | Needs update |
| What a New Hire Learns That Enterprise AI Still Misses                  | `enterprise-second-brains-are-not-knowledge-bases` | 2026-04-07 | agentic-stack        | #226/#227   | Clean        |

## Drift Flags (2026-04-26)

### Posts needing updates

- **`building-a-coffee-data-pipeline`**

  - Still claims 31 suppliers, 12 live suppliers, and 1,876 coffees across 35 suppliers.
  - Current scraper docs state 41 live sources.
  - Architecture mix has shifted from the post's 5 Playwright / 7 generic Shopify split to 6 Playwright, 28 custom HTTP, and 7 generic Shopify sources in current docs.
  - Fix path: refresh counts throughout, or explicitly label the post as a February 2026 snapshot.

- **`what-is-purveyors`**

  - Uses `35 suppliers` twice in present-tense product copy.
  - Current public product and scraper docs have moved to a 41-source narrative.
  - Fix path: update to `40+` / `41` live sources, or time-scope the count.

- **`ai-moats-arent-software`**

  - Moat example still cites a normalized dataset across 35 suppliers.
  - Fix path: update to current supplier/source language or generalize to `40+` to reduce future drift.

- **`who-profits-when-coffee-data-stays-scarce`**

  - Description and intro use 35 suppliers, while the body uses a 30-supplier dataset snapshot.
  - The thesis still holds, but the current copy mixes live-product language with a historical dataset.
  - Fix path: rerun the disclosure analysis for the current supplier surface, or explicitly label the article as a March 2026 snapshot.

- **`building-product-philosophy-into-codebase`**

  - GitHub link to `notes/MARKET_ANALYSIS.md` broke after the 2026-04-13 archive move.
  - Fix path: replace with `notes/PRODUCT_VISION.md` or `notes/archive/legacy-product/MARKET_ANALYSIS.md`, depending on the intended reference.

- **`co-fermentation-wrong-question`**
  - Uses a 35-supplier processing coverage snapshot while current scraper docs say 41 live sources.
  - Says the current pipeline captures `processing` as a single text field, but ADR-004 and the recent scraper/app work now add structured process fields for base method, fermentation type, additives, duration, disclosure level, confidence, and evidence.
  - Frontmatter date is 2026-04-02, while the post appears to have shipped via PR #208 on 2026-04-23. This makes cadence reporting ambiguous.
  - Fix path: either label the post as the pre-schema snapshot that motivated ADR-004, or update it with a short postscript explaining that the schema work shipped after the draft.

### Watchlist

- **`why-does-enterprise-ai-cost-more`**
  - Pricing table is publish-time market data, not code drift.
  - No repo contradiction this week, but model pricing references will keep aging.

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

  - `Processing transparency is a schema problem, not a vocabulary problem`
    - Source: ADR-004, PR #289, and the structured `/v1/catalog` process fields.
    - Why now: the co-fermentation post identified the transparency gap, then the app turned it into an API contract.
  - `The listing schema is the market`
    - Source: PR #291 outline plus PR #289 catalog contract work.
    - Status fix: moved from raw to outlined in `ideas.md`.

- **coffee-scraper**
  - `Producer identity is market infrastructure, not listing copy`
    - Source: producer column pipeline support and composite producer residue fixes in PRs #209/#215.
  - `Processing breakdown extraction` now provides concrete implementation evidence for a follow-up to the co-fermentation post.
  - Conditional source-field contracts reinforced the existing `Null Means Two Things` backlog theme; no duplicate idea added.

## Pillar balance snapshot

- Published posts: agentic-stack 7, supply-chain 3, coffee-data-pipeline 2, ai-first-product 1, market-intelligence 1, api-architecture 0.
- Priority gap: **api-architecture** remains the clearest underrepresented published pillar.
- Backlog condition: idea volume is healthy; the main problems are stale published counts, one newly published post with post-publish schema drift, and several outlined API posts competing for the next slot.

## Next priority

**Draft `What If the Real Marketplace Is the Listing Schema?` next.** It is already outlined, fills the zero-post api-architecture pillar gap, and now has fresh evidence from the 41-source scraper footprint, ADR-004, `/v1/catalog`, and the listing-schema outline work. The strongest angle is not generic API docs. It is the sharper claim that the durable marketplace control point is the listing contract the market learns to publish through.
