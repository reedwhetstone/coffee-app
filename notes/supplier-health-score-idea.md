# Supplier Health Score

**Date captured:** 2026-03-29

## Decision: Do not surface score_value in the UI

`score_value` in `coffee_catalog` is scraped from supplier-provided cupping notes. It is not a standardized, cross-comparable metric:

- Different suppliers use different scoring scales
- Many suppliers don't score at all (null rate is high)
- Scores reflect different evaluators, conditions, and methodologies
- Displaying it implies comparability that doesn't exist, misleading users

PR #189 and #197 both attempted to add score badges — both closed without merge.

## Potential: Supplier Health Score

A more reliable scoring surface would be something computed from data reliability and coverage, not supplier-provided cup scores. Possible dimensions:

- **Data completeness:** what % of fields are populated (origin, process, grade, price, tasting notes)
- **Catalog freshness:** how recently did the supplier run a scrape with new arrivals
- **Price consistency:** do prices look reasonable (vs. outliers like $230/lb that distort aggregates)
- **Coverage breadth:** how many origins and processing methods does the supplier cover
- **Response reliability:** scraper error rate over the last N runs

This would be a Purveyors-computed metric, transparent and internally consistent. More useful than surfacing raw cup scores.

## Status

Parked. Not on the near-term roadmap. Document here for future reference.

**Tags:** #ideas #coffee #data-quality #purveyors

## Links

- [[coffee-scraper]] — score_value is a scraped field; supplier health score would be computed from scraper pipeline outputs
- [[purveyors-blog]] — potential future blog post on trust signals and data provenance in coffee markets
