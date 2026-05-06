# Purveyors Brand Identity

**Status:** Initial audit draft, pending brand direction
**Owner:** Reed Whetstone
**Last updated:** 2026-05-06

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

| Name                        | Use                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Purveyors                   | Parent company and platform brand                                                                        |
| Parchment                   | API infrastructure layer inside Purveyors; use as the shared infrastructure name, not a public platform  |
| Mallard Studio              | Authenticated roaster workspace for inventory, roast, profit, tasting, chat, and subscriptions           |
| Parchment API               | External API product and stable `/v1/*` public contract                                                  |
| Parchment Intelligence      | Market intelligence product for analytics, price-index depth, supplier signals, arrivals, and delistings |
| Parchment Console           | Authenticated API key, usage, docs, and billing surface                                                  |
| Green / Origin / Enterprise | Parchment API tier names                                                                                 |

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
- Data visualization can use broader semantic colors, but those colors need a named palette before more chart work ships.
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

The product currently uses Tailwind's default font stack with compact, practical sizing.

Keep type:

- clear over ornamental
- sentence case for buttons and nav labels
- strong but not shouty: `font-semibold` for most UI, `font-bold` for page titles and hero statements
- readable in dense tables, cards, charts, filters, and forms

Avoid:

- oversized type inside app panels
- excessive uppercase labels
- negative letter spacing outside established `tracking-tight` hero/page-title use

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

| ID     | Inconsistency                                                                                  | Evidence                                                                                                                                                 | Direction needed                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| BR-001 | `Parchment Platform` appears in active public docs, but notes mark it historical.              | `src/lib/docs/content.ts` uses "Parchment Platform" as API overview summary/eyebrow; `notes/README.md` says it should generally stay archived.           | Resolved direction: use Parchment for API infrastructure and Parchment API for the external product; do not use Platform.  |
| BR-002 | Internal design docs and comments still say `Coffee App`.                                      | `notes/UI-FRAMEWORK.md`; `src/lib/components/ui/Button.svelte`.                                                                                          | Rename/fold this into a Purveyors UI guide, or keep it as historical implementation guidance?                              |
| BR-003 | Color tokens are generic and include unresolved palette comments.                              | `tailwind.config.ts` comments mention alternate colors and "ian's color pallet"; primary and secondary backgrounds both resolve to `#FCFAF8`.            | Recommended direction: add role-based Tailwind aliases while preserving current compatibility tokens.                      |
| BR-004 | Orange is doing nearly every brand job.                                                        | Static scan found `background-tertiary-light` used 658 times.                                                                                            | Recommended direction: keep orange as primary brand accent, but move status/data/premium roles to named semantic tokens.   |
| BR-005 | Data/status colors are ad hoc.                                                                 | Many `blue`, `purple`, `indigo`, `emerald`, `green`, `red`, `amber`, and `gray` classes across charts, cards, chat, errors, and previews.                | Recommended direction: define success/warning/danger/info/intelligence/chart token families before migrating components.   |
| BR-006 | Border radius language is split.                                                               | App framework favors `rounded-lg` cards and `rounded-md` buttons; docs/API/pricing use many `rounded-3xl`, `rounded-2xl`, and `rounded-xl` panels.       | Recommended direction: standardize on `rounded-md` controls and `rounded-lg` panels; keep larger radii rare and editorial. |
| BR-007 | Icon style is inconsistent.                                                                    | Many components hand-roll inline SVGs; no clear shared icon system is visible.                                                                           | Choose an icon library/system or document inline SVG rules.                                                                |
| BR-008 | Public navigation/product language is still transitional.                                      | Nav uses "For Buyers", "Market Data", "Pricing", "API", "Docs"; pages use "market analytics", "catalog", "Parchment Intelligence", and "Mallard Studio". | Confirm preferred public IA labels and whether "Market Data" or "Analytics" is the canonical user-facing term.             |
| BR-009 | Sign-in capitalization varies.                                                                 | `Sign In` and `Sign in` both appear in public/app surfaces.                                                                                              | Adopt sentence case (`Sign in`) or title case everywhere.                                                                  |
| BR-010 | Deprecated tier names still appear in active notes/blog drafts.                                | Current notes outside archive mention Explorer / Roaster+ / Integrate.                                                                                   | Archive, annotate, or update drafts so future copy does not revive old names.                                              |
| BR-011 | Public marketing relies mostly on UI cards and inline SVGs, with limited real product imagery. | Homepage hero uses a synthetic product-card composition; static assets are mostly logos and OG images.                                                   | Decide whether product screenshots, generated brand imagery, or catalog visuals should become part of the identity.        |
| BR-012 | One clear UI bug appears brand-adjacent.                                                       | `src/routes/no-cookies/+page.svelte` sets white text on a light `background-secondary-light` surface.                                                    | Approve as a mechanical accessibility fix?                                                                                 |
| BR-013 | Emoji appears in product empty states.                                                         | Analytics no-data state uses `📊`.                                                                                                                       | Decide whether emoji belongs in Purveyors UI, or replace with the chosen icon system.                                      |
| BR-014 | Logo asset usage is not documented.                                                            | Logo mark uses `#F9A57B`; public header uses `/purveyors_logo_mark.svg`; favicon uses `/purveyors_orange.svg`.                                           | Define when to use mark, wordmark, orange mark, and black wordmark.                                                        |

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
