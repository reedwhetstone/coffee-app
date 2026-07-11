# Purveyors Brand Identity

**Status:** Active brand direction (visual identity system adopted July 2026)
**Owner:** Reed Whetstone
**Last updated:** 2026-07-05

> **July 2026 rework:** the brand direction is now "the field journal of the green coffee market" — research-institution rigor presented with the warmth of a botanical field journal. The full rationale and rollout live in `notes/marketing-audits/2026-07-05-ui-brand-gtm-rework-proposal.md`. The sections below are the durable rules that came out of it.

## Purpose

This document is the working brand package for Purveyors. It keeps brand identity, product language, visual rules, and UI/UX principles in one practical reference.

Use it to:

- keep public, app, API, docs, CLI, and billing surfaces aligned
- decide whether a new component feels like Purveyors
- review copy, color, layout, and product naming before release
- track brand inconsistencies until they are resolved

`notes/PRODUCT_VISION.md` remains the product compass. This document governs expression: how that strategy should sound, look, and behave.

For component-level implementation recipes, use `notes/UI-FRAMEWORK.md` as the tactical companion to this file. `UI-FRAMEWORK.md` should follow this document and should not introduce independent brand direction.

## Brand Core

Purveyors is a coffee intelligence platform.

It turns fragmented supplier, roast, and business data into trustworthy decisions for roasters, coffee businesses, developers, and agents.

The brand should feel:

- **Trustworthy:** source-aware, precise, transparent about limits
- **Professional:** built for real procurement, roasting, and operations work
- **Accessible:** serious without sounding enterprise-bloated
- **Data-literate:** confident with evidence, trends, contracts, and workflows
- **Coffee-native:** fluent in sourcing, roasting, and green coffee reality

## Product Naming

Use these names consistently:

| Name                        | Use                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Purveyors                   | Parent company and platform brand                                                                                               |
| Parchment                   | API infrastructure layer inside Purveyors; use as the shared infrastructure name, not a public platform                         |
| Mallard Studio              | Authenticated roaster workspace for inventory, roast, profit, tasting, chat, and subscriptions                                  |
| Parchment API               | External API product and stable `/v1/*` public contract                                                                         |
| Parchment Intelligence      | Market intelligence product for analytics, price-index depth, supplier signals, arrivals, and delistings                        |
| Parchment Console           | Authenticated API key, usage, docs, and billing surface                                                                         |
| Green / Origin / Enterprise | Parchment API tier names                                                                                                        |
| Market Index                | Canonical short label for `/analytics` in nav, footers, cards, and CTAs; "Parchment Market Index" is the formal on-page H1 only |

Avoid these in current public-facing copy unless quoting historical material:

- Maillard Studio
- Parchment Platform
- Explorer / Roaster+ / Integrate
- PPI member when the intended surface is Parchment Intelligence
- Coffee App as a product or framework name

## Voice

The voice is direct, useful, and clear-eyed.

Prefer:

- "Stable green coffee data for sourcing tools, apps, and agents."
- "Browse stocked green coffees with origin, processing, tasting context, and live pricing."
- "Parchment Intelligence adds supplier comparison, supplier health, arrivals, delistings, and extended trend modules."

Avoid:

- vague AI language without a concrete workflow
- claims that flatten public API, internal app API, CLI, and analytics into one contract
- marketing copy that hides uncertainty or provenance
- generic productivity phrasing that could belong to any SaaS product

Copy should usually lead with the job, then the evidence:

- Job: source, compare, track, decide, benchmark, automate
- Evidence: 40+ suppliers, daily updates, public contract, rate-limit headers, row limits, provenance, process transparency

## Visual Identity

### Current Palette

These are the current brand-bearing Tailwind tokens and logo colors observed in the codebase.

| Token                        | Hex       | Current role                                      |
| ---------------------------- | --------- | ------------------------------------------------- |
| `background-primary-light`   | `#FCFAF8` | Main canvas                                       |
| `background-secondary-light` | `#FCFAF8` | Cards and secondary panels                        |
| `background-tertiary-light`  | `#F9A57B` | Primary accent, buttons, active states, logo mark |
| `background-primary-dark`    | `#292522` | Dark surface                                      |
| `border-light`               | `#E4E4E2` | Borders and rings                                 |
| `text-primary-light`         | `#302f2a` | Primary text                                      |
| `text-secondary-light`       | `#695c4d` | Secondary text                                    |
| `text-primary-dark`          | `#dfdaca` | Text on dark surfaces                             |
| `link-light`                 | `#a07d50` | Links, currently underused                        |
| `growth-green`               | `#7FB069` | Positive/data accent, currently underused         |
| `harvest-gold`               | `#D4A574` | Supporting warm accent                            |

### Color Principles

- Warm off-white, brown ink, and peach-orange are the core visual signature.
- Use orange for primary actions, active navigation, brand highlights, and selected states.
- Use neutral surfaces for dense app workflows; do not let decorative color compete with data.
- Data visualization uses the named chart palette in `src/lib/styles/chartColors.ts` (earth-tone series with teal/plum anchors for color-blind distinguishability; warm neutral axis/tooltip chrome). Charts must not use raw Tailwind hexes. Keep `chart-*` Tailwind tokens in sync with that module.
- Error, warning, success, and info colors should be semantic and consistent, not ad hoc page-by-page choices.
- Gold is not a core brand color. Retire `harvest-gold` from decorative product UI unless a future visual system gives it a specific role.

### Recommended Color Strategy

The current palette is directionally right. The main issue is that the Tailwind names describe old implementation buckets instead of durable roles. Keep the current colors, but migrate toward role-based aliases so components use the same color for the same job.

Recommended core roles:

| Role          | Tailwind direction          | Hex                    | Use                                                               |
| ------------- | --------------------------- | ---------------------- | ----------------------------------------------------------------- |
| Canvas        | `bg-surface-canvas`         | `#FCFAF8`              | Page background and quiet public sections                         |
| Panel         | `bg-surface-panel`          | `#F7F3ED` candidate    | Cards, tables, filter bars, sidebars; slightly warmer than canvas |
| Raised        | `bg-surface-raised`         | `#FFFFFF` or `#FCFAF8` | Tool panels that need contrast inside dense app views             |
| Ink           | `text-ink`                  | `#302f2a`              | Primary text                                                      |
| Muted         | `text-muted`                | `#695c4d`              | Secondary text, helper copy, metadata                             |
| Border        | `border-line`               | `#E4E4E2`              | Default borders, dividers, rings                                  |
| Accent        | `bg-accent` / `text-accent` | `#F9A57B`              | Primary CTAs, active state, key brand emphasis                    |
| Accent subtle | `bg-accent-subtle`          | `#F9A57B` at 5-15%     | Selected rows, active pills, non-blocking highlights              |
| Link          | `text-link`                 | `#a07d50`              | Inline text links where orange is too loud                        |
| Dark          | `bg-ink` / `text-on-dark`   | `#292522` / `#dfdaca`  | High-contrast footer, enterprise CTA, or dark editorial block     |

Recommended semantic roles:

| Role         | Tailwind direction | Suggested family                                  | Use                                                                    |
| ------------ | ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Success      | `success-*`        | Existing `growth-green` or Tailwind green/emerald | Positive status, completed actions, improving metrics                  |
| Warning      | `warning-*`        | Amber only                                        | Attention, proposed state, roast heat context, recoverable risk        |
| Danger       | `danger-*`         | Red                                               | Destructive actions, failures, expired/removed states                  |
| Info         | `info-*`           | Blue/cyan                                         | Neutral notices, API/info callouts, loading context                    |
| Intelligence | `intelligence-*`   | Purple/indigo, used sparingly                     | Premium/AI/intelligence feature gates if orange is already primary CTA |
| Data series  | `chart-*`          | Named chart palette                               | Chart series only; should not become general UI decoration             |

Migration recommendation:

1. Add new role aliases in `tailwind.config.ts` while keeping the existing token names as compatibility aliases.
2. Migrate shared components first: buttons, cards, form controls, headers, docs shell, analytics panels.
3. Replace ornamental `harvest-gold` usage with `accent-subtle` or neutral panel styling.
4. Keep amber only when the meaning is warning/proposed/roast context.
5. Move chart colors into named chart tokens before changing chart components.

## Typography

Adopted July 2026: a two-voice system.

| Voice     | Face                                                                                                        | Where                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Editorial | **Newsreader** (variable, self-hosted via `@fontsource-variable/newsreader`), `font-serif` / `font-display` | Public/marketing display headings, page-level H1/H2, blog and docs prose, insight-card titles, the daily market read |
| Working   | System sans stack (Tailwind default `font-sans`)                                                            | Everything operational: app panels, tables, forms, buttons, nav, chart labels, dense authenticated workflows         |

Rules:

- Serif headings run `font-medium` (500), not bold; pair with `tracking-tight` at display sizes. Newsreader at `font-bold` looks heavy and loses the scholarly voice.
- The serif marks _editorial moments_ — statements, reads, titles. If a string is data, a control, or a label, it stays sans. Dense app tools stay entirely sans.
- Blog/docs long-form body uses the brand-themed `prose` (serif body, ink/link colors, espresso code blocks) configured in `tailwind.config.ts`.
- Sentence case for buttons and nav labels.
- `font-semibold` for most sans UI headings; reserve `font-bold` for KPI values where weight aids scanning.

Avoid:

- oversized type inside app panels
- uppercase + wide-tracking micro-labels (retired July 2026); eyebrows are sentence case, `text-xs font-semibold`, in `text-accent` or `text-muted`
- negative letter spacing outside `tracking-tight` hero/page-title use
- serif inside tables, forms, or chart internals

## Organic Accent System

Adopted July 2026. The brand's illustration language (the torn-stripe, Clyfford Still-adjacent earth-tone artwork from the blog heroes) appears in product UI as **accents only — never backgrounds**. Backgrounds stay quiet (canvas/panel); the organic color does the identity work in small, deliberate doses. Without these accents the palette collapses into shades of brown; with them, sparingly placed, pages get visual identity without competing with data.

The system has four elements:

| Element         | Implementation                             | Use                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AccentSpine** | `src/lib/components/ui/AccentSpine.svelte` | Vertical tri-color (rust/gold/olive) spine on the left edge of **artifact cards** — cards that deliver an insight or invite an action: market briefs, insight cards, upsell/CTA cards, blog post headers, checkout confirmations. At most one spined card per view region. |
| **Ribbon**      | `OrganicBand` at `h-3`/`h-4` full-bleed    | Slim section divider at major editorial boundaries (hero close). Never taller than ~16px in product UI.                                                                                                                                                                    |
| **Band art**    | `OrganicBand` full size                    | Blog heroes, OG images, editorial/marketing moments only. Not a background for content.                                                                                                                                                                                    |
| **Grain**       | `.texture-grain` utility                   | Barely-there paper texture on public/editorial surfaces. Never on dense app views.                                                                                                                                                                                         |

Color tokens: `organic-rust` `#C05B2E`, `organic-gold` `#D9A05B`, `organic-olive` `#586048` (Tailwind `organic.*`). These intentionally overlap with chart-series hues but carry a different role: `chart-*` is data encoding, `organic-*` is brand decoration. Do not use `organic-*` for status/meaning and do not use `chart-*` decoratively.

Hard rules:

- Organic artwork is punctuation, not wallpaper. If removing the accent changes the layout, it was doing too much.
- No organic art behind text or data.
- The canonical spine triple is rust/gold/olive top-to-bottom; do not invent per-page variants.

## Iconography

Adopted July 2026: outline icons at Heroicons weight (`stroke-width="1.5"`, 24px viewBox), rendered in `text-ink` inside a soft tile: `rounded-md bg-accent-subtle/15 ring-1 ring-accent/25`. This tile treatment is the standard way to give sections and cards a visual anchor (see `PersonaRouter.svelte`, `Features.svelte`).

- Icons accompany section/card headers and empty states; they are not decoration inside table rows or dense controls.
- No emoji in product UI.
- Inline SVG paths are acceptable for now; if icon usage grows, consolidate on a shared icon component with the same stroke weight.

## Imagery Methodology

Three tiers, cheapest-first:

1. **Structural iconography** (tier 1): the outline-icon tiles above, applied consistently at section/card level. This is the default answer to "this page feels like a wall of words."
2. **Organic accents** (tier 2): the Organic Accent System above — spines, ribbons, grain — at section boundaries and on editorial artifacts.
3. **Real photography** (tier 3): green coffee, parchment, drying beds, roastery texture. Reserved for high-emotion surfaces (About, enterprise band, blog features). Requires curated assets; do not substitute generic stock.

## UI/UX Principles

### Core Experience

- Public surfaces prove value before asking for money.
- App surfaces optimize repeated work: scan, filter, compare, act.
- API and docs surfaces must make public contracts distinct from internal platform routes.
- Intelligence should reduce navigation where possible.
- Gated features should explain what unlocks, without making the free surface feel broken.

### Layout

- App tools should be dense, calm, and scannable.
- Cards are for repeated items, modals, panels, and framed tools.
- Marketing and docs pages may be more spacious, but should not drift into generic SaaS gloss.
- Mobile layouts should preserve the core workflow, not just stack desktop sections.
- The default shape language should be compact and confident. Current implementation favors `rounded-lg` and `rounded-md`, and those are the strongest fit for the operational product.

### Components

- Primary buttons: orange fill, dark ink text, medium weight, clear verb.
- Secondary buttons: neutral or orange outline, only when the action is truly secondary.
- Cards: neutral background, subtle border/ring, light shadow only when useful.
- Coffee cards: mobile-first sourcing essentials first, whole-card click into a user-initiated slide-out, icon-only supplier/match affordances, dot-accent tasting cues, and a vertical-bar description summary. Keep the collapsed card on the warm primary surface, not pure white.
- Purveyor Score: branded listing-intelligence score for metadata completeness, structure, confidence, and buyer usefulness. It is not cup quality, certification, supplier verification, or regulatory assurance.
- Forms: clear labels, compact controls, obvious save/cancel placement.
- Tables/charts: prioritize legibility, filter state, empty/error states, and direct comparison.
- Icons: use a consistent icon system once chosen; inline SVGs are currently inconsistent.

### Recommended Radius Strategy

Static audit counts in `src`: `rounded-lg` 265, `rounded-md` 205, `rounded-xl` 32, `rounded-2xl` 43, `rounded-3xl` 20, and `rounded-full` 144.

Recommendation:

| Radius         | Use                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `rounded-md`   | Buttons, inputs, selects, compact controls, menus                                                 |
| `rounded-lg`   | Default cards, tables, panels, dialogs, chart containers                                          |
| `rounded-xl`   | Mobile nav rows, app shell overlays, focused feature panels that need a little softness           |
| `rounded-2xl`  | Rare public/docs section containers or modals where extra editorial polish helps                  |
| `rounded-3xl`  | Avoid as a default; reserve for one-off hero/pricing presentation if retained after visual review |
| `rounded-full` | Pills, badges, avatars, toggles, icon-only circular controls                                      |

The product should standardize around `md` controls and `lg` panels. Larger radii can remain in marketing/docs only when they serve hierarchy, not as the default visual language.

## Brand Audit Log

These are findings from the initial static audit. Direction is needed before component corrections.

| ID     | Inconsistency                                                                                  | Evidence                                                                                                                                                 | Direction needed                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-001 | `Parchment Platform` appears in active public docs, but notes mark it historical.              | `src/lib/docs/content.ts` uses "Parchment Platform" as API overview summary/eyebrow; `notes/README.md` says it should generally stay archived.           | Resolved direction: use Parchment for API infrastructure and Parchment API for the external product; do not use Platform.                                                                                                |
| BR-002 | Internal design docs and comments still say `Coffee App`.                                      | `notes/UI-FRAMEWORK.md`; `src/lib/components/ui/Button.svelte`.                                                                                          | Rename/fold this into a Purveyors UI guide, or keep it as historical implementation guidance?                                                                                                                            |
| BR-003 | Color tokens are generic and include unresolved palette comments.                              | `tailwind.config.ts` comments mention alternate colors and "ian's color pallet"; primary and secondary backgrounds both resolve to `#FCFAF8`.            | Recommended direction: add role-based Tailwind aliases while preserving current compatibility tokens.                                                                                                                    |
| BR-004 | Orange is doing nearly every brand job.                                                        | Static scan found `background-tertiary-light` used 658 times.                                                                                            | Recommended direction: keep orange as primary brand accent, but move status/data/premium roles to named semantic tokens.                                                                                                 |
| BR-005 | Data/status colors are ad hoc.                                                                 | Many `blue`, `purple`, `indigo`, `emerald`, `green`, `red`, `amber`, and `gray` classes across charts, cards, chat, errors, and previews.                | **Resolved 2026-07-05:** semantic families and the named chart palette (`src/lib/styles/chartColors.ts`) are defined; analytics charts migrated. Remaining raw-palette utilities in app views migrate opportunistically. |
| BR-006 | Border radius language is split.                                                               | App framework favors `rounded-lg` cards and `rounded-md` buttons; docs/API/pricing use many `rounded-3xl`, `rounded-2xl`, and `rounded-xl` panels.       | Recommended direction: standardize on `rounded-md` controls and `rounded-lg` panels; keep larger radii rare and editorial.                                                                                               |
| BR-007 | Icon style is inconsistent.                                                                    | Many components hand-roll inline SVGs; no clear shared icon system is visible.                                                                           | **Direction set 2026-07-05:** Heroicons-weight outline icons in accent tiles (see Iconography section). Consolidate remaining ad hoc SVGs opportunistically.                                                             |
| BR-008 | Public navigation/product language is still transitional.                                      | Nav uses "For Buyers", "Market Data", "Pricing", "API", "Docs"; pages use "market analytics", "catalog", "Parchment Intelligence", and "Mallard Studio". | **Resolved 2026-07-05:** nav is Catalog / Market Index / Pricing / API / Docs / Blog; "Market Index" is the canonical short label for /analytics.                                                                        |
| BR-009 | Sign-in capitalization varies.                                                                 | `Sign In` and `Sign in` both appear in public/app surfaces.                                                                                              | Adopt sentence case (`Sign in`) or title case everywhere.                                                                                                                                                                |
| BR-010 | Deprecated tier names still appear in active notes/blog drafts.                                | Current notes outside archive mention Explorer / Roaster+ / Integrate.                                                                                   | Archive, annotate, or update drafts so future copy does not revive old names.                                                                                                                                            |
| BR-011 | Public marketing relies mostly on UI cards and inline SVGs, with limited real product imagery. | Homepage hero uses a synthetic product-card composition; static assets are mostly logos and OG images.                                                   | **Resolved 2026-07-05:** template hero mockup and gradient blob removed; Organic Accent System + Imagery Methodology adopted (see sections above). Tier-3 photography still needs asset production.                      |
| BR-012 | One clear UI bug appears brand-adjacent.                                                       | `src/routes/no-cookies/+page.svelte` sets white text on a light `background-secondary-light` surface.                                                    | Approve as a mechanical accessibility fix?                                                                                                                                                                               |
| BR-013 | Emoji appears in product empty states.                                                         | Analytics no-data state uses `📊`.                                                                                                                       | **Resolved 2026-07-05:** emoji removed from product UI (including the trend-range lock); rule codified in Iconography.                                                                                                   |
| BR-014 | Logo asset usage is not documented.                                                            | Logo mark uses `#F9A57B`; public header uses `/purveyors_logo_mark.svg`; favicon uses `/purveyors_orange.svg`.                                           | Define when to use mark, wordmark, orange mark, and black wordmark.                                                                                                                                                      |

## Initial Correction Queue

Initial correction pass started on 2026-05-06. Completed items:

- Replaced active `Parchment Platform` product copy with Parchment or internal app route language.
- Added role-based Tailwind color aliases while preserving current compatibility aliases.
- Removed live `harvest-gold` usage from product UI.
- Corrected the no-cookies and error surfaces to use brand text, surfaces, and accent buttons.
- Standardized visible sign-in capitalization to sentence case.
- Replaced several visible emoji/dashboard markers with compact text badges.
- Tightened docs/API large-radius usage where it was a low-risk alignment change.
- Fixed invalid `text-primary-light` class usage in active UI files.
- Added Purveyor Score as the branded trust primitive for catalog coffee cards and public score methodology.

Recommended next steps:

1. Define semantic color usage for all chart series and KPI values before migrating analytics/profit/roast charts.
2. Decide whether pricing and subscription product cards should keep `rounded-3xl` as an intentional editorial exception.
3. Choose an icon system and replace remaining ad hoc inline SVG and emoji usage intentionally.
4. Audit public pages visually after the language, score, and token decisions are made.
