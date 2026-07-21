# Notes Index

This directory contains a mix of canonical product material, active planning, audits, and historical context.

## Read these first

If the goal is to understand the current product direction, implementation contract, or naming system, start here:

1. `DEVLOG.md`
   - Canonical, ordered, cross-product Purveyors backlog and intake rules
2. `PRODUCT_VISION.md`
   - Canonical product direction and strategy test
3. `BRAND.md`
   - Working brand identity, product language, visual rules, UI/UX principles, and inconsistency log
4. `UI-FRAMEWORK.md`
   - Tactical Svelte/Tailwind component implementation companion for applying `BRAND.md`
5. `decisions/`
   - Accepted ADRs for real shipped behavior
6. `API_notes/APITIER.md`
   - Current Parchment API tier model
7. `API_notes/API-strategy.md`
   - Current API strategy, with older speculative ideas trimmed back
8. `marketing-audits/`
   - Recent product-language and funnel audits
9. `implementation-plans/`
   - Active or recent execution plans

## Current directories

- `DEVLOG.md`
  - The only ordered cross-product backlog. Detailed plans and repo-local checklists support it but do not compete with it for priority.
- `API_notes/`
  - Current API product notes and implementation references
- `BRAND.md`
  - Brand identity, product language, visual rules, UI/UX principles, and audit log
- `UI-FRAMEWORK.md`
  - Tactical component and Tailwind pattern guide for applying `BRAND.md`
- `decisions/`
  - ADRs and accepted architecture/product decisions
- `implementation-plans/`
  - Working execution plans for current or recent initiatives
- `marketing-audits/`
  - Funnel, positioning, and copy audits
- `pr-audits/`
  - Historical PR-specific audits and reruns
- `blog/`
  - Blog strategy, source map, and outlines
- `archive/`
  - Historical material that should not be treated as current source of truth

## Archive policy

Anything in `notes/archive/` is historical reference unless explicitly revived.

Use archive material for:

- implementation archaeology
- understanding abandoned ideas
- recovering prior rationale
- tracing naming/model evolution

Do not use archive material as the source of truth for current product naming, pricing, or architecture.

## Known current naming system

Use these names consistently in current docs and product copy:

- `Mallard Studio`
- `Parchment API`
- `Parchment Intelligence`
- `Parchment Console`
- API tiers: `Green / Origin / Enterprise`

## Historical naming that should generally stay archived

These appear in older material and should not be reused in current public-facing docs unless quoted historically:

- `Maillard Studio`
- `Parchment Platform` as a public umbrella brand
- `Explorer / Roaster+ / Integrate`
- older generic `PPI member` framing when the intended surface is `Parchment Intelligence`
