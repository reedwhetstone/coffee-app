# PR 02: Calibration Golden Set and Match Label Audit

**Branch suggestion:** `feat/match-calibration-golden-set`  
**Parent plan:** `2026-05-06-canonical-match-disambiguation-and-performance.md`  
**Purpose:** Measure and tune same-coffee vs similar-recommendation bands after hard gates exist.

## PR goal

Create a small, reviewable calibration harness for canonical matching. The harness should test known same-coffee candidates, known non-matches, and useful similar recommendations against the shared classifier from PR 01.

## Why this slice comes next

Hard gates prevent obvious false identity claims. Calibration then answers the next question: within the gate-passing set, what similarity bands should drive `high_beta`, `medium_beta`, and recommendation ranking?

Do not calibrate before PR 01. Score-only calibration would preserve the wrong layer of the problem.

## Mergeable-slice gate

This PR is mergeable on its own after PR 01. It improves confidence in the shipped API/UI classification without requiring durable identity tables or scraper automation.

## In scope

- Add a fixture or markdown-backed golden set of pair examples:
  - known same / likely same
  - known not-same due to processing or country conflict
  - useful similar recommendations
  - ambiguous / needs-review cases
- Add a test or script that runs the shared classifier against the fixture.
- Document threshold bands and why each band exists.
- Audit API/UI label copy against calibration output.
- Add regression cases for Reed's stated blocker: natural coffee is not washed coffee.

## Out of scope

- Auto-linking identities.
- Large-scale offline evaluation.
- Manual admin review UI.
- Scraper candidate generation.
- Changing supplier data to force tests to pass.

## Files to change

Likely coffee-app files:

- `src/lib/server/catalogSimilarity.ts`
- `src/lib/server/catalogSimilarity.test.ts`
- `notes/matching/` or `notes/pr-audits/` for calibration report output
- Current member comparison component copy tests if present
- API docs or implementation notes describing beta label semantics

## Acceptance criteria

- Golden set includes at least one natural-vs-washed false-positive guard.
- Golden set includes at least one same-origin / same-process high-confidence candidate.
- Golden set includes at least one useful similar recommendation that is explicitly not an identity candidate.
- Classifier output is deterministic and covered by tests.
- Thresholds are documented as beta decision bands, not canonical truth.
- UI/API copy no longer lets users interpret all high similarity as same coffee.

## Test plan

```bash
pnpm check --fail-on-warnings
pnpm run lint
pnpm exec vitest run src/lib/server/catalogSimilarity.test.ts
```

If a standalone calibration script is added:

```bash
pnpm exec tsx scripts/evaluate-canonical-match-golden-set.ts
```

## Risks

- The first golden set may be small and biased. That is fine if the PR labels it as a seed harness and makes adding cases easy.
- Product copy may become too cautious. Prefer trust over excitement; identity claims can strengthen after accepted identity data exists.

## Exact follow-on dependency

PR 03, identity candidate review foundation, should consume the calibrated classifier and persist candidate states with the same reason codes.
