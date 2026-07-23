# Purveyors Canonical Backlog

> **Single source of truth:** This is the only cross-product, ordered backlog for
> Purveyors. Product ideas, ADRs, implementation plans, PR audits, and repo-local
> checklists provide evidence and acceptance criteria, but they do not establish
> priority. Add, reorder, close, or split work here first.

**Owner:** Purveyors product ecosystem

**Canonical repo:** `coffee-app`

**Canonical path:** `notes/DEVLOG.md`
**Last reconciled:** 2026-07-22

## How to use this backlog

- Keep entries at program or independently shippable outcome level. Put detailed
  acceptance criteria in the linked plan owned by the implementing repo.
- When work ships, remove its entry after recording the durable result in the
  relevant plan, ADR, release notes, or PR. Do not maintain a completed section.
- Before starting work, confirm the linked plan still matches production and
  split the next mergeable slice in the repo that owns the behavior.
- GitHub PRs represent work in flight, not a second backlog. Open drafts and stale
  PRs should be resolved under the corresponding entry below.
- Archived notes and unchecked acceptance checklists are historical evidence, not
  automatically active work.

## P0: Restore trust in the market-data and platform foundation

- [ ] **Complete Market Index aggregate recovery.** Coffee-scraper PR #374 restored
      the reviewed all-source aggregate publication path and merged on 2026-07-21.
      Confirm the production revision, run the bounded Jul 13 to deployment backfill
      for eligible aggregates, and verify fresh `price_index_snapshots`, period
      changes, market summary, supplier stats, metadata index, and non-empty market
      signals. Do not advance Signal-dependent Wire or Radar reads until freshness and
      health checks pass. Plans:
      `notes/implementation-plans/2026-07-16-market-publication-recovery-and-activation.md`
      and `notes/implementation-plans/2026-07-13-market-publication-continuity-program.md`.

- [ ] **Audit and retire headless-cutover deployment debt.** Trace coffee-app,
      Parchment API on Render, the published SDK, Purveyors CLI, Vercel, and production
      database contracts after the recent API-first extraction. Produce a concrete
      inventory of obsolete coffee-app `/v1` or direct-Supabase paths, stale Render
      deployment assumptions, compatibility proxies, duplicated business logic,
      missing canaries, and migrations that shipped in code but not production. Turn
      verified gaps into small repo-owned slices. Starting references:
      `notes/decisions/007-headless-api-extraction-web-as-reference-client.md`,
      `notes/ARCHITECTURE.md`,
      `notes/implementation-plans/2026-07-22-coffee-app-supabase-data-boundary-retirement.md`,
      `notes/implementation-plans/2026-07-01-span-b-legacy-v1-catalog-proxy.md`, and
      `notes/implementation-plans/2026-07-04-catalog-shell-performance-headless-plan.md`.

- [ ] **Finish the scalar entitlement cutover safely.** The Parchment and
      coffee-app consumer changes have landed; complete the production observation,
      reconciliation, destructive-migration preflight, schema contraction, and
      coffee-app/Parchment/CLI/billing/chat canaries. Do not remove rollback
      compatibility until both independently deployed consumers are proven live.
      Plan: `notes/implementation-plans/2026-07-18-scalar-app-role-cutover.md`.

- [ ] **Run a cross-repo keystone and ADR alignment audit.** Reconcile
      `PRODUCT_VISION.md`, coffee-app ADRs, Parchment PADRs, scraper decisions,
      CLI ADRs, READMEs, AGENTS files, public docs, billing copy, and deployment docs.
      Resolve contradictions in ownership, route boundaries, entitlements, pricing,
      product names, source counts, publication semantics, and migration authority.
      Add explicit cross-repo references where a decision is owned elsewhere.

## P1: Build the distribution and revenue engine

- [ ] **Build Market Wire WP-1: canonical contract.** In Parchment API, ship
      edition facts, immutable draft/publish semantics, public latest/list reads, and
      durable idempotent dispatch intents. Facts must cite evidence and suppress stale
      or incomplete segments. Add the governing PADR. Plan:
      `notes/market-wire/infrastructure.md`.

- [ ] **Build Market Wire WP-2: generation pipeline.** In coffee-scraper, add the
      weekly macro/news ingestion and editorial generation job, schema validation,
      deterministic numeric verification, loud cadence failures, draft submission,
      and the initial human publish gate. Reframe the repo in docs as the Purveyors
      ingestion and generation layer without renaming it yet.

- [ ] **Build Market Wire WP-3 and WP-4: web, subscriber, email, and RSS loop.** In
      coffee-app, ship indexable `/wire` editions, archive access, passwordless double
      opt-in, settings and signed unsubscribe flows, RSS/Atom, and the shared email
      renderer. Add retryable post-publish email and knowledge-ingest workers against
      the canonical edition object, including bounce/complaint handling and legal
      hygiene. Resend is the current recommendation; make the final provider decision
      during the implementation slice.

- [ ] **Launch and measure the Wire.** Publish early editions through the human
      gate, recruit the first 50 qualified roasters/buyers/writers/supplier contacts,
      and measure subscriber growth, open rate, evidence clicks, repeat visits,
      replies, and paid conversions. Establish corrections, independence,
      sponsorship, attribution, futures-data, and observable-market methodology
      policies before scaling distribution. Strategy:
      `notes/big-ideas/2026-07-19-purveyors-market-wire.md`.

- [ ] **Reprice the self-serve product family.** Change Parchment Intelligence
      from $39 to about $12/month, Mallard Studio from $9 to about $5/month, and add a
      combined founding bundle at $15/month. Preserve Parchment API as a separate
      Green / Origin / Enterprise product. Audit actual OpenRouter, email, storage,
      and support cost exposure first; then align Stripe products/prices, purchase
      keys, entitlements, checkout, annual pricing, upgrades/downgrades, existing
      customer treatment, public copy, tests, and analytics. The current working offer
      is $12 Intelligence, $5 Studio, and $15 bundle for the first 50 customers.

- [ ] **Make the blog a recurring publication system.** Establish a minimum
      weekly cadence with one canonical queue from idea to sourced outline, draft,
      Reed-voice review, image, links, metadata, publish, email, and performance
      review. Resolve the current open PR queue before creating more drafts: refresh
      or close stale PRs #287, #358, and #369. Keep the Wire and blog distinct but
      connected: Wire is recurring market reporting; the blog carries deeper product,
      market, API, and agentic arguments. Sources: `notes/blog/ideas.md`,
      `notes/blog/source-map.md`, and `notes/BLOG_STRATEGY.md`.

- [ ] **Close the full public conversion loop.** Connect catalog, analytics,
      Market Index, Wire, blog, email, subscription, and checkout with coherent CTAs
      and attribution. Validate sitemap, `llms.txt`, feeds, social metadata, structured
      data, shared URLs, event naming, and post-purchase return paths. Use real funnel
      data to prioritize the next conversion fix instead of accumulating generic
      landing-page work.

## P1: Build the market knowledge and decision layer

- [ ] **Capture a provenance-aware market corpus from day one.** Add
      `knowledge_documents` and `knowledge_chunks` for published Wire editions,
      sections, deep dives, blog posts, curated news, social threads, and macro notes.
      Store source type, controlled topics, normalized entities, time window, URL, and
      trust class. Drafts must never enter the corpus; published content must ingest
      idempotently through a durable post-publish intent.

- [ ] **Ship RAG serving and evaluation as Market Wire WP-5.** Add filtered,
      citation-preserving Parchment knowledge search, coffee-app chat integration, and
      a retrieval evaluation set. Route current numeric/filterable questions to
      structured tools and narrative/history questions to retrieval. Enforce latest
      public, free-subscriber archive, and Intelligence full-corpus boundaries. Retire
      structured `origin`, `commercial`, and `processing` catalog prose chunks in a
      separate slice while preserving sensory/profile vector search. Plan:
      `notes/market-wire/infrastructure.md#7b-knowledge-layer-ragify-the-wire-corpus-added-2026-07-20`.

- [ ] **Build Sourcing Radar after aggregate freshness is proven.** Deliver the
      four mergeable slices in order: canonical Parchment Radar read, Parchment API-owned intent
      contract, coffee-app self-service setup, then personalized dashboard and agent.
      Keep deterministic matching and explainable evidence ahead of notifications or
      autonomous procurement. Plan:
      `notes/implementation-plans/2026-07-18-purveyors-sourcing-radar-index-first-mvp.md`.

- [ ] **Complete canonical coffee identity resolution.** Move grouped canonical
      and similar results into CLI and agent workflows, establish identity review,
      add the scraper resolution pipeline, and expose canonical merged views. Keep
      exact identity, substitutes, and sensory similarity distinct. Program:
      `notes/implementation-plans/2026-05-04-canonical-green-coffee-matching.md`.

- [ ] **Complete proof and transparency contracts.** Measure proof coverage, add
      capability-gated proof filters, review the private proof-passport pilot, finish
      conservative process backgeneration, and promote certification evidence into a
      first-class schema only after coverage is credible. Keep raw evidence private
      by default and avoid verification or compliance claims the data cannot support.

## P2: Expand API, commerce, and agent leverage

- [ ] **Complete canonical API and CLI parity.** Keep the shipped price-index CLI
      command and conversion docs aligned; move remaining compatible read-only catalog and intelligence commands to
      Parchment contracts; add the `fields=summary` projection and fail-closed query
      aliases where still needed; generate or vendor a small CLI manifest fragment for
      coffee-app docs. Keep owned inventory, roast, sales, and tasting writes behind
      the member key and matching scopes.

- [ ] **Centralize catalog capability enforcement.** Make public proof, viewer
      visibility, member search leverage, and paid API capabilities resolve from one
      contract across coffee-app and Parchment. Include query/field/rate/key limits,
      process and proof filters, score language, and anonymous teaser behavior.

- [ ] **Ship direct supplier cart handoff and attribution.** Build canonical
      supplier/product/variation handoff identifiers, safe outbound cart or product
      links, attribution events, failure fallback, and supplier-specific adapters
      without turning coffee-app into an order processor. Plan:
      `notes/implementation-plans/2026-07-20-direct-purchasing-cart-handoff.md`.

- [ ] **Advance suppliers from scraped listings toward direct publishing.** Ship
      the Open Coffee Listing Schema validator, mapping preview, evidence-safe errors,
      and docs before direct feeds or supplier accounts. Keep the validator dry-run
      only until governance, provenance, and update authority are explicit.

- [ ] **Harden the scraper and publication SLA.** Resolve Shopify fleet
      rate-limit/backoff and Web Bot Auth work, eliminate production revision drift,
      verify every scheduled run, preserve immutable observations, and make source
      health/freshness visible to every downstream publication. Resolve or replace the
      currently open coffee-scraper PR #370 rather than leaving a conflicted branch as
      an implicit task.

- [ ] **Productize safe agent workflows.** Finish the conversation-first chat and
      evidence-shelf direction, keep structured write proposals behind explicit user
      confirmation, align tools with published SDK/CLI contracts, and render citations
      and trust classes consistently. Plans:
      `notes/implementation-plans/2026-07-13-chat-conversation-first-redesign.md`
      and `notes/implementation-plans/2026-07-14-active-scene-evidence-shelf.md`.

## P3: Strengthen Mallard Studio and product quality

- [ ] **Fix verified workflow and refresh defects.** Reproduce and resolve stale
      post-save data, route-transition chart sizing, profit refresh, and any exposed
      internal reference fields. Add focused regression coverage before carrying an
      old DEVLOG report forward as a bug.

- [ ] **Complete the roast-data and chart coherence pass.** Correct Artisan
      fan/heat scaling and imports; surface turning point, first crack, drop,
      development percentage, weight loss, ambient and charge context; improve mobile
      chart controls; and build comparison only after the shared roast model is
      coherent. Prefer one cross-surface model over individual chart patches.

- [ ] **Improve inventory, profit, tasting, and sharing around decisions.** Track
      remaining purchased quantity, reduce catalog/inventory duplication, connect
      sales to actual roasts, preserve paragraph formatting, add brew method where it
      still adds value, and design one reusable shareable roast package rather than
      separate overlapping share features.

- [ ] **Pay down measured performance and quality debt.** Rebaseline Core Web
      Vitals, catalog loading, skeleton behavior, lint scope, explicit `any` hotspots,
      missing indexes, and E2E reliability against current main. Keep only verified
      findings, then attack the highest user or delivery cost first.

## Later, conditional bets

- [ ] **Market and portfolio expansion:** supplier/origin comparison, resilience
      and concentration risk, barbell sourcing, diversification scoring, edge-origin
      watchlists, and risk-adjusted economics. Advance only when Radar and the market
      corpus provide reliable inputs.
- [ ] **Transaction and network bets:** lot sharing, group buying, Coffee Intent
      Exchange, and supplier-side accounts. Advance only after cart handoff,
      attribution, identity, and listing-governance primitives prove demand.
- [ ] **Roasting expansion:** Ghost Roast, deeper roast analytics, hardware or
      roast-machine integrations, and dataset licensing. Advance only when they
      strengthen Intelligence or Studio retention rather than recreate a generic
      roasting suite.
- [ ] **Community and open-source distribution:** public project links,
      integrations, embeddable outputs, and automation templates. Tie each effort to a
      measurable distribution path before implementation.

## Reconciliation record

This 2026-07-21 pass audited:

- coffee-app: the prior DEVLOG, Product Vision, current ADRs, active
  implementation plans, July 20 workspace migration, Market Wire package,
  Sourcing Radar, direct purchasing, blog queue/source map, API strategy/tiering,
  code TODOs, and open GitHub PRs;
- coffee-scraper: README/SUPPLIERS, decisions, active plans, Market Index recovery,
  source-health and Shopify work, code TODOs, and open GitHub PRs;
- parchment-api: PADRs, active plans, deployed route and migration ownership, and
  open GitHub work;
- purveyors-cli: ADRs, active plans, manifest/docs, release state, code TODOs, and
  open GitHub work; and
- OpenClaw workspace: `brain/tasks.md`, Purveyors project/idea/moonshot notes,
  daily memory references, and the July 20 migration pointers.

Deduplication rules applied:

- completed PR history, old PR audits, archived plans, and acceptance-test
  checklists were not copied as active work;
- overlapping old DEVLOG items were combined into product outcomes;
- migrated workspace notes remain pointers only and cannot own Purveyors work;
- unclear references without a verified problem or strategic fit were dropped;
- GitHub PR state was checked on 2026-07-21 so merged work was not re-added as a
  feature request.
