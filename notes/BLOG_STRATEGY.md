# Purveyors Blog Proposal

**Status:** Active (10 posts live)
**Created:** 2026-02-19
**Updated:** 2026-03-20

---

## What This Is

A public blog at `purveyors.io/blog` that serves as Reed's thinking-out-loud space. It sits at the intersection of coffee intelligence, AI-first product development, supply chain technology, and the meta-process of building all of it. It's a business blog in the sense that purveyors IS the business, but it's really a builder's blog. The person, the process, and the product are the same thing.

## Why Now

- Purveyors is entering its GenUI phase. The architectural decisions happening now are genuinely interesting and underrepresented in technical writing.
- The coffee scraper has become a real CI/feedback loop system. That story has never been told publicly.
- The "build in public" window is optimal when the work is ambitious but the outcome is uncertain. Authenticity comes from writing while you're in it, not after.
- SEO. A technically deep blog on purveyors.io drives organic traffic to the domain. Coffee data insights attract the roaster audience; technical posts attract the developer/API audience. Both feed the funnel.
- There's a credibility gap to close. Purveyors needs to demonstrate technical depth to attract B2B API customers and establish authority in the specialty coffee data space.

## What Worked in "Beyond the Coffee Belt" (Mar 2026)

1. **Counterintuitive thesis with stakes**
   - Not "rare origins are cool"; instead: monoculture efficiency vs resilience risk + specialty customer value.
2. **Cross-industry analogy that clarifies structure**
   - Bananas/TR4 gave a concrete mental model for correlated biological risk.
3. **Risk map + opportunity map in one piece**
   - The post did not stop at diagnosis. It translated into portfolio strategy and product implications.
4. **Data-forward, product-relevant framing**
   - Connected external research to fields purveyors should track (species/lineage/isolation/microclimate).
5. **Tight pipeline execution**
   - Raw idea → expanded outline → draft with citations → hero image → draft PR → publish PR.

## What Worked in "Who Profits When Coffee Data Stays Scarce?" (Mar 11)

1. **Iterative feedback loop** — cron draft → Reed feedback → rewrite → fact-check → title refinement → publish. Each round materially improved the post.
2. **Grounding metaphors in published research** — "tribal economy" became Geertz's bazaar economy (1978), Levitt & Syverson's information rents (2008), NAR antitrust settlement (2024). Elevated from opinion to analysis.
3. **Question-format title** — "Who Profits When Coffee Data Stays Scarce?" outperforms "The 13x Information Gap" because it signals economic structure and creates curiosity gap.
4. **Cross-industry parallels** — real estate (MLS/agent information rents) and healthcare (price/quality opacity) made the coffee-specific argument universally legible.
5. **Reed's voice additions** — "man yells at cloud" LinkedIn touch, healthcare parallel suggestion, tribal economy framing. The best posts are collaborative.

### What to fix next time
- First draft was too verbose (2,400 words with repeated sections). Self-edit pass needed before showing Reed.
- Hero image missing from draft PR. Must be in the same PR, always.
- One complete PR per post. Never merge post without hero.

## Weekly Wednesday Coffee Intelligence System

### Objective
Ship one high-signal Coffee Intelligence piece every Wednesday that can be published same day after review.

### Weekly cadence
- **Tuesday:** choose thesis + collect evidence stack
- **Wednesday morning:** write draft (`draft: false`), generate hero image, open single complete PR
- **Wednesday afternoon:** Reed reviews and merges to publish

### Required structure per piece
1. Counterintuitive thesis
2. Immediate vs tail risk map
3. Opportunity map (actionable plays)
4. Product implication for purveyors (what we should build/measure)
5. 3-4 canonical tags

### Operating rule
Wednesdays are reserved for Coffee Intelligence output first; other blog experiments happen around this anchor.

## Content Pillars

### 1. Building an AI-First Product (GenUI + Purveyors)
- The canvas architecture: why we're building a conversation-driven workspace, not a chatbot with a sidebar
- Progressive disclosure through AI: replacing navigation with intelligence
- Lessons from implementing tool-calling, action cards, and the propose/confirm pattern
- Real benchmarks: latency, token costs, model selection decisions
- What "AI-first" actually means when you strip away the hype

### 2. The Coffee Data Pipeline (Scraper + Marketplace)
- Architecture of the multi-supplier scraper: Playwright, generic adapters, the Source class pattern
- The CI feedback loop: scrape → normalize → rank → surface → user feedback → improve
- Data normalization challenges across suppliers (grading systems, origin naming, processing methods)
- How we detect and handle supplier schema changes automatically
- Building a data moat through aggregation and enrichment

### 3. Green Coffee Market Intelligence
- Market analysis from the scraped data: pricing trends, availability patterns, seasonal shifts
- Origin deep dives: what's happening in Ethiopia, Colombia, Kenya, etc.
- Supplier analysis: who carries what, pricing strategies, stock turnover
- Processing method trends: naturals vs washed vs experimental
- This is the unique-content pillar. Nobody else has this dataset publishing publicly.

### 4. API-First Platform Architecture (B2CC)
- **The B2CC thesis applied to purveyors:** agents are customers now. The API docs are the primary UI for a growing segment of users. [[b2cc-agents-as-customers]]
- Designing the purveyors API: data modeling for coffee, roasting, and inventory
- The dual-audience problem: B2B walled gardens for enterprise + open marketplace for hobbyists, but also human consumers vs agent consumers of the same data
- Authentication tiers and API key management for different customer segments
- Building an API that AI agents can use (structured data, semantic search endpoints)
- "Test with agents first" as a real QA methodology: if an agent can't integrate your endpoint from docs alone, the docs aren't good enough
- Why normalized, proprietary data is the real moat when switching costs collapse to near zero
- The death of per-seat pricing and what usage-based billing looks like for coffee data

### 5. The Agentic Stack (OpenClaw + Second Brain)
- How we manage a production codebase with an AI agent: PRs, code review, testing
- Second brain as operating system: zettelkasten meets agentic workflows
- Memory architecture: how an AI assistant maintains continuity across sessions
- Cron jobs, heartbeats, and the operational loop of a 24/7 AI collaborator
- Honest assessment: where this works well and where it breaks down

### 6. Supply Chain + Coffee Industry
- Bridging the gap between traditional industry and technology
- The green coffee supply chain explained for non-specialists
- Why the specialty coffee market needs better data infrastructure
- Comparison with other commodity markets and what coffee can learn

## Insights You're Missing

### The "working with AI" meta-narrative is the hook
The most shareable content won't be the coffee data or the architecture docs. It's the honest account of what it's like to build a product where your co-developer is an AI agent. The friction, the surprises, the moments where it genuinely feels like pair programming vs the moments where you're babysitting a confident idiot. This is the story that gets linked on Hacker News.

### Content as a forcing function for clarity
Writing a blog post about your architecture forces you to articulate decisions that are currently implicit. The GenUI transition plan is a 33KB internal doc. Distilling that into a 2,000-word public post will surface the assumptions you haven't questioned yet. The blog doesn't just describe the work; it improves it.

### The coffee data is genuinely unique content
Nobody else is publishing aggregated, normalized green coffee market data. A weekly or bi-weekly "market pulse" post with actual data visualizations from the scraper would be the highest-value SEO content. Roasters searching for sourcing insights land on purveyors.io and discover the platform.

### Build-in-public as business development
For the B2B API play, technical blog posts are the best sales tool. A VP of Engineering at a coffee tech company reading a post about your data normalization pipeline understands the value proposition immediately. Better than any sales deck.

### The recursive loop you described is the real innovation
You nailed it: the blog isn't just output, it's a processing layer. Ideas go in, get refined through the act of writing, and come out as clearer direction for the product. The flywheel: building generates ideas, ideas become posts, posts clarify direction, direction improves the building.

### Documentation-as-content
API docs, getting-started guides, and READMEs are traditionally treated as support material. But well-written docs ARE content. Stripe built half their developer brand on documentation quality. Your API docs can live at `/blog` alongside insights posts, making the blog the single entry point for everything public-facing about purveyors.

### Fair use and the LLM content pipeline
One of the more interesting technical/legal topics to write about: how the scraper handles supplier marketing copy. The pipeline takes raw marketing language, runs it through an LLM to strip supplier-specific phrasing and generate original descriptions, addressing fair use concerns while preserving the factual coffee data. This is a real problem anyone aggregating supplier data faces, and the approach is worth documenting publicly.

## Architecture

### Hosting: Built into purveyors.io

MDsveX is already configured in the SvelteKit app. `.svx` files work as routes. This means:

```
src/routes/blog/
├── +page.svelte              # Blog index / listing
├── +layout.svelte            # Blog layout (header, sidebar, footer)
├── [slug]/
│   └── +page.svx             # Individual posts as markdown
├── feed.xml/
│   └── +server.ts            # RSS feed
└── tags/
    └── [tag]/
        └── +page.svelte      # Tag filtering
```

Each post is a `.svx` file with frontmatter:

```markdown
---
title: "The Architecture of a Coffee Data Pipeline"
date: 2026-02-25
tags: [scraper, architecture, data]
pillar: coffee-data-pipeline
description: "How we built a multi-supplier scraper that normalizes green coffee data from 26 sources."
draft: false
---

Post content here with full Svelte component support...
```

Benefits:
- Posts can embed live Svelte components (interactive charts from the scraper data, D3 visualizations)
- No external platform dependency
- Full control over design and SEO
- Same deployment pipeline as the app (Vercel)
- Posts are version-controlled in the repo (same PR workflow)

### Second Brain Integration (No Duplication)

The brain holds ideas and references. The blog repo holds published content. They connect through links, not copies.

```
brain/
├── ideas/                     # Raw ideas, observations, half-baked thoughts
│   ├── genui-canvas-lessons.md    # Idea note → might become a blog post
│   └── coffee-price-seasonality.md
├── references/
│   └── blog-posts/            # NEW: index of published posts (metadata + links only)
│       └── index.md           # Links to published posts by pillar, date, tag
└── projects/
    └── purveyors-blog.md      # THIS FILE: the blog project itself

repos/coffee-app/
└── src/routes/blog/
    └── posts/                 # The actual published content lives HERE
        ├── 001-building-coffee-data-pipeline.svx
        └── 002-what-genui-actually-means.svx
```

**Flow:**
1. Idea captured in `brain/ideas/` or `brain/fleeting/`
2. When ready to develop → draft in `repos/coffee-app/src/routes/blog/` (with `draft: true`)
3. Review, edit, iterate (same PR workflow as code)
4. Publish (set `draft: false`, merge PR)
5. Add metadata entry to `brain/references/blog-posts/index.md` with back-links to related brain notes
6. Brain ideas that informed the post get updated with `[[published: post-slug]]` links

This means the brain is the idea graph and the blog is the publishing surface. No content duplication. Wiki-links connect them.

### Content Workflow

Same as code: branch → write → PR → review → merge → deploy.

We already work this way. A blog post is just another type of PR. I can draft posts, you review and edit for voice, we merge and it's live.

### Voice

First person singular. "I" not "we." You are the author. The AI collaboration is part of the story, but the perspective is yours. Technical depth with personal voice. No corporate veneer. Match the writing style from SOUL.md: opinionated, concise when needed, thorough when it matters, no em-dashes, no buzzwords.

## Content Calendar (Launch)

### Month 1: Foundation (3 posts)

**Post 1: "What is Purveyors?"**
The origin story + vision. Why the specialty coffee market needs a data-first platform. Where it's going. This is the "about" post that every other post links back to.

**Post 2: "Building a Coffee Data Pipeline from Scratch"**
The scraper architecture. 11 suppliers, data normalization, the CI feedback loop. Technical enough to be credible, accessible enough for coffee people to follow.

**Post 3: "Why I'm Building an AI-First Coffee Platform"**
The GenUI thesis. What "AI-first" means beyond the buzzword. The canvas architecture. Why conversation is a better interface than navigation for domain-specific tools.

### Month 2: Depth (3-4 posts)

- Green coffee market pulse (first data-driven market analysis post)
- "Your API Docs Are Your New Landing Page: Building for Agent Customers" (the B2CC thesis applied to purveyors, referencing Caleb John's framework [[b2cc-agents-as-customers]])
- "Scraper Feedback Loops: When Your CI Pipeline Generates Its Own Improvements"
- API docs: Getting Started with the Purveyors API

### Ongoing: Cadence

- 2 posts/month minimum
- 1 market pulse per month (data-driven, unique content)
- 1 technical deep dive per month
- Ad hoc: insights, opinions, interesting problems as they arise

## Success Metrics

- Organic search traffic to purveyors.io (baseline → growth)
- Blog → signup conversion (add UTM tracking)
- Hacker News / dev community engagement on technical posts
- API signups attributed to blog content
- Personal brand signal: inbound from posts (coffee industry contacts, tech community)

## What I Need From You

1. **Approve this direction** and I'll set up the blog route infrastructure in the coffee-app repo
2. **Voice calibration**: I'll draft the first post, you mark up what sounds like you and what doesn't. We'll dial in the voice before publishing.
3. **Decide on the market pulse data**: what scraped data are you comfortable publishing publicly? Aggregated trends are safe. Individual supplier pricing might be sensitive.
4. **OpenAI API key in the dev env**: if we want interactive chart components in blog posts (we do)

## Decisions

- **Comments:** Yes, via Giscus (GitHub discussions). Comments are public engagement, NOT second brain inputs. The second brain remains exclusively Reed's private space.
- **Newsletter:** No. If the blog builds traction, may pivot to Substack or similar later.
- **Domain:** purveyors.io/blog (keep it on the main domain for SEO value)
- **Scraper data:** Yes, publish aggregated market data (pricing trends, availability patterns, origin analysis). No raw supplier copy, no security-sensitive implementation details. The LLM content pipeline for fair use handling is itself a topic worth writing about.

## Open Questions

- Custom blog design or keep it minimal for launch?
