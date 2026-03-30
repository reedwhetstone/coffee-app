# Implementation Plan: Public Discoverability Overhaul

**Date:** 2026-03-26
**Status:** Planning
**Repo:** coffee-app
**Scope:** Public pages, social link previews, crawler/search discoverability, LLM searchability, validation tooling

---

## Goal

Make every important public Purveyors URL behave like a polished, high-signal landing page when seen by:

- social link unfurlers (LinkedIn, Discord, Slack, X, iMessage)
- traditional search crawlers (Google, Bing, DuckDuckGo ecosystem)
- structured data consumers
- LLM crawlers and answer engines
- generic web scrapers and preview bots

This is not just a metadata cleanup. It is a **public discoverability system**.

The outcome should be:
- better link previews
- better search snippet quality
- better crawlability/indexing consistency
- better LLM retrieval / summarization quality
- a repeatable audit process so regressions are caught automatically

---

## Current State Audit

## What already exists

### 1. Shared meta injection in layout
`src/routes/+layout.svelte` already renders:
- title
- description
- canonical
- og:title / og:description / og:image / og:url / og:type / og:site_name
- twitter:title / twitter:description / twitter:image / twitter:card
- schema/JSON-LD injection

This is good. The system is centralized enough to build on.

### 2. Some public routes already provide good metadata
These routes already return `data.meta` from `+page.server.ts`:
- home
- catalog
- analytics
- api
- contact
- blog post pages (`/blog/[slug]`)

### 3. Crawl surfaces already exist
- `static/robots.txt`
- `src/routes/sitemap.xml/+server.ts`
- `src/routes/llms.txt/+server.ts`

So Purveyors already has the right structural pieces.

---

## Gaps / Problems

### A. Metadata coverage is inconsistent across public pages
Some routes are still using ad hoc `<svelte:head>` tags instead of the shared `data.meta` system.

Known weak spots:
- `src/routes/blog/+page.server.ts` returns no `meta`
- `src/routes/blog/tag/[tag]/+page.server.ts` returns no `meta`
- some public utility pages likely still lack robust OG/Twitter metadata

This creates drift and uneven preview behavior.

### B. Social preview images are not standardized
Current public pages often use:
- `/purveyors_orange.svg`
- blog `hero.webp`
- founder photo JPG in at least one route

Problems:
- SVG is not the most reliable social preview asset for LinkedIn and some scrapers
- WebP works in many places, but JPG/PNG is still safer for social unfurls
- image dimensions are not consistently declared
- preview images are not clearly designed as social cards

### C. Blog article metadata is only partially wired
`/blog/[slug]/+page.server.ts` includes fields like:
- `articlePublishedTime`
- `articleTags`

But the shared layout does not currently render these as `article:*` meta tags.

So the data exists but part of the preview/search value is being dropped.

### D. No audit harness exists for public discoverability
There is currently no script that checks, page by page:
- canonical correctness
- OG/Twitter tag presence
- image reachability
- JSON-LD presence
- heading/content quality
- llms/sitemap inclusion

This makes regressions easy.

### E. LLM/searchability is present but not intentional enough
`llms.txt` exists, but there is no full audit for:
- whether all key public pages are represented consistently
- whether page titles/descriptions are optimized for retrieval
- whether pages expose strong first-screen summary content for model-based consumption
- whether structured data aligns with visible content

---

## Product Position

Purveyors is not just a normal SaaS website. It is a public knowledge surface for:
- green coffee market intelligence
- coffee catalog discovery
- API product discovery
- blog thought leadership

That means discoverability should be treated as a first-class product system, not a meta-tag chore.

---

## Proposed Workstreams

## Workstream 1: Route inventory + public discoverability audit

### Objective
Create a complete inventory of public pages and score each one for preview/search/LLM readiness.

### Public route inventory (initial target set)
Core public routes:
- `/`
- `/catalog`
- `/analytics`
- `/api`
- `/contact`
- `/blog`
- `/blog/[slug]`
- `/blog/tag/[tag]`
- `/llms.txt`
- `/sitemap.xml`
- `/no-cookies`
- `/subscription`
- `/subscription/success` (likely lower priority/noindex candidate)
- `/auth` (likely lower priority/noindex candidate)

### Deliverable
Create a machine-readable audit output and a markdown report.

Suggested files:
- `scripts/audit-public-discoverability.ts`
- `notes/public-discoverability-audit.md`

### Audit dimensions
For each public page, verify:

#### Metadata
- title exists and is specific
- meta description exists and is specific
- canonical exists and is absolute
- OG tags exist
- Twitter tags exist
- image URL is absolute and fetchable
- `og:image:width`, `og:image:height`, `og:image:alt` present where relevant

#### Search / crawler
- route is included in sitemap when appropriate
- robots treatment is correct
- no accidental blocking of intended public pages
- page has one strong H1
- visible intro content is meaningful without JS interaction

#### Structured data
- JSON-LD exists where it should
- schema type matches page intent
- schema content aligns with visible page content

#### LLM discoverability
- page has a strong summary near top of content
- route is represented appropriately in `llms.txt`
- headings are semantically strong and non-generic
- page exposes durable nouns/keywords that make retrieval better

#### Preview readiness
- image asset type is safe for social bots
- preview image aspect ratio is social-card friendly
- title/description lengths are within practical preview bounds

---

## Workstream 2: Unified metadata builder

### Objective
Stop hand-rolling public metadata route by route.

### Recommendation
Create a shared helper, something like:
- `src/lib/seo/meta.ts`
- or `src/lib/services/metaService.ts`

### API shape
Example:

```ts
buildPublicMeta({
  baseUrl,
  path,
  title,
  description,
  type,
  image,
  imageAlt,
  keywords,
  article,
  schemaData,
  robots
})
```

### Benefits
- one consistent output shape for `data.meta`
- eliminates drift between public routes
- easier to add fields like `og:image:width` once
- easier to enforce standards

### Required output fields
Every public page should be able to emit:
- `title`
- `description`
- `canonical`
- `ogTitle`
- `ogDescription`
- `ogUrl`
- `ogType`
- `ogImage`
- `ogImageAlt`
- `ogImageWidth`
- `ogImageHeight`
- `ogSiteName`
- `twitterCard`
- `twitterTitle`
- `twitterDescription`
- `twitterImage`
- `twitterImageAlt`
- `schemaData`
- optional `articlePublishedTime`, `articleModifiedTime`, `articleTags`, `articleAuthor`

### Required layout follow-up
Update `src/routes/+layout.svelte` to actually render:
- `og:image:alt`
- `og:image:width`
- `og:image:height`
- `twitter:image:alt`
- article tags like:
  - `article:published_time`
  - `article:modified_time`
  - `article:author`
  - repeated `article:tag`

Right now some of this data exists on the blog post route but is not emitted into the final HTML.

---

## Workstream 3: Social preview image system

### Objective
Standardize share images for public pages so previews look intentional and reliable.

### Recommendation
Use dedicated **social card assets** rather than reusing arbitrary page/hero images.

### Format recommendation
Prefer:
- **1200x627 JPG or PNG** for social previews

Avoid depending on:
- SVG as primary social preview image
- WebP as the only share asset

### Proposed asset strategy

#### Generic page-level cards
Create dedicated social cards for:
- homepage
- catalog
- analytics
- api
- contact
- blog index

Suggested structure:
- `static/og/home.jpg`
- `static/og/catalog.jpg`
- `static/og/analytics.jpg`
- `static/og/api.jpg`
- `static/og/blog.jpg`
- `static/og/contact.jpg`

#### Blog posts
For each blog post, add a dedicated social image:
- `static/blog/images/<slug>/social.jpg`

Page hero can remain:
- `hero.webp`

But social preview should use:
- `social.jpg`

### Why separate hero from social preview
A good page hero is not always a good unfurl card.
Social cards should optimize for:
- readable title
- recognizable brand
- correct aspect ratio
- strong contrast in small previews

---

## Workstream 4: Public route metadata completion

### Objective
Bring all major public routes onto the same standard.

### Priority fixes

#### P0
- `/blog` — move to server-generated `meta` and add full OG/Twitter image set
- `/blog/tag/[tag]` — add complete metadata, not just `<title>`
- `/blog/[slug]` — switch social preview asset away from `hero.webp` to dedicated `social.jpg` (or safe fallback)
- `/` `/catalog` `/analytics` `/api` `/contact` — stop using SVG as primary OG image where possible

#### P1
- audit `/no-cookies`, `/subscription`, `/auth`, `/subscription/success`
- decide which should be indexed vs noindexed
- ensure non-marketing routes do not dilute crawl quality

### Public page standards
Every indexable public page should have:
- one H1
- strong description paragraph near top
- one canonical URL
- one social card image
- structured data appropriate to page type
- inclusion in sitemap where appropriate

---

## Workstream 5: Search + scraper + LLM content audit

### Objective
Audit page content, not just metadata.

### Why
LLM retrieval and search snippet quality depend on what the page *says*, not just the tags.

### Audit questions
For each page:
- Can a generic scraper fetch meaningful content without auth?
- Is the first visible paragraph actually descriptive?
- Does the page clearly state what Purveyors is / does / offers?
- Are domain terms present and explicit?
- Are there extractable nouns and entities a model can anchor to?
- Are page headings specific or generic?
- Does the page explain product intent before interactive UI?

### Recommendation
For public pages, add a short, scannable intro block that is both:
- good for humans
- good for bots/LLMs

Example for analytics:
- explicit mention of supplier count, data type, update cadence, and what the user can learn

Example for catalog:
- explicit mention of origins, processing, suppliers, pricing, and update cadence

Example for API:
- explicit mention of what data is exposed and who it is for

---

## Workstream 6: Validation and QA workflow

### Objective
Make discoverability testable and repeatable.

### Deliverables
1. **Local audit script**
   - fetch rendered HTML for all public routes
   - parse head tags and JSON-LD
   - validate required fields
   - verify image URLs return 200
   - emit scorecard

2. **Manual validation checklist**
   - LinkedIn Post Inspector
   - Slack/Discord test unfurl
   - page source verification
   - sitemap + robots verification
   - llms.txt verification

3. **Optional CI check**
   - fail if required public metadata is missing on key routes

### Suggested script outputs
Per page:
- title present
- description present
- canonical present
- OG complete/incomplete
- Twitter complete/incomplete
- JSON-LD present/absent
- image URL OK/fail
- llms/sitemap included or not
- crawl/index recommendation

---

## Implementation Order

## Phase 1 — Audit + foundation
1. Add `notes/public-discoverability-audit.md`
2. Build `scripts/audit-public-discoverability.ts`
3. Inventory all public routes
4. Score current state

## Phase 2 — Shared metadata system
5. Add unified public metadata builder
6. Update `+layout.svelte` to emit missing OG/Twitter/article image fields
7. Migrate blog index and tag pages to server-side `meta`

## Phase 3 — Social preview assets
8. Define social card image convention
9. Add page-level default social cards
10. Add blog post social image convention + fallback logic
11. Switch OG/Twitter tags to those assets

## Phase 4 — Search + LLM content improvements
12. Audit public intro copy for each key page
13. Tighten H1s, descriptions, and first-screen summaries
14. Update `llms.txt` if needed for consistency and coverage
15. Review sitemap inclusion/noindex decisions

## Phase 5 — Validation
16. Run audit script
17. Fix any remaining broken/unreachable assets or tag gaps
18. Manually validate on LinkedIn preview tooling and at least one other unfurl surface

---

## Concrete Initial Deliverables

### Files likely to be added
- `src/lib/seo/meta.ts` (or equivalent)
- `scripts/audit-public-discoverability.ts`
- `notes/public-discoverability-audit.md`
- `static/og/*.jpg`
- `static/blog/images/<slug>/social.jpg` convention docs and/or fallback support

### Files likely to be changed
- `src/routes/+layout.svelte`
- `src/routes/(home)/+page.server.ts`
- `src/routes/catalog/+page.server.ts`
- `src/routes/analytics/+page.server.ts`
- `src/routes/api/+page.server.ts`
- `src/routes/contact/+page.server.ts`
- `src/routes/blog/+page.server.ts`
- `src/routes/blog/+page.svelte` (if any inline head remains)
- `src/routes/blog/[slug]/+page.server.ts`
- `src/routes/blog/tag/[tag]/+page.server.ts`
- `src/routes/sitemap.xml/+server.ts`
- `src/routes/llms.txt/+server.ts`

---

## Acceptance Criteria

### Metadata / previews
- [ ] Every key public page emits full OG + Twitter metadata via the shared path
- [ ] Social preview images are absolute, reachable, and standardized
- [ ] Blog post pages emit article-specific metadata in final HTML
- [ ] Blog index and tag pages have complete metadata, not just title/canonical

### SEO / crawling
- [ ] Public route inventory is complete and documented
- [ ] Sitemap includes intended public pages and excludes junk routes
- [ ] Robots treatment is intentional
- [ ] Index/noindex posture is explicit for borderline pages

### LLM discoverability
- [ ] `llms.txt` is aligned with key public routes and product positioning
- [ ] Key public pages have strong, descriptive first-screen summaries
- [ ] Public pages expose content that generic scrapers and LLMs can meaningfully parse

### Tooling / validation
- [ ] Audit script runs locally and produces a clear scorecard
- [ ] At least one LinkedIn-style preview validation has been checked against final metadata/image output
- [ ] `pnpm check` passes
- [ ] `pnpm lint --max-warnings 0` passes

---

## Recommended Immediate Scope

If we want to address this **right now** with the highest leverage, the first implementation PR should include:

1. shared metadata builder
2. layout support for missing OG/article fields
3. blog index + blog tag metadata completion
4. public-page audit script + report
5. switch key public pages from SVG/WebP-first OG usage to dedicated social preview assets or a safe fallback path

That gets both:
- immediate LinkedIn/social preview improvement
- a durable audit system for the rest

---

## Opinionated Recommendation

The biggest mistake would be treating this as “just add more meta tags.”

The right move is:
- build a **public discoverability layer**
- make previews intentional
- make crawler/LLM surfaces testable
- stop relying on route-by-route hand wiring

That will compound across blog, analytics, API, catalog, and every future public page.
