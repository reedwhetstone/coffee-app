# Edition 003 editorial source check

Checked September 6, 2026. This corrects the existing edition PR, not the captured market packet or published edition 002. The original generated article hash is historical provenance only; the edited article has different bytes.

## Scope and evidence

- Preserve the original September 6 market snapshot: +0.2% aggregate retail, 835 listings, 31 suppliers; 549 matched listings flat; separate all-market summary of 178 signals (167 below benchmark, 10 supplier-score outliers, one price drop). These were not refreshed. The endpoints are live, not immutable receipts. Comparing the previous edition's 593 listings / 24 suppliers with this broader universe cannot establish improving value.
- [Royal product 39070-2](https://royalcoffee.com/product/3427097000057688260/): live page states $6.65/lb, 132.45-lb bags, Vancouver, spot Seaforth, independent processor/exporter EDN. Explicitly says cooperative unions have little to no presence in this part of Guji. It describes cold-water fermentation for 24 hours, followed by 3–4 weeks of raised-bed drying. Supplier flavor descriptors retained as attribution, not independent tasting. No harvest year or landed-US price inferred.
- [Yellow Rooster Juan Puerta / Spumm](https://yellowroostercoffee.com/coffees/juan-puerta-spumm): live page states Castillo, honey/co-ferment, $10.90/lb, 89.52-lb bags, Tampa, and sample/full-sack requests. Lists rose, hibiscus, star fruit, nectarine. Ingredients, sample terms, freight, and retail quantities not established.
- [Ecuador report](https://dailycoffeenews.com/2026/09/03/ecuadors-deforestation-free-coffee-model-moves-beyond-the-pilot-stage/): full article read; originally Mongabay, republished by DCN, so not two independent sources. Reports 373 producers, mapped boundaries, forest-cover checks, independent verification, and cumulative 172.5 tonnes in 2022–2025. Avoids repeating regulatory deadlines as legal guidance or extrapolating the project to all Ecuadorian coffee.
- [7 Brew auction](https://dailycoffeenews.com/2026/09/02/7-brew-wins-143-million-auction-for-former-salad-and-go-locations/): full article read; approximately $143.2 million, 73 leases (41 AZ, 20 TX, six NV, six OK), pending court approval. Not completed purchases or open locations. No opening date or demand inference.
- [Coffee People Zine](https://dailycoffeenews.com/2026/09/04/coffee-people-zine-back-in-print-plans-minneapolis-party/): full article read; Issue 26, more than 150 pages / 80 contributors; Sept. 20, 6:30–9:30 p.m., FRGMNT inside Open Book, Minneapolis. Presented as a publication/event, not a market thesis.

## Editorial choices and limits

Removed the forced weekly theme and four news links that added no useful supported buyer conclusion. The retained news reporting still comes through DCN; additional configured sources belong to the separate generator improvement, not a fabricated retroactive source-diversity claim. Direct supplier pages provide primary commercial evidence, not independent validation of quality or social benefit.

The reader correction removes the duplicate Buying shortlist and reduces the flat-price Market read to one sentence. Numbers and signal composition do the quantitative work. Genuine takes keep actionable specifics and material qualifications without repeated non-claims.

Original catalog-enriched structured tasting profiles are restored from the pre-correction edition (`df4351cc`) as rewritten marketing copy. These are not supplier measurements or evidence for producer, process, or cooperative claims. Verified factual corrections remain. Coffee cards own flavor profiles, concise sample interest, sack size, warehouse, and price basis. Card anchors support references without duplicate product prose. At desktop widths cards keep full-width copy rather than squeezing it alongside the radar.

The old edition had no custom hero asset and showed the generic fallback. The new `static/blog/images/market-brief-003/hero.webp` uses the built-in imagegen tool with edition 002 and the co-fermentation article heroes as visual references. Prompt: “Wide 3:2 editorial hero; flat angular cut-paper / midcentury screenprint, subtle paper grain, rust, cream, charcoal, muted teal and ochre; abstract terraced origin landscape, parcel boundaries and a thin thread linking fields to a geometric destination; no text, logos, cups, UI or rounded blobs.” Generated PNG is converted to WebP without compositional edits. This is artwork, not an evidentiary map.

Merge publishes the web edition; this correction neither creates nor sends an email. Generated packet/draft recovery state was not mutated. Review the current PR head, not the original article hash, before publication.

## Validation

- `pnpm check --fail-on-warnings`: passed with repo-local placeholder static env (including `OPENROUTER_API_KEY`); zero errors/warnings. No credential copying.
- `pnpm lint`: blocked by formatting failures in 17 untouched Markdown files; ESLint stage did not run in that combined command.
- `pnpm test src/lib/server/marketBriefEmail.test.ts src/lib/server/marketBriefDeployment.test.ts src/lib/components/blog/MarketBriefArticle.svelte.test.ts`: 34 passed, including every published edition through email projection.
- Actual local route inspected in headless installed Chrome: reader copy read independently at 1280px; 390px mobile document width equals viewport (no horizontal overflow). Single-line market read, unduplicated coffee cards, restored tasting profiles, custom hero, corrected sourcing and pending auction status are visible. Local development rendering is not Vercel production verification.
- No full E2E or production build was needed for this editorial/caption correction. Node 24.19.0 differs from the repo's declared Node 22; checks above passed on the available runtime.
