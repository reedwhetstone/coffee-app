# Public Discoverability Audit

Date: 2026-03-26
Status: MVP baseline implemented in `feat/public-discoverability-overhaul`

## Goal

Make the main public Purveyors routes consistently legible to:

- social unfurlers like Discord, Slack, LinkedIn, and X
- traditional search crawlers
- LLM crawlers and answer engines
- generic scrapers that only parse initial HTML

This pass focuses on the first high-leverage layer: shared metadata, blog coverage, image conventions, and an audit harness.

## Routes Covered in This PR

Primary public pages normalized through `src/lib/seo/meta.ts`:

- `/`
- `/catalog`
- `/analytics`
- `/api`
- `/contact`
- `/blog`
- `/blog/[slug]`
- `/blog/tag/[tag]`

## Metadata Standard

Every indexable public page should emit:

- absolute `<title>`
- `meta name="description"`
- absolute canonical URL
- `og:title`
- `og:description`
- `og:image`
- `og:image:alt`
- `og:image:width`
- `og:image:height`
- `og:url`
- `og:type`
- `twitter:card`
- `twitter:title`
- `twitter:description`
- `twitter:image`
- `twitter:image:alt`
- JSON-LD when the page has a meaningful schema shape

Article pages should also emit:

- `article:published_time`
- `article:modified_time`
- `article:author`
- repeated `article:tag`

## Image Convention

### Generic public pages

Generic public pages now go through a shared resolver with this convention:

1. use a route-specific social asset when present, for example `/og/catalog.jpg`
2. otherwise fall back to `/og/default.jpg`

Current MVP default:

- `/og/default.jpg`

This keeps the code path standardized now, while still allowing dedicated per-page cards to be added later without more route logic.

### Blog posts

Blog posts now resolve preview images with this order:

1. `/blog/images/<slug>/social.jpg`
2. `/blog/images/<slug>/social.png`
3. `/blog/images/<slug>/hero.webp`
4. `/blog/images/<slug>/hero.jpg`
5. `/blog/images/<slug>/hero.png`
6. `/og/default.jpg`

That gives posts a clean upgrade path to dedicated social cards without blocking this PR on asset creation.

## Audit Script

Script:

- `scripts/audit-public-discoverability.ts`

Package command:

- `pnpm audit:discoverability`

### Suggested usage against a local preview build

In one terminal:

```bash
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

In another terminal:

```bash
pnpm audit:discoverability http://127.0.0.1:4173
```

### What the script checks

For key public routes, the script verifies:

- title present
- description present
- canonical present and absolute
- Open Graph core tags present
- `og:image:alt`, `og:image:width`, `og:image:height` present
- Twitter core tags present
- `twitter:image:alt` present
- JSON-LD present
- exactly one H1 present
- `og:image` fetches successfully
- route appears in `sitemap.xml` where expected
- route appears in `llms.txt` where expected
- article pages emit article-specific metadata

## Manual Validation Checklist

Use this after deploy or when touching public metadata again:

- [ ] run `pnpm audit:discoverability` against a local preview or deployed URL
- [ ] verify `/blog` and one `/blog/[slug]` page source contains full OG and Twitter image tags
- [ ] verify one blog post emits `article:*` tags in rendered HTML
- [ ] test at least one shared link in Discord or Slack
- [ ] test at least one page in LinkedIn Post Inspector
- [ ] confirm `sitemap.xml` still includes key public pages and blog posts
- [ ] confirm `llms.txt` still references key product surfaces

## MVP Decisions In This PR

These were intentional scope choices:

- Dedicated social card artwork was not designed in this PR.
- A shared resolver was added first so asset rollout can happen incrementally.
- Blog `article:modified_time` currently falls back to the publish date when no separate updated date exists in frontmatter.
- The audit script is intentionally lightweight and regex-based so it adds no new dependencies.

## Follow-Up Work

Good next steps after this PR:

1. add real route-specific social cards under `static/og/`
2. add per-post `social.jpg` files for the highest-value blog posts
3. introduce explicit blog post `updated` frontmatter where needed
4. decide whether lower-value utility/auth routes should be `noindex`
5. consider running the discoverability audit in CI for key routes
