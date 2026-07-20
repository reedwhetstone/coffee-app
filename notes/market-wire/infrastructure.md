# Purveyors Market Wire — Pipeline & Technology Infrastructure (Recommendation)

_Created: 2026-07-19_
_Status: Architecture recommendation — approved direction 2026-07-19. Reed rejected the manual pilot: the wire pipeline is foundational infrastructure for an intelligence company (weekly report generation at cadence), to be built now as a minimal, flexible core. Report contents will evolve; the pipeline is permanent._
_Companions: `purveyors-market-wire-research.md` (research package), `purveyors-market-wire.md` (product/pipeline design)_

## 0. Recommendation up front

Yes to repositioning coffee-scraper as the **ingestion and generation layer** of the business, with one hard boundary: coffee-scraper produces and assembles; **parchment-api remains the canonical contract layer** that stores, gates, and serves editions. Coffee-app stays a renderer. The weekly wire cron runs on the scraper host alongside the nightly scrape.

Rationale in one line: the scraper repo already is the batch layer — it has the production host with cron, the OpenRouter LLM client, the cleaning/validation pipeline, the audit discipline, and the schema source of truth. Editorial generation is batch, offline, retryable, cron-shaped work: exactly the scraper host's profile and exactly what a Render starter web service should not do.

## 1. Current deployment reality (verified)

- **coffee-scraper:** runs nightly on a dedicated VM (`run-scraper.sh`, cron with randomized delay, email report). Repo already contains: OpenRouter `llmClient` (data-processing preset), unified LLM cleaning pipeline with Zod post-validation, embedding generation, an audit agent with per-check modules, canonical `COLUMN_SCHEMA`, price-tier extraction, and standalone jobs (`updatePrices`, backfills). It is already an ingestion + LLM-enrichment system in all but name.
- **parchment-api:** pnpm monorepo (`packages/api`, `packages/sdk`), Render web service (starter plan, Oregon, co-located with prod Supabase). Owns market-index/signals routes and intelligence computation per ADR-007. Stateless serving; not a job runner.
- **coffee-app:** SvelteKit reference client (ADR-007). Owns UI, checkout/entitlements, blog content, SSR public surfaces.

## 2. Layer assignment

### coffee-scraper → "Purveyors data pipeline" (ingestion + generation)

Reframe the repo's identity from "scraper" to the business's pipeline layer, four stages:

1. **Observation (exists):** nightly supplier scrapes → `coffee_catalog`, `coffee_price_snapshots`.
2. **Enrichment (exists):** LLM cleaning, descriptions, tasting notes, embeddings, audits.
3. **External context ingestion (new):** small weekly fetchers, one module each, same source-registry pattern as scrapers:
   - `macro/`: ICE KC + robusta settlement levels, ICO composite indicator, FX pairs. Stored as observations with source + fetch time.
   - `news/`: curated RSS (Daily Coffee News, GCR, Sprudge, Reuters softs), title/link/date/summary only.
   - `social/`: the 7-day engagement-scored sweep (Reddit JSON/arctic-shift, X where feasible, YouTube, HN). Ship as deterministic fetchers + scoring in-repo (a slim `last7days-coffee`), not as a dependency on a personal OpenClaw instance; last30days-skill is the design reference, not the runtime.
   - All external content is untrusted: sanitized, length-capped, and wrapped before any LLM step (same posture as the email reader).
4. **Generation (new):** the weekly wire assembly job (§4).

### parchment-api → canonical contract layer (unchanged role, new nouns)

- Owns `wire_editions` storage and the **edition-facts computation** (it already computes market signals, index moves, movement classification; edition-facts is a weekly rollup view over the same primitives — ADR-007 says this computation lives here, not in the scraper).
- New routes:
  - `GET /v1/wire/latest` — public, the current edition (JSON).
  - `GET /v1/wire/editions` + `GET /v1/wire/editions/:n` — list public; older bodies email-gated/entitled per the freemium line.
  - `GET /v1/wire/edition-facts` (internal/admin) — deterministic facts payload for the generation job.
  - `POST /v1/wire/editions` (internal/admin, service-auth) — the generation job submits a draft; publish flips state in **one database-owned transaction** (hard lesson from the PR #464 red team: no activatable publication state computed outside the DB, editions immutable once published, corrections append).
  - Later (Phase 2): personalized wire + alert endpoints keyed to saved sourcing intent, gated by `ppiAccess`.
- RSS/Atom can be served by parchment-api or rendered by coffee-app from `/v1/wire/latest`; recommend coffee-app renders it (keeps API JSON-only).

### coffee-app → renderer + subscriber funnel

- `/wire` routes: SSR pages rendered from wire endpoints (indexable; latest public, archive gated by free account/email), edition archive index, inline signup, deep links into catalog/Market Index with existing entitlement handling.
- Subscriber management UI; upgrade path into existing Intelligence checkout.
- RSS/Atom render + email-template render (same canonical object, three renderers).

### Email infrastructure

- **ESP: Resend** (dev-first, cheap at pilot scale, broadcast + audiences API, good DX from Node). Buttondown is the fallback if we want more built-in newsletter mechanics.
- **Source of truth for subscribers: Supabase** (`wire_subscribers`: email, user_id nullable, status, double-opt-in timestamps, source/attribution). ESP audience is a synced projection, never the master list. Free email subs become lightweight accounts on first site login (open question resolved toward: don't force account creation at subscribe time; minimize signup friction).
- Send is triggered by the publication step: after `POST /v1/wire/editions` publish succeeds, the pipeline job renders the email from the canonical object and calls the ESP broadcast API. One object, web/email/RSS renderers, no parallel editorial.

## 3. Data model sketch (Supabase)

- `wire_editions` — `edition_number` (the collectible "Edition #N"), `status` (draft/published), `published_at`, `facts` jsonb (edition-facts payload, immutable), `content` jsonb (structured sections: headline, stories, vibes, macro, deep-dive, scoreboard entries), `citations` jsonb, `methodology_version`. Append-only after publish; corrections as child rows.
- `wire_external_observations` — macro/news/social items: `kind`, `source`, `url`, `payload` jsonb, `observed_at`, `engagement` jsonb. Written by scraper-repo ingesters; read by edition-facts and generation.
- Subscriber model (decided 2026-07-19): **no separate `wire_subscribers` table.** Subscription lives on the existing user/roles model: email-first signup auto-creates a passwordless Supabase account via magic link (confirmation click = double opt-in + first login), sub state + bounce/complaint status are columns there, and existing users toggle in coffee-app settings. One-click unsubscribe via signed token requires no session; ESP audience is a projection. A small `wire_dispatch_log` table records per-edition sends for idempotency and webhook state. Magic-link/confirmation emails route through Resend custom SMTP on the warmed wire subdomain.
- `wire_calls` — the public scoreboard: named call, edition made, resolution edition, grade. Small but load-bearing for the brand.

## 4. The weekly generation job (scraper repo, cron on scraper host)

Runs e.g. Sunday evening MT (after the week's last nightly scrape, before Monday-morning send):

1. Run external ingesters (macro, news, social) → `wire_external_observations`.
2. Call `GET /v1/wire/edition-facts` (parchment-api computes: movers, arrivals, delistings, below-market, index moves with classification, metadata deltas, plus external observations joined in).
3. LLM editorial pass (existing `llmClient` pattern + a new editorial preset): drafts sections from facts + cited context. Same discipline as the cleaning pipeline: schema-validated JSON out (Zod), bounded retries.
4. **Numeric validation pass (deterministic):** every number in prose must match the facts payload; mismatch → regenerate section, then fail loudly. Reuses the audit-agent pattern.
5. `POST /v1/wire/editions` as draft.
6. **Human gate (pilot and early production):** Reed/OpenClaw review the draft (Discord notification with preview link); publish is an explicit action. Automation earns removal of this gate later, not before.
7. On publish: transaction flips state → coffee-app pages live → email render + ESP broadcast → RSS updates.

Failure modes: any stage failing leaves no partial publication (draft-only writes); the job emails/reports like the nightly scrape does; a missed week is a loud alert, not a silent skip (cadence is the product).

## 5. What runs where (summary)

- Scraper VM cron: nightly scrape (exists), weekly ingesters + generation job (new).
- Render (parchment-api): edition-facts computation on request, wire endpoints, publication transaction. No long-running jobs; the weekly rollup is cheap SQL over existing snapshots.
- Vercel (coffee-app): SSR wire pages, RSS, email templates, signup/checkout.
- OpenClaw (this workspace): Phase 0 pilot only — assembles editions manually with existing Market Index signals + ad-hoc sweeps; also the human-gate notifier. The production pipeline must not depend on OpenClaw.

## 6. Alternatives considered

- **Everything in parchment-api:** rejected. Render starter web ≠ job runner; editorial LLM deps and social fetchers bloat the API surface; ADR-007 gives the API computation, not editorial production. Cron on Render is possible but splits scheduled work across two hosts for no gain.
- **New dedicated repo:** rejected for now. Fourth repo overhead; the scraper already owns the host, the LLM client, schema truth, and audit discipline. Revisit only if the pipeline identity outgrows the scraper (a rename/reframe of the existing repo is cheaper than a split).
- **coffee-app owns generation:** rejected outright; it is a reference client and a serverless deploy with no batch profile.
- **OpenClaw owns production generation:** rejected; fine for the pilot, but the business pipeline can't depend on a personal agent host. OpenClaw remains the R&D and review loop.

## 7. MVP build plan (pilot rejected; building core now)

Design principle: **minimal and flexible.** The stable, permanent contract is the pipeline shape — facts in, validated sections out, one canonical edition object, publish transaction, renderers. Section types and report contents are schema-versioned jsonb payloads that can change every quarter without touching the pipeline. Reliability comes from the draft/publish separation, the deterministic numeric-validation gate, and loud cadence-failure alerts — not from content stability.

Work packages, each a mergeable slice (build order):

- **WP-1 — parchment-api: wire contract.** `wire_editions` + `wire_subscribers` tables (jsonb `facts`/`content` with `schema_version`), `GET /v1/wire/edition-facts` (internal; v1 = thin rollup over existing signals/index primitives), `POST /v1/wire/editions` draft submit, publish as one DB transaction, `GET /v1/wire/latest` + editions list. PADR for the wire contract. No personalization, no scoreboard table yet.
- **WP-2 — coffee-scraper: generation job.** Weekly cron on the scraper host: macro + news ingesters (social sweep deferred), LLM editorial pass producing schema-validated sections, deterministic numeric-validation gate, draft submit, Discord notification for the human publish gate. Scraper ADR reframing the repo as ingestion + generation layer.
- **WP-3 — coffee-app: wire surface.** `/wire` SSR pages (latest public + indexable, archive email-gated), signup with double opt-in writing `wire_subscribers`, RSS/Atom render, coffee-app ADR for the subscriber model.
- **WP-4 — email dispatch.** Resend integration triggered by publish; email render from the canonical object. Smallest slice; can ride with WP-3 if convenient.

Integration order mirrors the Market Index program: WP-1 first (contract live), WP-2/WP-3 in parallel against it, WP-4 last. Human publish gate stays until the pipeline has earned autonomy over several editions.

Deferred (Phase 2, unchanged): in-repo social sweep, personalization + immediate alerts (Sourcing Radar delivery), CLI `purvey wire`, free API projection, scoreboard table, sponsorship tooling.

## 7b. Knowledge layer: RAGify the wire corpus (added 2026-07-20)

**Principle: tables for facts, RAG for narrative.** Anything numeric, current, or exactly filterable (prices, availability, signals, index moves, supplier stats) is served by structured Parchment tool calls. The knowledge corpus holds prose with provenance: wire editions and sections, deep dives, blog posts, curated news summaries, social-sweep threads, macro notes. The chat agent gets both: tool calls answer "what does Ethiopia washed cost this week," retrieval answers "what's been going on with Ethiopian coffee lately."

### Reassessment of the existing RAG (verified 2026-07-20)
Current corpus is `coffee_chunks`: per-coffee `profile/tasting/origin/commercial/processing` chunks embedded from catalog rows, retrieved by `RAGService` as semantic inventory search. Verdict per the tables-vs-RAG principle:
- **Keep vectors for sensory/discovery search** (`tasting`/`profile` chunks): fuzzy queries like "chocolatey comfort coffee" are the legitimate embedding use case, and bean-similarity already depends on vectors.
- **Retire `origin`/`commercial`/`processing` chunk types**: they are structured catalog fields rendered to prose — tool calls against catalog/Parchment are exact, fresher (chunks drift stale after catalog updates), and cheaper to maintain.
- Nothing currently feeds the RAG on a schedule; that is fine — the wire pipeline becomes its feeder.

### Corpus schema
`knowledge_documents` (+ `knowledge_chunks` with pgvector embeddings), categorized at write time — categorization is the load-bearing feature:
- `source_type`: `wire_edition | edition_section | deep_dive | blog_post | news_item | social_thread | macro_note`
- `topics[]`: controlled vocabulary (market_movement, origin_report, pricing, processing, supply_chain, futures_macro, community/vibes, meta)
- `entities`: origins, suppliers, processes, varieties — normalized to the same vocabularies the catalog uses, so retrieval filters join cleanly with tool-call filters
- Time: `edition_number`, `published_at`, `observed_window`
- Provenance: `source_url`, engagement stats for social items, and a `trust_class` — `our_data | external_reported | community_take` — which the chat agent must surface when citing
- Lifecycle: editions and blog posts are permanent; news/social items get freshness-decayed retrieval weighting rather than deletion.

### Ingestion (small delta on the existing pipeline)
The wire pipeline already produces categorized artifacts: edition sections are structured JSON, social-sweep items arrive scored and classified, news items are curated with URLs. RAGification is one added post-publish stage in the weekly job: chunk → embed (same embedding service as `coffee_chunks`) → upsert with categories. Blog posts ingest via the same stage on merge. Critically, **the categorized raw corpus is stored from edition #1** even if retrieval serving ships later — the archive compounds regardless.

### Serving
- parchment-api: `GET /v1/knowledge/search` — query embedding + structured filters (source_type, topics, entities, week range, trust_class), returning chunks with citations. Entitlement: Intelligence gets the full corpus (news, social, macro context); free/anonymous gets published-edition content only, keeping the paid line consistent (general and published free; contextual depth paid).
- coffee-app chat: a `search_market_knowledge` tool alongside the existing structured tools; the system prompt directs facts to tools and context to retrieval, with citations rendered.
- CLI later: `purvey knowledge search` once the API contract stabilizes (ADR-006 ordering).

### Sequencing
- WP-2 (generation job) gains the corpus-write stage — cheap, do from edition #1.
- Knowledge serving (`knowledge_search` endpoint + chat tool + coffee_chunks retirement slice) is **WP-5**, after the MVP wire ships. The coffee_chunks retirement is its own small PR: drop retired chunk types from generation and retrieval, keep sensory search.

## 8. Weak spots and pre-build validation (added 2026-07-19)

Verified live 2026-07-19: `/v1/price-index/stats` serves real prod data (retail +5.1% weekly move, exceptional, mix_shift, 422 lots / 13 suppliers); `/v1/market/signals` is deployed but returned **zero signal rows** — investigate whether the daily signals job is running/backfilled in prod before edition-facts is built on it.

1. **Dry-week risk (measure now):** quantify a typical week from `coffee_price_snapshots` — arrivals, delistings, qualifying price moves per week, by season. If some weeks are thin, the edition template needs deep-dive/vibes ballast by design, and the facts endpoint needs a "quiet week" honesty mode.
2. **Signals population — RCA complete (2026-07-19):** `market_signals` has never populated in prod. The compute functions shipped Jul 5 (coffee-app migrations `20260705_01/02`) and scraper PR #354 wired `compute_market_signals` / `compute_metadata_index` / `compute_price_move_stats` into the all-source nightly path the same day — but that wiring sits inside the `shouldPublishLegacyDailyAggregates` gate, and scraper commit `68c9636` (Jul 13, Shopify 429 incident response) froze the gate via `PUBLISH_LEGACY_DAILY_AGGREGATES = false`. In the Jul 5–13 window the VM was revision-drifted and mid-429-meltdown, so no clean all-source aggregate pass appears to have completed before the freeze. Blast radius: `price_index_snapshots`, period changes, market summary, supplier stats, metadata index, and signals all frozen since Jul 13 (Market Index UI serving stale index data); `/v1/price-index/stats` unaffected because it computes inline from raw `coffee_price_snapshots`, which stay fresh — raw scraping and snapshot writes are healthy, only aggregate publication is off. The freeze's stated successor ("provenance-aware market publication path") was the PR #464/#465 effort, which the red team rescoped — so the replacement doesn't exist either. Remediation: reviewed unfreeze PR (flip the flag; the test suite explicitly models this as a deliberate reviewed switch) once nightly-run stability under the PR #363 scheduler is confirmed; verify signals emit rows the next morning via the existing `marketIndexHealth` checks; backfill the Jul 13→unfreeze gap for the backfillable aggregates; debug the signals SQL only if a clean run still emits zero.
3. **Coverage honesty:** the wire describes the *observable public spot market* — relationship-only importers (ofi, InterAmerican, Mercon class) publish no offer lists and are invisible to us. Methodology page must say so plainly; overclaiming "the US market" invites the credibility attack.
4. **Freshness gates:** a failed scrape or blocked supplier must suppress affected segments from edition-facts (truthful-freshness rule), not silently publish stale numbers. Interacts with the unresolved scraper publication-layer rework (PR #464/465 lessons).
5. **Scraper-host operational debt:** single VM, random-delay cron, email-report monitoring, recent 429/revision-drift incidents. The wire makes Sunday-night reliability a product SLA; host hardening or at least run-verification belongs in WP-2.
6. **Human editorial load:** LLMs draft competently but the brand promise is opinionated and funny. Named calls (scoreboard), memes, and voice are human functions. Unresolved: whose voice (Reed first-person, Purveyors editorial "we," or a persona), and Reed's weekly minutes budget for review/punch-up.
7. **Distribution beyond the first 50:** SEO compounds slowly; memes need an audience; no Purveyors social presence exists today. Needs a channel plan (X/IG/Reddit presence, who posts, cross-post cadence) or growth stalls at outreach scale.
8. **Paid wedge timing:** personalization (the real conversion driver) is Phase 2; MVP paid pitch leans on existing Intelligence features. Set conversion expectations accordingly.
9. **Independence policy:** sponsorship rules (can importers sponsor? disclosure?), affiliate/marketplace conflicts if those ever emerge, and the public corrections policy are brand-load-bearing and undecided.
10. **Legal hygiene:** CAN-SPAM/GDPR basics for the list, privacy-policy update for email collection, futures-data licensing (editorial mention with attribution for MVP), and the standing scraping/ToS posture now applied to *republication* at attribution level.
11. **Naming:** "Market Wire" vs existing "Market Index" adjacency — deliberate family or confusing? Quick trademark sanity check before public use.

## 9. Open items folded forward

- Resend vs Buttondown final call (pilot can be manual either way).
- Whether parchment-api or coffee-app serves RSS long-term (leaning coffee-app renderer).
- Social sweep production hardening (rate limits, ToS posture per source) before Phase 2.
- Scraper repo rename/reframe timing (identity change is cheap in docs, disruptive in tooling; do the ARCHITECTURE.md/README reframe first, rename only if it ever matters).
