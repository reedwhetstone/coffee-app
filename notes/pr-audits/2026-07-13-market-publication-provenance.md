# Pre-Submission Red-Team: Market Publication Provenance Foundation

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

## Review history

The first pass found four P1 and three P2 defects in the initial DDL: OLD/NEW
parent-move escapes, sealing races, incomplete-set eligibility, mutable cohort
history, weak lifecycle enforcement, and impossible aggregate values. Commit
`2b652a9b` corrected them and added executable behavioral SQL.

The second pass found two P1 and two P2 gaps: unknown-completeness sets remained
eligible, input age was caller-forgeable, rejected artifacts remained mutable,
and concurrency was not proven by a real two-session test. Commit `a5f87ff5`
corrected all four and added a reproducible PostgreSQL concurrency harness.

The final pass found no remaining legitimate findings.

## Validation

- `VALIDATION_PASS: pnpm run verify:market-publication-migration`
- `VALIDATION_PASS: pnpm run verify:market-publication-concurrency`
- `VALIDATION_PASS: executable SQL behavior suite against local PostgreSQL`
- `VALIDATION_PASS: pnpm run check`
- `VALIDATION_PASS: bash -n scripts/verify-market-publication-concurrency.sh`
- `VALIDATION_PASS: git diff --check`

The concurrency harness used independent PostgreSQL sessions to prove that
observation completion and publication sealing serialize against stale child
writes, which wait and then reject.
