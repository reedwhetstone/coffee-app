# Canonical Green Coffee Matching Calibration

**Date:** 2026-05-05

**Updated:** 2026-05-07 after the bounded hard-gated similar API landed

**Program:** Canonical Green Coffee Matching and Identity Resolution

**Related plans:**

- `notes/implementation-plans/2026-05-04-canonical-green-coffee-matching-pr-04-threshold-calibration.md`
- `notes/implementation-plans/2026-05-06-canonical-match-disambiguation-and-performance-pr-02-calibration-golden-set.md`

## Calibration position

This PR establishes a conservative reproducible threshold floor for the beta similarity contract. It does not claim production-grade identity resolution yet, and it does not introduce accepted identity links.

After the hard-gated classifier landed, calibration must measure two layers:

1. Score-only bands that keep similarity numbers named and reviewable.
2. The shared hard-gated classifier that blocks identity claims when structured country, process, decaf, blend, harvest-year, or evidence requirements fail.

The route-level API still returns beta recommendations. `auto_link_candidate` is deliberately a calibration band, not a product state or accepted identity claim.

## Named score bands

- `below_threshold`: average score below `0.70`; not enough score evidence for a normal match suggestion.
- `similar_profile`: average score at least `0.70`; useful substitution or discovery lead, not an identity claim.
- `likely_same`: average score at least `0.88`, at least two matched chunks, and origin/processing dimensions at least `0.84` when present.
- `auto_link_candidate`: average score at least `0.94`, at least three matched chunks, and origin/processing dimensions at least `0.90` when present.

The shared classifier can still downgrade a high score to `similar_recommendation` when hard blockers or insufficient structured evidence exist. This is the important post-PR347 correction: score calibration is an input, not the source of truth for identity eligibility.

## Reproducible harness

The seed fixture lives at:

- `src/lib/server/__fixtures__/catalogSimilarityCalibration.ts`

The CLI smoke harness is:

```bash
pnpm exec tsx scripts/catalog-similarity-calibration.ts
pnpm exec tsx scripts/catalog-similarity-calibration.ts --json
```

The fixture currently encodes source-safe pair shapes rather than supplier names. This keeps the threshold policy testable without live catalog access. As reviewed live pairs become available, append them to the fixture with source-safe labels and expected score band plus expected hard-gated classifier output.

The harness reports:

- score-band counts
- classifier kind counts
- precision, recall, false positives, and false negatives for auto-link bands, likely-or-better bands, hard-gated canonical candidates, and clear non-match rejection

## Current fixture expectations

The seed set includes:

- one high-agreement same-bean shape expected to land in `auto_link_candidate` and hard-gated `canonical_candidate`
- one same-bean shape expected to land in `likely_same` and hard-gated `canonical_candidate`
- one moderate substitute expected to land in `similar_profile` and remain a `similar_recommendation`
- three ambiguous false-positive risk shapes expected to stay out of hard-gated canonical candidate output
- two clear non-matches expected to stay `below_threshold` and remain blocked recommendations

The acceptance rule for this floor is strict:

- zero false-positive `auto_link_candidate` rows
- zero false-positive likely-or-better rows against non-same-bean examples
- zero false-positive hard-gated `canonical_candidate` rows against non-same-bean examples
- zero clear non-matches escaping the `below_threshold` rejection band
- all fixture examples match their expected score band and classifier output

Low auto-link recall is intentional at this stage. The fixture includes a same-bean shape that should remain `likely_same`, not `auto_link_candidate`, because the first identity policy should optimize precision over recall.

## Product alignment

This supports `notes/PRODUCT_VISION.md` by strengthening the data moat without overclaiming certainty. It also supports ADR-005 because matching remains member/API leverage while the contract becomes safer for future web, CLI, scraper, and agent surfaces.

## Follow-up requirements

Before automatic identity linking ships:

1. Replace or extend source-safe pair-shape examples with reviewed live catalog pairs.
2. Keep hard blockers for country, process incompatibility, decaf, harvest-year, and blend versus single-origin conflicts in the shared classifier.
3. Keep high-confidence auto-link precision above recall. Missed matches are acceptable; poisoned identity links are not.
4. Write accepted, rejected, and superseded states through reversible identity events rather than mutating catalog rows.
