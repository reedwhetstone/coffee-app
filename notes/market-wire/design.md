# Purveyors Market Wire — End-to-End Design

_Created: 2026-07-19_
_Status: Concept design (pre-build); canonical strategic proposal at `brain/moonshots/2026-07-19-purveyors-market-wire.md`_
_Related: `repos/coffee-app/notes/implementation-plans/market-index-decision-surface-plan.md` (signal backbone), ADR-005/007/008_

## Product definition

A free weekly green-coffee market brief, published as a blog-like web area plus email edition. Each edition blends:

1. **Proprietary market view** — arrivals, delistings, price moves, below-market lots, index moves with significance framing, metadata/origin trends. All from existing scraper observations and Parchment market signals.
2. **Full-market context** — ICE Arabica C (KC) and Robusta futures levels, ICO composite indicator, differentials commentary, FX (USD/BRL, USD/COP), harvest/weather items, and major industry news stories.
3. **Editorial layer** — a few short LLM-written stories and "hot coverage" items synthesized from the structured data, with citations back to evidence.

Positioning: the wire is the recurring habit and distribution engine; Market Index is the interactive proof surface; Intelligence ($12/mo) is the personalized, immediate, historical upgrade.

## Freemium line

- **Anonymous web:** latest edition fully readable and indexable (SEO/citation surface). Archive list visible, older editions gated.
- **Free email subscriber:** weekly edition in inbox + full archive access on site while logged in. Email capture is the conversion asset.
- **Intelligence ($12/mo):** immediate (not weekly-delayed) alerts, personalized wire filtered to their origins/suppliers/price ceilings, full history + comparisons + exports, evidence deep-links into gated Market Index views, Ask Parchment analysis on any wire item.
- Principle from the moonshot: free is *general and delayed*, paid is *personal, immediate, historical, actionable*. Proof is never hidden; leverage is.

## Pipeline architecture (5 layers)

### L0 — Ingestion
- Existing: coffee-scraper daily supplier observations (arrivals, prices, availability, provenance).
- New, small: external market ingesters — futures settlement levels, ICO daily composite indicator, curated RSS/news feeds (Daily Coffee News, GCR, Reuters softs, STiR, etc.). Weekly granularity, so these are cheap fetch jobs, not streaming.
- **Week-of social sweep (last30days pattern):** an engagement-scored, multi-source sweep of the last 7 days across Reddit (r/Coffee, r/roasting, homeroast/prosumer communities), X coffee-trade voices, YouTube, HN (for the agent/dev angle), and industry RSS — modeled on `mvanhorn/last30days-skill`, which searches platforms in parallel, scores by real engagement (upvotes, likes, view counts), and has an agent judge synthesize a brief. Two implementation options: install the skill itself into the OpenClaw pilot pipeline (it supports OpenClaw as a host) with a 7-day window and pinned coffee queries, or build a slimmer `last7days-coffee` sweep with fixed sources and origin-in-season query rotation. Reed's requirement: takes must be week-of, super current; a 30-day window is too stale for a weekly wire.
- Guardrail: social-sweep output feeds the *editorial/news* sections only, always cited to its platform source with engagement counts, never blended into Purveyors data claims. It is untrusted external content and passes through the existing sanitization posture before any LLM step.
- Licensing note: ICE futures data redistribution is licensed; weekly editorial *reporting* of settlement levels with attribution is standard newsletter practice, but verify before displaying live quote widgets. ICO indicator is freely published.

### L1 — Deterministic computation (no LLM)
A weekly rollup job (parchment-api owned per ADR-007) produces an **edition-facts JSON**: top price drops, below-market lots, value-quality standouts, arrival/delisting counts by origin, index moves with `classification` and `move_driver` from the Market Index plan, metadata-trend deltas, plus the fetched external levels (KC weekly change, ICO indicator, etc.). Everything numeric is computed here, never by the LLM.

### L2 — LLM editorial
Takes edition-facts + a sanitized external-news digest and writes: headline, lede, 3-5 short stories, hot-items blurbs, one "chart of the week" callout. Hard guardrails:
- The LLM narrates only facts present in the structured payload; every numeric claim must appear verbatim in edition-facts.
- A validation pass (deterministic) diffs numbers in the prose against the payload and rejects/regenerates on mismatch.
- External news items are summarized-with-citation, never asserted as Purveyors observations. Observation vs. inference stays explicit (trust position).
- Cost is trivial: one weekly run, a few thousand tokens; the AI-cost model from the pricing analysis is unaffected.

### L3 — Canonical publication object
One `wire_editions` record (structured JSON: metadata, sections, stories, evidence links, external citations). Email, web, and RSS are **renderers of the same object** — no parallel editorial workflows (explicit requirement in the moonshot). Editions are immutable once published; corrections append.

### L4 — Distribution
- **Web:** coffee-app `/wire` area — edition pages (SSR, indexable), archive index, inline email signup, deep links into catalog/Market Index.
- **Email:** ESP (Resend or Buttondown class) with double opt-in; subscriber store keyed to the same auth/user model so a free email sub is a coffee-app account (or upgradeable ghost account).
- **RSS/Atom:** free syndication so writers, communities, and agents redistribute.
- **API/CLI (later):** `/v1/wire/latest` free projection + gated archive; `purvey wire` reads after the API contract stabilizes.

## Integration map

- **coffee-scraper:** already produces the raw observations; needs nothing new for v1 beyond truthful freshness metadata.
- **parchment-api:** owns edition computation, storage, and the wire endpoints; entitlement gating reuses the existing `ppiAccess` pattern (delayed/general = public, immediate/personal/historical = gated).
- **coffee-app:** `/wire` pages, email capture, archive gating, subscriber → Intelligence upsell path through existing checkout.
- **Blog:** stays the deep-analysis surface; the wire is the cadence surface. Wire items that deserve depth graduate into blog posts; blog posts get cited in wire editions. Shared audience funnel, separate formats.
- **Sourcing Radar (future):** the personalized paid wire *is* Sourcing Radar's notification surface; same intent objects, two delivery modes.
- **Existing internal analog:** the Wednesday Coffee Intelligence Report cron already produces an internal weekly market report from this data — the wire is its productization, and that cron is the natural pilot engine.

## Personalization (paid) mechanics

Saved sourcing intent (origins, processes, suppliers, price ceilings, score floors) filters the same edition-facts stream. Paid subscribers get: an "your market" section prepended to their email, immediate signal alerts between editions, and archive queries scoped to their intent. This reuses watchlist/saved-intent primitives rather than inventing a second preference model.

## Build sequencing

- **Phase 0 (now, ~4 weeks):** build the minimal core in the approved mergeable order: WP-1 wire contract, WP-2 generation job, WP-3 `/wire` surface, and WP-4 email dispatch. Run the first editions through the explicit human publish gate while the pipeline proves its cadence and content quality; OpenClaw may assist with review, but production generation lives in the scraper/parchment-api/coffee-app pipeline. Direct outreach and the founding offer ($12/$5/$15) remain part of launch validation, with ≥50 qualified free subscribers and ≥5 paid founders (or equivalent design-partner signal) as the commercial checkpoint.
- **Phase 1:** operate and refine the core publication pipeline, content schema, audience funnel, and delivery reliability. Remove the human gate only after several successful editions earn that autonomy.
- **Phase 2:** personalization, immediate alerts, API projection, and CLI reads.

Infrastructure is built now as the permanent minimal, flexible core; only the Phase 2 capabilities and earned automation are deferred behind launch evidence.

## Business-model grounding (external best practices)

### Benchmarks that frame expectations
- Freemium free→paid conversion typically lands at 2-5%; ~4% is the commonly cited B2B threshold for the free tier to be a pipeline rather than a cost center. Traditional funnels see ~13% visitor→free and ~2.6% free→paid. Early KPI should therefore be qualified list growth and retention (opens, evidence clicks, return visits), not paid conversion.
- Paid newsletters earn a median $83-$230 per subscriber per year by vertical, with investing/market verticals at the top. A $12/mo ($144/yr) Intelligence price sits squarely in the market-intelligence band; $15 bundle is defensible. Offer an annual at ~$120/yr (two months free) — standard churn-reduction practice.
- Newsletter playbook consensus: the paid tier must feel like *a different product*, not the same newsletter with bonus paragraphs. That validates the design: paid is a decision surface (personalization, alerts, history queries, Ask Parchment), not "more wire."

### How data-intelligence products conventionally draw the line
Five patterns recur across financial/market-data businesses, and the wire uses all five:
1. **Delayed vs. immediate** — free weekly digest vs. paid real-time alerts (the classic delayed-quote pattern).
2. **Aggregate vs. granular** — market-wide rollups free; segment- and lot-level granularity paid. This is already codified in the Market Index entitlement matrix (public slices = no origin filter, retail only).
3. **General vs. personalized** — one edition for everyone free; filtered-to-your-intent paid.
4. **Recent vs. historical** — current state free; longitudinal history, comparisons, and exports paid.
5. **Read vs. act** — consumption free; workflow (alerts, watchlists, exports, API access) paid.

### Refinement to the freemium line
Distinguish the **edition archive** from **data history**. Best practice for list-growth-stage newsletters is to keep editorial archives email-gated, not paywalled — archives convert weakly as a paid feature but strongly as an email-capture and SEO asset. So: free email sub = full *edition* archive on site. Paid = full *data* history (lot/segment price history, comparisons, exports, archive-wide queries) through Market Index/Parchment. The prose stays cheap; the queryable data underneath is the paid asset.

### Domain-specific caveat
Trade houses and importers (StoneX, Sucafina, major importers) already publish free weekly macro coffee-market commentary as marketing. Macro commentary is table stakes and cannot be the paid line. The differentiated, non-replicable asset is the structured micro-data: offer-list changes across 40+ US importers with provenance. The free edition should lead with a taste of that micro-data (it is the shareable hook nobody else has); macro context frames it but never carries it.

### Standard growth mechanics to adopt
- Founding-member scarcity with price lock (already in the moonshot: first 50).
- Double opt-in, plain-text-leaning email design, consistent send time.
- Referral loop and social share cards per signal page later, once cadence is proven.
- Every edition ends with one clear paid-tier moment: a blurred/locked personalized insight ("3 lots matched your Ethiopia mandate this week") rather than a generic upgrade banner.

## Open questions

1. ESP choice and whether free email subs create app accounts immediately or at first login.
2. Exact public-archive gating (free-with-account vs. trailing N editions public) — affects SEO vs. conversion tradeoff.
3. Futures-data display licensing vs. editorial-mention approach.
4. Whether the pilot editions live at `/blog` (fastest) or a provisional `/wire` route (cleaner migration).
