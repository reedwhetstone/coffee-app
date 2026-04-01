# Blog Source Map

Maps notes/brain files to extracted ideas and published posts. This is the traceability + coherence layer between what is written publicly and what exists in code.

_Last coherence audit: 2026-03-29_

## Source Files → Ideas Extracted

| Source File | Size | Ideas Extracted | Blog Posts |
|---|---|---|---|
| `notes/genui-platform-transition-plan.md` | 51KB | 10 ideas (GenUI pillar) | — |
| `notes/archive/MCP-FIRST-ARCHITECTURE.md` | 57KB | 1 idea (MCP→REST evolution) | — |
| `notes/archive/MCP-SERVER-PROPOSAL.md` | 23KB | 1 idea (MCP→REST evolution) | — |
| `notes/MARKET_ANALYSIS.md` | 15KB | 3 ideas (supply chain, positioning) | "What is Purveyors?" |
| `notes/API_notes/API-strategy.md` | 13KB | 2 ideas (API architecture) | — |
| `notes/API_notes/APITIER.md` | 4KB | 1 idea (pricing tiers) | — |
| `notes/API_notes/APITODOS.md` | 15KB | 1 idea (data model) | — |
| `notes/DEVLOG.md` | 19KB | feeds multiple posts (decisions, rationale) | — |
| `notes/artisan-upload/artisan-data-mapping-analysis.md` | 30KB | 1 idea (Artisan reference) | — |
| `notes/svelte5README.md` | 18KB | internal reference only | — |
| `notes/UI-FRAMEWORK.md` | 8KB | internal reference only | — |
| `notes/archive/Chart.md` | 7KB | internal reference only | — |
| `brain/references/b2cc-agents-as-customers.md` | 4KB | 3+ ideas (B2CC, docs-as-product, agent QA) | — |

## Published Posts

| Post | Slug | Date | Pillar | PR |
|---|---|---|---|---|
| What is Purveyors? | what-is-purveyors | 2026-02-20 | supply-chain | #13 |
| Building a Coffee Data Pipeline from Scratch | building-a-coffee-data-pipeline | 2026-02-20 | coffee-data-pipeline | #18 |
| What I Learned Running OpenClaw as a Solo Dev | two-weeks-with-ai-co-developer | 2026-02-22 | agentic-stack | #30 |
| The Real AI Moats Aren't Software | ai-moats-arent-software | 2026-02-27 | ai-first-product | #40/#41 |
| What the Fair Use Conversation Is Missing About LLM Data Extraction | llm-fair-use-data-extraction | 2026-03-01 | coffee-data-pipeline | #43/#45 |
| Benchmark Leaders, Agentic Laggards | benchmark-leaders-agentic-laggards | 2026-03-02 | agentic-stack | #47/#48 |
| Beyond the Coffee Belt | beyond-the-coffee-belt | 2026-03-04 | supply-chain | #63/#64 |
| Inference Is in the Name | inference-is-in-the-name | 2026-03-05 | agentic-stack | #66/#67 |
| Who Profits When Coffee Data Stays Scarce? | who-profits-when-coffee-data-stays-scarce | 2026-03-11 | market-intelligence | #87 |
| Why Does Enterprise AI Cost More and Deliver Less? | why-does-enterprise-ai-cost-more | 2026-03-12 | agentic-stack | — |
| Sycophancy Is the Last Hard Problem in AI-Assisted Software Development | sycophancy-is-the-last-hard-problem | 2026-03-26 | agentic-stack | #173 |

## Coherence Drift Flags (2026-03-12)

### Resolved (2026-03-16, PR #110)

- **building-a-coffee-data-pipeline** — updated to 48 suppliers (2 mentions), architecture mix (5 Playwright + 7 Shopify + rest HTTP), coffee count 1,876
- **what-is-purveyors** — updated to 48 suppliers (2 mentions)
- **ai-moats-arent-software** — updated to 48 suppliers (1 mention)
- **who-profits-when-coffee-data-stays-scarce** — updated to 48 suppliers (3 mentions incl. description)

### New Post — First Audit (2026-03-15)

- **why-does-enterprise-ai-cost-more** (Mar 12)
  - Inference cost table (GPT-5.4, GPT-5.2, GPT-5, Claude Sonnet 4.6, Claude Opus 4.6, etc.) is accurate at publish-time pricing (Mar 2026). Prices will drift.
  - Work Trend Index stat (78% bring own tools, 52% reluctant to admit) sourced from Microsoft public report — verified at publish time.
  - No internal codebase claims. No supplier counts. No architecture descriptions. Clean.

### Verified accurate (no immediate drift)

- **benchmark-leaders-agentic-laggards**
  - External benchmark references (Artificial Analysis, GDPval, FoodTruck Bench, SWE-bench) are public and version-independent
  - Gemini 3.1 Pro scoring (57 on AA Index) verified at publish time; may shift with new model releases
  - Outcome pricing references (Intercom $0.99/resolution, Sierra) are public

- **llm-fair-use-data-extraction**
  - Canonical schema-driven extraction prompt exists.
  - Fair-use 6-word consecutive quote cap is implemented in generation prompt.
  - Deterministic post-processors for country/MASL/date/continent are implemented.

- **two-weeks-with-ai-co-developer**
  - Architecture/process claims remain aligned with current workspace patterns (memory files, brain structure, channelized workflow, PR-based loop).

- **beyond-the-coffee-belt** (NEW — first audit)
  - Exotic origin claims (St Helena, Galapagos, Pitcairn, Okinawa, California, Coffea racemosa) are sourced from Sea Island Coffee catalog and public domain knowledge.
  - Monoculture risk analogy (bananas/TR4) is well-documented externally.
  - No specific supplier counts or codebase architecture claims to drift.

- **inference-is-in-the-name** (NEW — first audit)
  - Architecture principles (deterministic core / adaptive edge) align with actual scraper design: deterministic post-processors for country, continent, MASL, dates; LLM only for uncertain extraction.
  - No specific numeric claims about the codebase.
  - External references (Vince Buffalo tweet, Charity Majors DORA talk, Zach Vorhies Google memo) are public.
nistic core / adaptive edge) align with actual scraper design: deterministic post-processors for country, continent, MASL, dates; LLM only for uncertain extraction.
  - No specific numeric claims about the codebase.
  - External references (Vince Buffalo tweet, Charity Majors DORA talk, Zach Vorhies Google memo) are public.
