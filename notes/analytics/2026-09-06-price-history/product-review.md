VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- Extend available history with a clearly modeled legacy-to-recorded bridge.
- Keep floating price inspection compact in both chart sizes.
- Move optional comparison behind one disclosure and stabilize origin colors across ranges.
  CONFIDENCE: medium
  SCOPE_ASSESSMENT: mergeable
  VALIDATION_STATUS:
- pnpm test: VALIDATION_PASS (1,449 passed, 14 skipped)
- pnpm check --fail-on-warnings: VALIDATION_PASS
- pnpm lint: VALIDATION_FAIL (17 unrelated baseline formatting files); changed-file ESLint/Prettier: VALIDATION_PASS
- Current-head CI/Codex review: VALIDATION_CI_PENDING

# Product assessment

“Ready” concerns the revised product slice and local verification; it is not automatic merge authorization. Remote CI/review remains separate.

## What was wrong

The PR's initial correctness response crowded the chart with collection/provenance details while removing the early history Reed wanted. Restoring a floating tooltip helped, but the expanded version still repeated the same interval description per origin and obscured the plot. Three different history controls blurred the distinction between recorded prices and estimates.

## Coherent correction

The chart is for comparing origin price levels over time. Its primary interface should answer which origin, which date, and what price. Expansion adds room and selection, not a mandatory audit report. Date/value inspection is identical in both sizes; estimates are marked. A single collapsed explanation owns the comparison switch. Technical evidence remains in this artifact and the deterministic model metadata.

The earlier bridge is a bounded presentation extension, not a raw-data repair. It uses the median of an opening legacy window as a modeled starting level and joins it to the first supported recorded price. It explicitly discards legacy week-to-week cohort movement, including the artificial February/March spike. Later reconstruction and accepted observations are unchanged. Unknown provenance, insufficient legacy dates, or no recorded anchor do not invent a bridge.

## Material tradeoff

The pre-March line is an imposed model, not recovered price movement. Legacy opening levels are retrospective cohort estimates and can themselves be biased. Local replay establishes continuity, provenance, and preservation of later history—not historical accuracy. The uncertainty is why confidence is medium rather than high. Do not use this chart reconstruction as input to market returns, alerts, or forecasting.

This is an acceptable reviewable implementation of the requested continuous estimated overview; not a full supplier-normalized price index. Those are different products and should not silently become prerequisites for this chart PR.

## Independent read-only review

A bounded independent reviewer assessed screenshots/code before implementation and rechecked the revised reconstruction and chart. It found no new blocking runtime/provenance defect. Verified explicit legacy flags, distinct-date minimum, no invented observed counts, no changed post-anchor history, view/range stability, and compact disclosure.

## Visual and empirical proof

See [method, replay results, and screenshots](README.md). One-year mobile inspection reaches November 2025; all five values fit without tooltip scrolling. No horizontal overflow or page errors. Desktop range changes retain origin colors and hover dismisses on leave. No production writes or deployment were performed.
