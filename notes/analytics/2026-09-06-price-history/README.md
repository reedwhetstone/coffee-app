# Origin price history — reconstructed trend

[PR #582](https://github.com/reedwhetstone/coffee-app/pull/582), non-draft for preview review. Derived chart presentation only; no production observations, publication thresholds, pricing calculations or database storage change.

## Forest-through-trees assessment

One outcome: make origin prices understandable over the available year without letting collection failures dominate the chart. The earlier revision made the expanded chart a compulsory diagnostics screen and stopped at March, missing that outcome.

The revised hierarchy:

- Dashboard: price chart, range, legend, compact floating date/value card, “Includes estimates.”
- Expanded: more plot area and origin selection, the same compact card.
- Collapsed **About this data**: explanation and optional **Recorded prices** comparison.
- This artifact: algorithm parameters, provenance limitations, replay and review receipts.

Removed repeated per-origin evidence in tooltips, prominent reconstruction controls, synthetic-checkbox-inside-recorded mode, duplicated expanded subtitle, cumulative sample counts in the selector, and always-visible date slider. Keyboard inspection still reveals the slider on focus. Origin colors use full-input ranking, independent of the chosen display range. Average fallback remains explicitly marked `avg.`; estimates use `est.`. Recorded mode is explicit non-synthetic published prices, with original gaps.

## Versioned method: supported-median-legacy-bridge-v2

Owner/lifetime: coffee-app owns deterministic presentation derived from the current entitled Parchment history response. No new shared upstream index or persisted reconstructed series. Runtime uses actual upstream provenance restored by this PR, never a date-based provenance guess.

For each origin and purchase cohort, on the full entitled history before cropping:

1. Recorded anchors require a valid UTC date, positive finite median, explicit `synthetic=false`, at least two listings, one supplier, and five usable observations within ±28 days. Listing and supplier counts must each reach 60% of that local median baseline. Conflicting duplicates cannot anchor.
2. Preserve every accepted median exactly, including supported sharp price changes. Interpolate elapsed UTC days between anchors. Preserve original rejected records and bracketing metadata in the derived model, not in compulsory hover copy. Never extend past the last supported anchor.
3. Earlier **explicit synthetic legacy** rows do not describe historical market movements: the old backfill priced historical catalog memberships using later catalog prices. Do not reuse their weekly trajectory.
4. If at least five distinct usable legacy dates exist in the first 35-day window, use their median price as an opening **modeled level**. A linear bridge joins the earliest usable legacy date/level to the first supported recorded date/price. Every earlier point, including the starting level, is `historical_estimate`; its metadata identifies baseline dates/value and joining interval. It has no invented sample count or recorded original.
5. No legacy evidence, insufficient opening evidence, or no supported recorded endpoint means no earlier bridge. Unknown provenance cannot supply either endpoint. Retail and wholesale never mix. Dates before the first available usable legacy record remain outside the chart; the five-origin replay begins September 20, not September 6.

The early bridge is a conservative model choice, **not a validated estimate of true historical prices**. Its slope is imposed by its endpoints; it does not recover repricing, shocks, or seasonal movement. The legacy level itself may have retrospective cohort bias. This choice trades unavailable temporal detail for a continuous, explicitly modeled overview. It must not feed return calculations, alerts, forecasting, or other pricing products as observed history. A future evidence-rich early history could use genuine dated historical quotes or an explicitly calibrated external index; that is not claimed here.

Likewise, later count support is a coverage-collapse heuristic, not full supplier-mix normalization. Persistent composition changes can escape it. No confidence intervals or recoverable daily movement are asserted.

## Evidence and reproducible replay

[Original read-only audit](evidence.md) distinguishes observed facts from hypotheses. The matched-supplier image remains a rejected experiment, not the current method.

```sh
pnpm exec tsx notes/analytics/2026-09-06-price-history/validate-reconstruction.ts
pnpm exec tsx notes/analytics/2026-09-06-price-history/validate-earlier-history.ts
```

- [Published fixture](fixtures/published-medians.json): five retail origins, March 22–September 5. Authorized browser aggregate export; `synthetic=false` annotated from the prior read-only era audit because the deployed BFF omits provenance. Not a new row-level provenance audit.
- [Legacy fixture](fixtures/legacy-medians.json): September 20–March 14 aggregate-only rows for the same origins, freshly exported from the authorized analytics browser September 6 UTC. `synthetic=true` annotated from that same era audit. No account data or credentials. Neither fixture is bundled into production.
- [Earlier replay](earlier-history-results.jsonl): all five series add 183 modeled days, remain daily-continuous, and preserve the entire March-onward reconstruction exactly. Brazil opening 9.48 → first observed 9.45; Colombia 9.675 → 10.53; Ethiopia 10.09 → 9.98; Guatemala 10.10 → 10.92; Indonesia 9.885 → 10.00. These are model endpoint receipts, not accuracy scores.
- [Observed-era holdouts](validation-results.jsonl): July dropout spike removed at 50/60/70% support sensitivity without moving accepted medians. Individual-date median errors 0–0.42% (worst 5.16%); one contiguous 41-observation-block median errors 0–1.31% (worst 3.47%). These compare with withheld published medians, not actual August or pre-March movement. The v2 earlier-history replay proves later output is unchanged.

Behavior tests cover dropout replacement, preservation of supported changes, UTC interpolation, cohort isolation, missing/invalid provenance, ambiguous duplicates, earlier robust median under an outlier, insufficient legacy support, no synthetic-only reconstruction, no invented historical counts, no input mutation, and unchanged recorded-era output.

## Visual review

Local fixture replay uses the actual EvidenceChartsSection/ExpandablePanel and OriginLineChart, not an authenticated deployment. Temporary fixture route removed before checks/push.

- [One-year dashboard](mobile-year-simplified.png)
- [Earlier date tooltip](mobile-year-tooltip.png)
- [Expanded mobile](mobile-expanded-simplified.png)
- [Optional data controls](mobile-data-options.png)
- [Desktop expanded hover](desktop-year-simplified.png)

390×844 mobile: one-year selection starts September 20, November 29 inspection returns five estimated prices, both floating cards are 185px tall with no internal scroll and fit inside the viewport. No horizontal overflow or page errors. Recorded/trend comparison and dismissal work. Desktop: colors unchanged across 90-day/one-year ranges; hover clears on leave. Older images are superseded iterations.

## Handoff

No merge or deployment. This remains one bounded, reviewable PR: full available-history presentation plus useful inspection. It is not a price-data backfill or a normalized market index. Current-head CI/Codex review is handed off separately.

## Final local validation

- `pnpm test`: 1,449 passed, 14 skipped; 201 files passed, 2 skipped.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=static-placeholder OPENROUTER_API_KEY=static-placeholder pnpm check --fail-on-warnings`: zero errors/warnings. Non-secret placeholders prove static typing, not authenticated runtime.
- `pnpm lint`: blocked by the same 17 unrelated baseline formatting files. Changed-file ESLint/Prettier pass; `git diff --check` passes.
- Initial regression run exposed four obsolete UI assertions; updated tests now verify compact inspection, recorded gaps, modeled-history exclusion, and optional disclosure. Final suite passes.
