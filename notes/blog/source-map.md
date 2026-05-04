# Blog Source Map

Maps strategy docs, code, and audit findings to extracted ideas and published posts. This is the traceability and coherence layer between what is written publicly and what exists in the repos.

_Last coherence audit: 2026-05-03_

## Core strategy sources

| Source File                                                                                 | Current role                                         | Blog links                                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `notes/PRODUCT_VISION.md`                                                                   | Canonical product direction                          | Grounds product, intelligence, API, public-surface, and marketplace-standard framing |
| `notes/BLOG_STRATEGY.md`                                                                    | Canonical blog positioning, cadence, and quality bar | Governs pillar balance, cadence, voice, and maintenance rules                        |
| `notes/genui-platform-transition-plan.md`                                                   | Primary ai-first-product source                      | Feeds GenUI, canvas, propose/confirm, memory, and AI-first product ideas             |
| `notes/API_notes/API-strategy.md`                                                           | Primary API / B2CC source                            | Feeds dual-audience API, agent-first QA, pricing, and docs-as-product ideas          |
| `notes/decisions/002-api-first-external-internal-split.md`                                  | API-first architecture decision                      | Supports public discovery, paid API, and endpoint governance posts                   |
| `notes/decisions/004-processing-transparency-schema-api.md`                                 | Structured process metadata decision                 | Supports processing transparency, schema-as-market, and disclosure-quality posts     |
| `notes/archive/legacy-product/MARKET_ANALYSIS.md`                                           | Historical source for early supply-chain posts       | Feeds `what-is-purveyors` and legacy supply-chain infrastructure framing             |
| `brain/references/b2cc-agents-as-customers.md`                                              | External theory / reference                          | Feeds agents-as-customers, docs-as-product, and allowlist-governance ideas           |
| `notes/big-ideas/2026-04-30-purveyors-proof-layer.md`                                       | Strategic proof-layer proposal                       | Feeds claim provenance, proof passport, and evidence-as-product ideas                |
| `notes/implementation-plans/2026-04-29-parchment-intelligence-api-cli-bridge.md`            | Price-index API and CLI bridge plan                  | Feeds Parchment Intelligence launch and machine-readable market-data posts           |
| `../coffee-scraper/notes/implementation-plans/2026-04-29-certifications-taxonomy-schema.md` | Certification taxonomy schema plan                   | Feeds certification schema and structured claim-data ideas                           |

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

## Recent source material checked in this audit (2026-04-27 to 2026-05-03)

| Source                                                        | Audit use                                             | Outcome                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| coffee-app PR #301                                            | Open publish-ready blog PR                            | Treat as the near-term queue item to resolve before opening another full draft                                |
| coffee-app PR #323                                            | Open outline-only GenUI PR                            | Confirms active ai-first-product backlog remains healthy; does not close the api-architecture publication gap |
| coffee-app PRs #302/#304/#319                                 | Process facets, access-tier positioning, docs updates | Reinforces that visibility versus search leverage is now a central public/product narrative                   |
| coffee-app PR #312                                            | `/v1/price-index` endpoint                            | Updated price-index idea: endpoint has shipped, but CLI/docs bridge should determine launch-post framing      |
| coffee-app PR #313 and proof-summary plans                    | Purveyors Proof Layer planning                        | Added new raw api-architecture idea for proof passports and claim provenance                                  |
| coffee-scraper PRs #225/#234 plus certification taxonomy plan | Producer evidence and certifications contract         | Added new raw coffee-data-pipeline idea: certification data needs a schema, not substring search              |
| coffee-scraper PRs #237/#239                                  | Runtime preflight and architecture docs refresh       | Useful product-quality evidence, but not strong enough for a standalone blog idea this week                   |
| purveyors-cli PR #103                                         | Structured process catalog filters                    | Confirms process transparency is now a cross-surface API/CLI/web story, not just a catalog UI detail          |
| open Coffee Intelligence draft PRs #228/#267/#285             | Active draft queue                                    | Flagged as stale snapshot risk; refresh, close, or rebase before promotion                                    |

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
    - Source: ADR-004, PR #289, PR #302, ADR-005, and the structured `/v1/catalog` process fields.
    - Why now: the co-fermentation post identified the transparency gap, then the app turned it into a cross-surface API, access-tier, and catalog contract.
  - `The listing schema is the market`
    - Source: PR #291 outline, PR #289 catalog contract work, PR #302 facets, and ADR-005.
    - Status: outlined in `ideas.md`.
  - `Proof passports for coffee claims: why the next marketplace unit is evidence, not listings`
    - Source: `notes/big-ideas/2026-04-30-purveyors-proof-layer.md` and `notes/implementation-plans/2026-05-01-catalog-proof-summary-seed.md`.
    - Why now: process transparency, producer evidence, access tiers, and proof-summary planning now point at claim provenance as a paid trust layer.
  - `We Built a Real-Time Specialty Coffee Price Index`
    - Source: PR #312 and the Parchment Intelligence API/CLI bridge plan.
    - Why now: `/v1/price-index` has shipped. Draft after CLI/docs bridge if the post should claim cross-surface completeness.

- **coffee-scraper**
  - `Producer identity is market infrastructure, not listing copy`
    - Source: producer column pipeline support and composite producer residue fixes in PRs #209/#215/#225.
  - `Certification data needs a schema, not a substring search`
    - Source: certification taxonomy plan and PR #234.
    - Why now: audit evidence found certification claims broadly trapped in overloaded fields; a first-class schema turns them into buyer and agent leverage.
  - Runtime preflight and Coffee Shrub fixes are operationally useful but did not produce a stronger blog idea than proof, certifications, or price-index work.

## Pillar balance snapshot

- Published posts on `origin/main`: agentic-stack 7, supply-chain 3, coffee-data-pipeline 2, ai-first-product 1, market-intelligence 1, api-architecture 0.
- Priority gap: **api-architecture** remains the clearest underrepresented published pillar.
- Backlog condition: idea volume is healthy; the active risk is queue management, not idea scarcity. Several complete draft PRs are open, while recent product work is generating stronger API/data ideas than the older generic backlog.
- Cadence condition: the visible blog frontmatter still looks stale after 2026-04-07, but PR #301 is a complete near-term publish candidate with a hero and source links.

## Next priority

1. **Resolve PR #301, `Which Moats Survive When AI Makes Software Cheap?`.** It is already drafted with hero and source links. Ship, revise, or close it before opening more full draft PRs.
2. **Draft `What If the Real Marketplace Is the Listing Schema?` next.** It is already outlined, fills the zero-post api-architecture pillar gap, and now has fresh evidence from `/v1/catalog`, ADR-004, ADR-005, structured process fields, and the public/API/CLI access split. The strongest angle is that the durable marketplace control point is the listing contract the market learns to publish through.
3. **Queue `We Built a Real-Time Specialty Coffee Price Index` after the API/CLI bridge story is coherent.** PR #312 shipped `/v1/price-index`, but the better post is a cross-surface market-data launch once CLI/docs work catches up, unless Reed wants a narrower API-contract launch post sooner.
