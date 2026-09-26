# Fieldnotes 004 visual handoff repair

## Outcome

Edition 004 now includes a custom generated hero and card derivative, and compact numbered citations with one Sources footer. All reviewed authored text is unchanged. The shared reader renders Sources separately from takes; existing issues that contain that section also gain the footer. No issue is merged or emailed by this change.

## Confirmed cause

The September 11 production test generated no edition artwork. The content PR contained only its SVX file. The existing reader concealed the missing asset behind its branded fallback, and the preview checked neither loaded image bytes nor a custom-generation record.

This contradicted coffee-scraper's [editorial-quality image contract](https://github.com/reedwhetstone/coffee-scraper/blob/main/notes/implementation-plans/2026-09-06-market-brief-editorial-quality.md) and coffee-app's [complete-post rule](../BLOG_STRATEGY.md). The production test's earlier visual success statement was incomplete; this was an omitted stage, not a provider-generation failure.

## Image generation and comparison

Used the built-in `image_gen.imagegen` tool, not a fallback renderer or SVG substitute. Inspected and supplied both actual reference files:

- [Edition 002](../../static/blog/images/market-brief-002/hero.webp), main palette and matte grain.
- [When more context makes AI worse](../../static/blog/images/when-more-context-makes-ai-worse/hero.webp), angular fragmentation and open space.

The new composition opens a broad cream passage through irregular rust, teal, olive and charcoal planes. It preserves the series' texture and abstraction without copying either reference composition. No text, logos or literal coffee/robot imagery. Full image and 640px derivative visually inspected. ffmpeg only resized/encoded the generated PNG.

Delivered assets:

- [hero.webp](../../static/blog/images/market-brief-004/hero.webp), 1024px wide, 32,350 bytes.
- [hero-card.webp](../../static/blog/images/market-brief-004/hero-card.webp), 640px wide, 14,976 bytes.

Both are genuine WebP and pass the repository asset-size check. Original generation response, exact request, reference copies, content hashes and visual comparison remain in the operator's durable local artifact folder, `artifacts/fieldnotes-image-repair-2026-09-12/`.

### Exact generation prompt

```text
Use case: stylized-concept. Create a new landscape 3:2 editorial hero artwork for Purveyors Fieldnotes edition 004, titled Making room for automation. Both input images are STYLE REFERENCES ONLY, not edit targets. Match the established abstract angular torn-paper painting language, matte tactile grain, bold flat areas, irregular jagged contours, restrained palette of warm cream, burnt rust orange, deep forest teal, charcoal-black with muted olive. Use the first reference as the main palette/texture reference and the second as a reference for angular fragmentation becoming open space. Make a genuinely new composition: large irregular planes separate to open a continuous spacious cream passage across an otherwise crowded field; a small cluster of fragments remains near one constriction. It should feel like space being freed between coordinated parts, loosely resonating with usable human/agent workflows and automation freeing capacity. Pure abstraction, not a literal diagram or landscape illustration. Visually strong at thumbnail size, asymmetrical balanced composition with breathing room. No words, letters, numerals, logos, coffee beans or cups, robots, gears, circuits, diagrams, gradients, glossy 3D effects, or marketing iconography. Output a finished high-quality raster artwork with the image filling the full frame.
```

## Citation presentation

The deterministic generator produces clickable `[1]` labels instead of repeating source titles after every paragraph, with first-use numbering and canonical-URL deduplication. The full source title and publisher appear once in Sources. Numeric links go directly to their source, so they work when copied or emailed without relying on page-local anchors.

The reader previously discarded Sources. This repair gives it a distinct section kind and a small, unboxed footer after coffee highlights. It is not numbered as another take and does not get sharing controls. All existing unsafe-markup and link-protocol validation still applies.

The corrected manuscript was regenerated through the real reviewed CLI using the September 11 final proposal, evidence, deliberation, enrichment and review bundle. Eight authored text fields remain byte-for-byte present. Only deterministic citations and bibliography changed. No new factual or taste approval is claimed.

## Validation

- 35 focused reader/component/email tests pass, including footer rendering and cross-format bibliography preservation.
- TypeScript and full lint pass.
- Node 22 build and packaged newsletter verification pass.
- Desktop 1440px and mobile 390px: no overflow or browser errors; Copy Markdown and downloadable Markdown match the actual shared projection; email HTML preserves the same content.
- Browser checks loaded each exact new image hash (desktop hero, mobile card), not just an HTTP-success article or a visible fallback.
- All seven compact citation links and three unique Sources entries are present. Screenshots visually inspected.

The app correction intentionally includes reader code as well as content and artwork on the existing PR, because the requested Sources footer required shared reader support. This is a manual existing-PR correction, not a widening of the normal new-edition publication path.

Hosted interaction was previously blocked by Vercel sign-in. This pass proves the corrected local browser rendering; it does not claim authenticated hosted-preview verification or email inbox delivery. Nothing published or sent.
