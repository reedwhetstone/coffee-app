# UI, Brand, and Go-to-Market Rework Proposal

**Date:** July 5, 2026
**Status:** Proposal for review
**Scope:** Public marketing surfaces, visual identity, navigation/IA, marketing language, and the persona funnel
**Companions:** `notes/BRAND.md` (identity), `notes/PRODUCT_VISION.md` (strategy), `notes/marketing-audits/2026-04-13-funnel-brand-taste-audit.md` (prior funnel audit), ADR-003/ADR-005 (access-level contracts)

---

## 1. Diagnosis: why the product feels generic

The April 2026 funnel audit scored the marketing surfaces 7.8/10 and concluded the _architecture_ is right: public proof first, four-product family, honest CTAs. That still holds. The problem is not structure — it is that **the brand exists on paper and in the blog, but not in the product's pixels or its sentences.**

Three root causes, in order of impact:

### 1.1 There is no visual identity beyond one accent color

- **No typography.** `tailwind.config.ts` defines no `fontFamily` at all. Every page — hero, blog, docs, dashboards — renders in the default system sans stack. There is no serif, no display face, no editorial voice in type anywhere. This is the single largest driver of the "tail-end CSS template" feel. Anthropic's identity is roughly half typography (a warm serif against a clean grotesque); Purveyors currently has zero.
- **The homepage is literally a Tailwind UI template.** `Hero.svelte:147–153` contains the verbatim Tailwind UI gradient-blob `clip-path` polygon — one of the most recognizable stock-template tells on the internet. The hero "product screenshot" (`Hero.svelte:106–144`) is a fake mockup built from nested divs, flagged since May as BR-011 and never replaced.
- **The warm palette exists but doesn't render.** `background-primary-light` and `background-secondary-light` are both `#FCFAF8`, so the hero and auth-page "gradients" (`Hero.svelte:36`) are mathematically flat. The good role tokens (`surface-panel #F7F3ED`, `accent`, `ink`, semantic families) are defined but the shipped components still use legacy aliases; ~399 raw default-Tailwind color utilities (`blue-500`, `emerald-*`, `gray-*`) leak across 60 files.
- **Charts are the most off-brand surface in the product.** The `chart-*` brand tokens are used exactly zero times. `OriginLineChart.svelte:41–50` hardcodes a 10-color rainbow of stock Tailwind hexes; even the "orange" in charts is amber-500 (`#f59e0b`, 9 occurrences), not brand peach (`#f9a57b`, 2 occurrences). For a company whose product _is_ analytics, the analytics look like everyone else's default dashboard.
- **No texture, no imagery system.** `static/` holds four logo files, a founder photo, and OG images. The only real brand imagery in the product — the 14 blog hero illustrations (warm earth tones, organic torn-paper geometry, matte grain) — is _exactly_ the Anthropic-adjacent organic-scholarly aesthetic we say we want, and it is quarantined to the blog.

> Note on `UI ref.webp` (repo root): this reference image is a generic pink-accent SaaS dashboard ("Lumion"). It contradicts the stated brand direction and should not be the north star. The blog hero illustrations are the true reference; treat `UI ref.webp` as layout inspiration only (sidebar density, chart-first overview), not visual identity.

### 1.2 Internal engineering language leaks into buyer-facing copy

The April audit's one "must-fix" — remove product-ops phrasing from public surfaces — was only partially done. Live today:

| Copy (verbatim)                                                                                                          | Location                                            |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| "Supply evidence layer" / "row-level supply substrate"                                                                   | `catalog/sections/PageHeaderSection.svelte:38–48`   |
| "Need workflow leverage from this supply layer?"                                                                         | `catalog/sections/UpsellBannerSection.svelte:8`     |
| "Watchlists and saved shortlists are still future workflows, so this catalog only routes to evidence that exists today." | `UpsellBannerSection.svelte:11–15`                  |
| "…until they create real investigation leverage instead of another click target."                                        | `analytics/sections/ActionRailSection.svelte:31–32` |
| "A master lens: every module on this page follows the selected scope."                                                   | `analytics/sections/MarketReadSection.svelte:86–88` |
| "Return to subscription control plane"                                                                                   | `subscription/success/+page.svelte:199, 227`        |
| "We'll reconcile entitlements as soon as Stripe marks the checkout complete."                                            | `subscription/success/+page.svelte:220–221`         |

A hobbyist who just paid $9 for Mallard Studio is greeted by a button that says "Return to subscription control plane." This is migration scaffolding speaking to customers.

### 1.3 The funnel doesn't speak to its five personas

The go-to-market docs identify five entry personas — hobbyist home roaster, SMB roaster, market analyst, enterprise integrator, developer — but no public surface routes by persona:

- **"For Buyers" → `/catalog`** (`appNavigation.ts:24`) is the confusing tab you flagged. It's a persona label doing a product label's job: it names an audience but hides the destination. Everyone is a "buyer"; nobody knows it's the catalog.
- **`/analytics` has five different names** across surfaces: "Parchment Market Index" (header), "Market Analytics" (footer), "Market Index" (app nav), "Market intelligence" (API page card), "Analytics" (docs). Five labels for one page destroys recall.
- **Three competing primary CTAs above the fold**: header pushes "See plans" → `/subscription` while hero and CTA band push "Explore market analytics" → `/analytics`. A first-time visitor gets two different "main" actions before scrolling.
- **Small inconsistencies that erode trust**: "40+ importers" (homepage) vs "39+ US importers" (SEO/analytics meta); Pricing intro says "Three distinct products" while rendering four cards (`Pricing.svelte:44–47`); Contact page H1 says "Contact Purveyors" while its SEO title says "About Purveyors"; nav section id `maillard` vs label "Mallard Studio" (`appNavigation.ts:17, 97–98`).

---

## 2. Brand direction: "the field journal of the green coffee market"

A unifying concept to make design decisions non-arbitrary. Purveyors should feel like **a research institution for coffee**: the rigor of a market-intelligence terminal presented with the warmth of a botanical field journal. Organic materials, scholarly type, evidence-first analytics. That is the Anthropic mix — human-crafted warmth wrapped around serious technical work — translated into coffee.

Design tests for any new surface:

1. Could this screenshot be mistaken for a generic SaaS template? → fail.
2. Does it look like it was designed by someone who has handled green coffee? → pass.
3. Does the data still read as precise and trustworthy (no decoration competing with evidence)? → pass.

### 2.1 Typography (highest-leverage single change)

Adopt a two-face system, self-hosted (open licenses, no CDN dependency):

| Role                                                                                     | Direction                                            | Candidates                                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Display/editorial serif — heroes, H1/H2 on public pages, blog/docs headings, pull quotes | Warm, bookish, slightly sharp; the "scholarly" voice | **Newsreader**, Source Serif 4, Fraunces (soft-serif, more personality) |
| UI sans — app panels, tables, forms, buttons, chart labels                               | Clean humanist grotesque, excellent at small sizes   | **Inter**, IBM Plex Sans, or keep system stack for app-only surfaces    |
| (Optional) Mono — API/docs code, data provenance chips                                   |                                                      | IBM Plex Mono, JetBrains Mono                                           |

Rules:

- Serif appears on **public/editorial surfaces and page-level headings only**. Dense app tools stay sans — this preserves BRAND.md's "dense, calm, scannable" principle while giving marketing pages an identity.
- Theme the `@tailwindcss/typography` prose plugin (currently unthemed) so blog/docs body runs in the serif with brand ink/link colors — instant editorial upgrade for 14 existing blog posts.
- Retire the uppercase + `tracking-wide` micro-label pattern (93 `uppercase` occurrences) in favor of small-caps-free sentence-case eyebrows in the serif or muted sans. BRAND.md already warns against this; enforce it.

### 2.2 Extend the blog illustration language to the whole brand

The blog heroes (torn-paper organic geometry, palette of rust/olive/sage/cream/espresso on matte grain) are the identity. Systematize them:

- **Homepage hero**: replace the fake CSS mockup + Tailwind blob with (a) a real product screenshot in a simple warm frame, set against (b) a band of the blog-style organic illustration. Screenshot proves the product (BR-011); illustration carries the brand.
- **Section motifs**: derive a small set of reusable SVG motifs from coffee's material world — drying-bed rows, topographic contour lines of growing altitude, parchment texture, the existing tasting-note dots. Use them as section dividers, empty states, and card accents at low opacity. This is the "organic element" the UI currently has zero of.
- **Texture**: a barely-there paper-grain noise on `surface-canvas` for public pages (CSS/SVG filter, ~2–3% opacity). This is the cheapest way to stop surfaces reading as flat template white.
- **Dark editorial blocks**: the espresso-brown `#292522` + `#dfdaca` combination (already in the footer/CTA) is good — fix the live dark-on-dark contrast bug first (`Footer.svelte:7–11, 37, 75` uses dark ink on the dark surface) and then use these blocks deliberately for enterprise/API CTAs.

### 2.3 Color: finish the migration that BRAND.md already designed

No new palette needed — enforce the existing one:

1. Make `surface-panel` (`#F7F3ED`) actually differ from canvas in shipped components; fix the two dead gradients (`Hero.svelte:36`, `auth/+page.svelte:48`).
2. Migrate the ~399 raw default-palette utilities to role/semantic tokens, starting with public pages, then shared components, then app views. Blue-as-info (`text-blue-500` ×19 etc.) → `info` token.
3. **Define and apply the chart palette** — this is a brand decision, not just cleanup. Proposal: derive the series palette from the blog illustration colors (rust `#C05B2E`-family, olive/sage greens, peach accent, espresso, harvest neutrals) rather than the current rainbow, validated for contrast and color-blind distinguishability. Wire the existing dead `chart-*` tokens to it and migrate the D3 components (`OriginLineChart`, `ProcessDonutChart`, `PriceTierChart`, `OriginBarChart`, tooltips' gray inline styles).
4. Align the one shared `Button.svelte` with UI-FRAMEWORK.md (`bg-accent text-ink`, not `bg-background-tertiary-light text-white`), then make marketing pages actually use it instead of inlining button classes.

### 2.4 Component and system hygiene

- Build the missing primitives: `Card`, `Badge`, `Eyebrow`, `SectionHeading`, `StatTile`, `Input`. Radius/color drift exists because every card is hand-rolled.
- Adopt one icon system (recommendation: Lucide — Heroicons-compatible outline weight, larger set) and replace ad hoc inline SVGs (BR-007).
- Dark mode: currently `darkMode: 'media'` with almost no `dark:` variants and a hardcoded light body (`app.html:17`) — users on OS dark mode get a broken half-theme. Near-term: switch to `class` strategy pinned light so dark-OS users get an intentional experience. Long-term: a true warm-dark theme is a natural fit for the brand, but it's a Phase-5 luxury.

---

## 3. Information architecture and navigation

### 3.1 Public nav: name the products, not the audiences

Current → proposed (`appNavigation.ts:22–59`):

| Current                               | Proposed         | Rationale                                                                                                                               |
| ------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| For Buyers → `/catalog`               | **Catalog**      | Say what it is. The persona pitch belongs on the homepage, not the tab.                                                                 |
| Parchment Market Index → `/analytics` | **Market Index** | One canonical short name everywhere (header, footer, app nav, API page, docs). "Parchment Market Index" stays as the formal on-page H1. |
| Pricing → `/subscription`             | **Pricing**      | Keep.                                                                                                                                   |
| API → `/api`                          | **API**          | Keep (signed-in "Console" swap is fine).                                                                                                |
| Docs, Blog                            | Keep             |                                                                                                                                         |

Also standardize the footer ("Market Analytics" → "Market Index") and the API-page card ("Market intelligence" → "Market Index").

### 3.2 One primary CTA per anonymous view

Pick a single top-of-funnel action: **"Explore the Market Index"** (analytics-first, matching PRODUCT*VISION's public-proof principle). Header primary becomes "Explore Market Index" (or simply demote header to "Sign in" only); "See plans" moves to secondary. Hero: primary "Explore the Market Index", secondary "Browse the catalog". Every anonymous page ends in the same ladder: \_see the proof → see the plans → start*.

### 3.3 Homepage: add the persona router

Between the hero and the features grid, a "Who uses Purveyors" band — five short cards, buyer-native language, each routing to its funnel:

| Persona                 | Card headline (draft)                                                 | Routes to                                 |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| Home roaster / hobbyist | "Buy better greens. Browse every importer at once."                   | `/catalog` (+ Mallard Studio mention, $9) |
| Roastery / SMB          | "Run sourcing like the big roasters — without their software budget." | `/analytics` → Intelligence               |
| Market analyst          | "The only daily price index for US green coffee."                     | `/analytics` → Intelligence               |
| Platform / enterprise   | "Put live green coffee data inside your roasting software."           | `/api` → Enterprise contact               |
| Developer               | "A stable public API for coffee data. Free tier, real docs."          | `/api` → Console                          |

This one section resolves the "visitors can't tell which product is for them" problem without adding five landing pages. (Dedicated persona landing pages can come later for paid acquisition.)

### 3.4 Split Contact from About

`/contact` currently carries the founder story with an "About" SEO title and a "Contact" H1. Either rename the page About (with contact info inside) or split into `/about` + `/contact`. The founder/open-source story is a genuine trust asset for this brand — give it a real home and link it from the footer as "About".

---

## 4. Marketing language rework

### 4.1 Principles (extends BRAND.md Voice)

1. **Job first, evidence second, mechanism last.** "Catch new arrivals the day they stock" (good, exists) beats "arrivals and delistings feed" (mechanism).
2. **No org-chart nouns in public copy.** Banned words on buyer-facing surfaces: _surface, layer, substrate, entitlement, control plane, reconcile, module, workflow leverage, evidence layer, master lens, scope_ (as a noun). Add a CI grep for these against `src/routes/(home|catalog|analytics|subscription|api|contact)` and `src/lib/components/marketing`.
3. **Never advertise what doesn't exist.** Delete "watchlists and saved shortlists are still future workflows…" — roadmap honesty belongs in the blog, not an upsell banner.
4. **One number.** Pick the canonical supplier count (recommend "40+ US importers"), define it in one shared constant, and use it in copy, SEO meta, and stat tiles alike (today: 39+ vs 40+ drift).

### 4.2 Per-page copy direction

**Homepage** — hero headline "Source green coffee with the whole market in view." is genuinely good; keep it. Fix: one primary CTA (§3.2), add persona router (§3.3), correct "Three distinct products" → four (or fold Enterprise into a separate band, which reads better anyway).

**Catalog** (worst offender) — replace the hero block:

- Eyebrow: ~~"Supply evidence layer"~~ → "Green coffee catalog"
- H1 stays "Green Coffee Catalog"
- Sub: ~~"Inspect the row-level supply substrate behind Parchment Market Index reads…"~~ → _"Every stocked green coffee from 40+ US importers — origin, process, score, and live pricing, normalized daily and searchable in one place."_
- Upsell banner: ~~"Need workflow leverage from this supply layer?"~~ → _"Ready to source smarter? Parchment Intelligence compares suppliers and tracks the market for you. Mallard Studio connects it to your own inventory and roasts."_

**Analytics / Market Index** — strong structure; sharpen the premium pitch from access-framing to outcome-framing (April audit's carry-over): the Intelligence overlay bullets are good, but lead with _"Know what to buy before the offer list email lands"_-class outcomes. Remove the "master lens" and "click target" copy.

**Subscription** — post-checkout success page rewrite: "Return to subscription control plane" → _"Back to your account"_; "We'll reconcile entitlements…" → _"Your access is activating — this usually takes a few seconds."_ The moment after payment is the highest-trust-sensitivity moment in the product; it currently speaks Kubernetes.

**API** — already the strongest page. Add trust proof near the top: uptime/freshness stats, a real curl + JSON response snippet in brand-styled code block (mono font from §2.1), and an explicit "free forever evaluation tier" statement to serve the developer-community goal.

**Contact/About** — resolve the split (§3.4); keep and elevate the founder + open-source story.

---

## 5. Phased plan

Ordered so every phase ships independently and the cheap trust-fixes land first.

**Phase 1 — Stop the bleeding (copy + bugs; ~1 day, no design decisions needed)**

1. Rename nav "For Buyers" → "Catalog"; unify "Market Index" label across header/footer/app-nav/API card/docs.
2. Purge the internal-language list in §1.2 and §4.2 (catalog hero/upsell, analytics rail/lens, subscription success page).
3. Fix footer dark-on-dark contrast (`Footer.svelte`), the two dead gradients, "Three distinct products" vs four cards, 39+/40+ count via shared constant, Contact-vs-About title mismatch.
4. Single primary CTA rule on anonymous surfaces.

**Phase 2 — Type and token identity (~2–3 days)**

1. Self-host serif + sans (§2.1); wire `fontFamily` in Tailwind; apply serif to public headings and themed `prose` for blog/docs.
2. Align `Button.svelte` with the framework doc; create `Card`/`Eyebrow`/`SectionHeading`/`StatTile` primitives.
3. Migrate public pages + marketing components off legacy/raw color utilities onto role tokens; make `surface-panel` real.
4. Retire uppercase/tracking-wide micro-labels on public pages.

**Phase 3 — Homepage and brand imagery (~3–5 days, needs asset production)**

1. Kill the Tailwind blob; replace the fake hero mockup with a real product screenshot + organic illustration band in the blog style.
2. Persona router section (§3.3).
3. Paper-grain texture on public canvas; SVG motif set (drying-bed / contour / tasting-dot) for section dividers and empty states.
4. Enterprise band redesign on the dark espresso surface.

**Phase 4 — Charts and the app (~3–4 days)**

1. Define the brand chart palette (blog-derived earth tones, accessibility-validated); wire the dead `chart-*` tokens.
2. Migrate the D3 components and tooltips; brand-styled axis/label/tooltip treatment.
3. Sweep remaining raw-palette utilities in app views; adopt the icon system.

**Phase 5 — Funnel depth (ongoing)**

1. Outcome-led Intelligence positioning pass on `/analytics` and `/subscription`.
2. API page trust proof + developer-community framing (free tier front and center).
3. Persona landing pages for paid acquisition, if/when needed.
4. Intentional dark theme (warm-dark), only after tokens are fully adopted.

---

## 6. Decisions needed from Reed

1. **Serif choice** — Fraunces (more personality, riskier), Newsreader (editorial, safe), or Source Serif 4 (neutral scholarly). Recommendation: Newsreader for headings, with Fraunces as the adventurous alternative.
2. **Canonical short name for `/analytics`** — "Market Index" (recommended) vs "Analytics".
3. **Primary anonymous CTA** — "Explore the Market Index" (recommended, matches proof-first vision) vs "Browse the catalog".
4. **Illustration production** — extend the existing blog-hero generation pipeline into homepage/section assets, or commission/hand-make a small motif set?
5. **Contact vs About split** — one renamed page or two pages?
6. **Supplier count constant** — 40+ or 39+? (Whichever is defensible; define once.)
