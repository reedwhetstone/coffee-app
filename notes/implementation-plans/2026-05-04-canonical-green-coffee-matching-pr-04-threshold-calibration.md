# PR 04: Matching Threshold Calibration Harness

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Replace guessed similarity thresholds with measured bands for similar profile, likely same bean, and auto-link eligible candidates.

## Why this slice comes now

Identity resolution is dangerous without calibration. The system can show similar alternatives with moderate confidence, but it should not create canonical identities until high-confidence thresholds have evidence behind them.

## In-scope

- Add a small golden-set fixture of known matches, known non-matches, and ambiguous pairs.
- Add an evaluation script or test helper that calls the canonical matching service for each pair.
- Compute precision, recall, false positives, and false negatives across threshold bands.
- Document recommended thresholds in the main plan or a calibration report.
- Add match category constants for downstream use.

## Out-of-scope

- Auto-linking.
- Identity tables.
- UI changes.
- Full ML model training.
- Large manual labeling project.

## Files to change

- `notes/implementation-plans/2026-05-04-canonical-green-coffee-matching-calibration.md`
- `src/lib/server/catalogSimilarity.ts`
- `scripts/` or `src/lib/server/__fixtures__/` for golden-set data
- Targeted tests for categorization rules

## Acceptance criteria

- The repo contains a reproducible calibration harness.
- Threshold bands are documented with rationale.
- The high-confidence band is optimized for precision, not recall.
- Ambiguous pairs are kept out of auto-link eligibility.
- Downstream code can use named categories rather than magic numbers.

## Test plan

- Unit tests for threshold-to-category mapping.
- Script smoke test using fixture data.
- Manual review of false positives before approving auto-link thresholds.

## Risks

- The initial golden set may be too small. Treat it as a safety floor, not a final model benchmark.
- Some true matches may be missed. That is acceptable for auto-linking; recall can improve later through review queue tooling.

## Exact follow-on dependency

PR 05 can use calibrated labels in UI. PR 07 must not auto-link without this calibration.
