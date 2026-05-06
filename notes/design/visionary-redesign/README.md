# Visionary redesign image study

This folder captures a concept pass for a future Purveyors marketing site and public catalog experience.
The artifacts are intentionally design images, not production Svelte implementation.

## Inputs reviewed

- `src/routes/(home)/+page.svelte` and `src/lib/components/marketing/Hero.svelte` establish the current homepage flow: hero, public catalog preview, feature/pricing/CTA sections, and analytics/catalog calls to action.
- `src/routes/catalog/+page.svelte` establishes the public catalog flow: heading, shareable filter link, anonymous origin/process/name filters, member process facets, catalog cards, and the anonymous 15-item conversion gate.
- `src/routes/catalog/+page.server.ts` establishes the catalog positioning and metadata around 1,200+ coffees, importer coverage, live inventory, structured process transparency, and public-first access.

## Live-site snapshot notes

Live page content was reviewed on May 6, 2026 from the indexed `www.purveyors.io` pages. Local browser screenshots were blocked by the execution environment: Playwright had no browser installed, the browser download returned HTTP 403, and shell HTTP requests to `purveyors.io` were blocked by the proxy. The text snapshot still confirmed the active live experience:

- Homepage hero: "Source greens with the whole market in view," with 41+ US specialty importers, daily scraping, pricing movement, arrivals, delistings, and origin benchmarks.
- Homepage live preview: an Ethiopia Yirgacheffe market card and a daily market brief, followed by a current offer-list section and public catalog sample cards.
- Catalog page: "Green Coffee Catalog," shareable filtered links, public origin/process/name filters, member-gated structured process filters, rich coffee cards with process analysis, supplier links, location, pricing, and a 15-of-1064 anonymous conversion gate.

## Generated images

- `generated/home-visionary-redesign.svg` — a cinematic landing-page concept that frames Purveyors as a market-intelligence cockpit while preserving the current analytics/catalog/API product ladder.
- `generated/catalog-visionary-redesign.svg` — a catalog-page concept that elevates filtering, structured process transparency, price tiers, and supplier confidence into a denser sourcing workspace.

## GPT Image 2 concept batch

A five-image `gpt-image-2` batch is staged in `gpt-image-2-concepts.jsonl` for the requested raster concept pass:

1. Homepage market-intelligence cockpit
2. Catalog sourcing workspace
3. Coffee-lot detail drawer
4. Mobile catalog concept
5. API console intelligence surface

Run it from the repo root with an `OPENAI_API_KEY` available:

```bash
export IMAGE_GEN="${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/image_gen.py"
mkdir -p notes/design/visionary-redesign/generated/gpt-image-2
python "$IMAGE_GEN" generate-batch \
  --input notes/design/visionary-redesign/gpt-image-2-concepts.jsonl \
  --out-dir notes/design/visionary-redesign/generated/gpt-image-2 \
  --concurrency 5
```

The May 6, 2026 agent environment could stage and dry-run the batch, but it could not complete live `gpt-image-2` generation because `OPENAI_API_KEY` was not present.

## Design direction

- Move from neutral SaaS cards to a premium intelligence-console atmosphere: parchment/espresso base, luminous amber and cyan signals, editorial type scale, and spatial market visualizations.
- Keep the current public promise intact: 41+ importers, daily updates, public catalog browsing, analytics, structured process intelligence, and API access.
- Make the catalog feel less like a list and more like an actionable sourcing desk: persistent market pulse, saved-share URL affordance, filter chips, confidence badges, similar-lot actions, and a price ladder preview.
- Preserve the product boundary: analytics is a product surface, `/v1/catalog` is the external API contract, and deeper process facets remain member-tier value.
