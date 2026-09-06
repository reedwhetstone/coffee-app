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

Removed generated sensory scores/radar data rather than presenting enrichment as measured tasting. The shortlist is not a bargain ranking. Full-bag terms and unconfirmed small-bag availability distinguish wholesale and home-roaster usefulness.

The buying shortlist uses a normal reader section because `coffee-highlights` body text is omitted by the current web renderer in favor of frontmatter cards. Thus purchasing caveats remain visible on web as well as reader/email projections. Cards summarize the same offers. The shared card caption now speaks to readers rather than describing generation order.

Merge publishes the web edition; this correction neither creates nor sends an email. Generated packet/draft recovery state was not mutated. Review the current PR head, not the original article hash, before publication.

## Validation

- `pnpm check --fail-on-warnings`: passed with repo-local placeholder static env (including `OPENROUTER_API_KEY`); zero errors/warnings. No credential copying.
- `pnpm lint`: blocked by formatting failures in 17 untouched Markdown files; ESLint stage did not run in that combined command.
- `pnpm test src/lib/server/marketBriefEmail.test.ts src/lib/server/marketBriefDeployment.test.ts src/lib/components/blog/MarketBriefArticle.svelte.test.ts`: 33 passed, including every published edition through email projection.
- Actual local route inspected in headless installed Chrome: reader copy read independently at 1280px; 390px mobile document width equals viewport (no horizontal overflow). Full purchasing caveats, corrected sourcing and pending auction status are visible. Local development rendering is not Vercel production verification.
- No full E2E or production build was needed for this editorial/caption correction. Node 24.19.0 differs from the repo's declared Node 22; checks above passed on the available runtime.
