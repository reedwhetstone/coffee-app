# Canonical Green Coffee Matching Calibration

**Date:** 2026-05-05

**Program:** Canonical Green Coffee Matching and Identity Resolution

**Related plan:** `notes/implementation-plans/2026-05-04-canonical-green-coffee-matching-pr-04-threshold-calibration.md`

## Calibration position

This PR establishes a conservative reproducible threshold floor for the beta similarity contract. It does not claim production-grade identity resolution yet. The goal is to prevent downstream UI, scraper, CLI, and identity work from hard-coding magic similarity numbers or treating high scores as accepted identities.

## Named bands

- `below_threshold`: average score below `0.70`; do not surface as a match suggestion.
- `similar_profile`: average score at least `0.70`; useful substitution or discovery lead, not an identity claim.
- `likely_same`: average score at least `0.88`, at least two matched chunks, and origin/processing dimensions at least `0.84` when present.
- `auto_link_candidate`: average score at least `0.94`, at least three matched chunks, and origin/processing dimensions at least `0.90` when present.

`auto_link_candidate` is deliberately named as a candidate state, not an accepted identity state. Identity links still need the reversible schema, audit events, hard blockers, and review policy from later PRs.

## Reproducible harness

The seed fixture lives at:

- `src/lib/server/__fixtures__/catalogSimilarityCalibration.ts`

The CLI smoke harness is:

```bash
pnpm exec tsx scripts/catalog-similarity-calibration.ts
pnpm exec tsx scripts/catalog-similarity-calibration.ts --json
```

The fixture currently encodes score shapes rather than supplier names. This keeps the threshold policy testable without live catalog access. As reviewed live pairs become available, append them to the fixture with source-safe labels and expected bands. The harness reports band counts plus precision, recall, false positives, and false negatives for the auto-link, likely-or-better, and clear non-match rejection policies.

## Current fixture expectations

The seed set includes:

- one high-agreement same-bean shape expected to land in `auto_link_candidate`
- one same-bean shape expected to land in `likely_same`
- one moderate substitute expected to land in `similar_profile`
- three ambiguous false-positive risk shapes expected to stay in `similar_profile`
- two clear non-matches expected to stay `below_threshold`

The acceptance rule for this floor is strict:

- zero false-positive `auto_link_candidate` rows
- zero false-positive likely-or-better rows against non-same-bean examples
- zero clear non-matches escaping the `below_threshold` rejection band
- all fixture examples match their expected band

Low auto-link recall is intentional at this stage. The fixture includes a same-bean shape that should remain `likely_same`, not `auto_link_candidate`, because the first identity policy should optimize precision over recall.

## Product alignment

This supports `notes/PRODUCT_VISION.md` by strengthening the data moat without overclaiming certainty. It also supports ADR-005 because matching remains member/API leverage while the contract becomes safer for future web, CLI, scraper, and agent surfaces.

## Follow-up requirements

Before automatic identity linking ships:

1. Replace or extend synthetic score-shape examples with reviewed live catalog pairs.
2. Add hard blockers for country, process incompatibility, harvest-year conflicts, and blend versus single-origin conflicts.
3. Keep high-confidence auto-link precision above recall. Missed matches are acceptable; poisoned identity links are not.
4. Write accepted, rejected, and superseded states through reversible identity events rather than mutating catalog rows.
