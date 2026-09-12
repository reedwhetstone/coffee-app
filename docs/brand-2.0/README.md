# Purveyors Brand 2.0 Design Exploration

This package explores the next generation of the Purveyors brand and product experience. It is a design direction, not an implementation specification.

## Throughline

**Keep the existing “field journal of the green coffee market” foundation, then make Purveyors' intelligence visibly proprietary.**

The proposed internal north star is **the living ledger of the green coffee market**. It treats source records, freshness, confidence, lot identity, and movement as recognizable interaction primitives rather than supporting metadata.

The most important recommendation is product-level, not decorative: prototype a persistent evidence drawer in Market Index and a non-blocking comparison tray in Catalog before expanding the visual rollout.

## Deliverables

- `Purveyors-Brand-2.0-Exploration.pdf` — 20-page presentation package
- `brand-2.0-exploration.html` — editable 16:9 slide source
- `assets/current/` — live September 12, 2026 baseline captures
- `assets/concepts/` — AI-generated homepage, Market Index, Catalog, Cherry mobile, and hero-art concepts
- `PROMPTS.md` — the exact prompt set and generation method

## Current sources audited

- `notes/PRODUCT_VISION.md`
- `notes/BRAND.md`
- `notes/UI-FRAMEWORK.md`
- `notes/marketing-audits/2026-07-05-ui-brand-gtm-rework-proposal.md`
- `tailwind.config.ts`
- `src/lib/styles/chartColors.ts`
- current homepage, catalog, and Market Index implementations and live renders
- `UI ref.webp` as the older dashboard reference

## Directional caveats

- Generated UI screens are composition and interaction explorations. Their copy, metrics, photography, and field availability are not production claims.
- Source-linked photography should remain optional until rights, coverage, and provenance are reliable.
- The “living ledger” phrase is recommended as an internal design north star. Public positioning should be validated against current product strategy before use.
- Existing naming, data authority, Cherry anti-anthropomorphism, and Parchment/Mallard ownership rules remain in force.

## Regenerating the PDF

From this directory:

```bash
google-chrome --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=Purveyors-Brand-2.0-Exploration.pdf \
  "file://$PWD/brand-2.0-exploration.html"
```
