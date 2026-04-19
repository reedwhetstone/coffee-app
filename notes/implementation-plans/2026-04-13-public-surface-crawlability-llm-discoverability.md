# Implementation Plan: Public Surface Crawlability and LLM Discoverability

**Date:** 2026-04-13  
**Slug:** public-surface-crawlability-llm-discoverability  
**Status:** Proposed  
**Focus area:** Public marketing, catalog, analytics, docs, blog, and machine-readable discoverability

## Goal

Make every public, no-login-required surface on purveyors.io easy to discover, index, crawl, scrape, and interpret by traditional search engines, social unfurlers, generic scrapers, and LLM/agent systems, without weakening product clarity or exposing authenticated surfaces.

## Scope

Public routes and public assets only, including:

- `/`
- `/catalog`
- `/analytics`
- `/api`
- `/docs`
- `/blog`
- `/blog/[slug]`
- `/contact`
- `/privacy`
- `/terms`
- `/llms.txt`
- `/sitemap.xml`
- public API entry points and docs that are intentionally anonymous or API-key-accessible, especially `/v1` and `/v1/catalog`
- route metadata, canonical URLs, structured data, crawl directives, internal linking, machine-readable summaries, and HTML-first content legibility

## Non-goals

- Reworking authenticated product surfaces such as Mallard Studio workflows, Parchment Console account flows, or paid-only Parchment Intelligence experiences
- Changing ranking through backlink campaigns or off-site SEO programs
- Expanding private data exposure in the name of crawlability
- Turning every API response into an LLM-specific format beyond stable public contracts and clear docs
- Large brand or copy rewrites unrelated to discoverability

## Guiding principles

1. Public means truly legible without login, JavaScript hydration, or insider context.
2. Canonical naming stays current and explicit: Mallard Studio, Parchment API, Parchment Intelligence, Parchment Console, and Green / Origin / Enterprise.
3. HTML should carry the core meaning first; scripts should enhance, not conceal.
4. Crawlers and agents should find one canonical URL per concept, not many near-duplicates.
5. Machine-readable surfaces should be stable, documented, and easy to traverse.
6. Public discoverability must not blur the boundary between open content and authenticated product surfaces.

## Workstreams

### 1. Public route inventory and indexability policy

Create a single source of truth for which routes are:

- index
- noindex
- canonical
- public but low-priority
- public API/documentation entry points

This should explicitly cover the current public surface set and prevent accidental indexing of auth-adjacent or thin utility pages.

### 2. Metadata and canonical consistency

Normalize all public pages so they consistently emit:

- unique title and meta description
- absolute canonical URL
- Open Graph and Twitter tags
- consistent robots directives
- route-appropriate JSON-LD

Finish any gaps between marketing pages, docs pages, catalog/analytics pages, and blog pages so crawlers see a complete, unambiguous page identity on first HTML load.

### 3. HTML-first content legibility

Audit public pages for content that is visible in the browser but weak in initial HTML.

Target issues such as:

- important headings or summaries only becoming clear after hydration
- thin intro copy on catalog, analytics, and docs landing pages
- missing explanatory text around public product surfaces and plan boundaries
- tables, cards, and filters that lack crawler-friendly summary text

Add concise static copy blocks where needed so a scraper or LLM can understand the page purpose, audience, and key entities from raw HTML alone.

### 4. Structured data by page type

Extend and standardize structured data for the public site:

- Organization / WebSite on core brand routes
- CollectionPage for catalog and blog indexes where appropriate
- Article for blog posts
- FAQ or SoftwareApplication style schema only where it is materially accurate
- API and documentation schema signals where useful and supportable

Ensure structured data uses current product naming and avoids stale umbrella branding.

### 5. Machine-readable discovery layer

Strengthen the site surfaces purpose-built for agents and scrapers:

- keep `llms.txt` current, concise, and linked to the highest-value public routes
- ensure `sitemap.xml` includes every canonical public route that should be indexed
- verify RSS or equivalent blog feed availability if already supported, or add a simple feed if absent and low effort
- make `/v1` and `/v1/catalog` easy to discover from docs and public route linking
- ensure docs clearly describe Parchment API, Parchment Intelligence, Mallard Studio, and Parchment Console boundaries

### 6. Public docs and API crawlability

Improve `/docs`, `/api`, `/v1`, and related public references so they work well for both human readers and automated systems:

- strong static summaries near the top of each page
- explicit links between overview, auth, rate limits, schemas, and examples
- stable headings and anchor structure
- examples that are parseable and not hidden behind interactive widgets alone
- clear distinction between public API contracts and internal platform routes

### 7. Internal linking and entity reinforcement

Improve how public pages reinforce core entities and concepts:

- link homepage, catalog, analytics, API, docs, and blog together intentionally
- use consistent anchor text for Mallard Studio, Parchment API, Parchment Intelligence, and Parchment Console
- add “related reading” or “next step” links where public pages are dead ends
- ensure important commercial and informational pages are reachable within a short crawl depth

### 8. Crawl and scraper audit harness

Expand the existing public discoverability audit into a repeatable acceptance tool that checks:

- metadata presence and correctness
- canonical alignment
- sitemap membership
- llms.txt membership where expected
- one clear H1 per page
- presence of meaningful static summary copy
- JSON-LD presence where required
- robot/index directives
- major public pages rendering sufficient meaning without executing client-side interactions

## Acceptance criteria

1. Every intended public route has an explicit indexability and canonical decision.
2. All major public pages emit complete metadata and appropriate structured data in initial HTML.
3. Homepage, catalog, analytics, API, docs, and blog are understandable from raw HTML without login or client-side interaction.
4. `sitemap.xml` and `llms.txt` accurately reflect the canonical public surface.
5. Public docs clearly expose the stable Parchment API entry points and distinguish them from internal app routes.
6. Product naming across public discoverability surfaces consistently uses Mallard Studio, Parchment API, Parchment Intelligence, Parchment Console, and Green / Origin / Enterprise.
7. A scripted audit can flag regressions in metadata, crawlability, and machine-readable discoverability.

## Short audit checklist

- [ ] Public route inventory exists and marks index vs noindex correctly
- [ ] Every canonical public page has title, description, canonical, OG, and Twitter tags
- [ ] Key public pages include usable static summary copy in initial HTML
- [ ] JSON-LD is present and page-appropriate on homepage, blog posts, and major product/docs pages
- [ ] `sitemap.xml` includes all intended canonical public routes
- [ ] `llms.txt` points to the most valuable public pages and docs
- [ ] `/api`, `/docs`, `/v1`, and `/v1/catalog` are clearly linked and described
- [ ] No authenticated Mallard Studio or Parchment Console surfaces are accidentally exposed as indexable public content

## Notes for implementation

Favor incremental delivery in this order:

1. route inventory and policy
2. metadata/canonical cleanup
3. HTML-first copy improvements on key pages
4. structured data and machine-readable surface updates
5. audit automation and regression checks

This work should improve discoverability without changing the product boundary: public routes become easier to crawl and understand, while authenticated and account-specific surfaces remain private and clearly separated.
