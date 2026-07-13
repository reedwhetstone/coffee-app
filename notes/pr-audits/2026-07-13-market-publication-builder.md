# Pre-Submission Red-Team: Market Publication Builder

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

The first pass found eight P1 defects spanning migration ordering, policy
evolution, configuration locking, observation timestamps, unknown stock,
movement predecessor stability, assortment decomposition, and unfenced lease
expiry. Commit `678b76fe` corrected them with executable PostgreSQL behavior
and concurrency coverage.

The second pass found two remaining P1 defects: direct insertion of a complete
known observation set could bypass fenced completion, and a child-row lock
introduced a cohort configuration deadlock. Commit `029f6438` enforced the
open-first lifecycle and removed the lock inversion, with a real two-session
builder/configuration test.

The final pass found no remaining legitimate findings.

## Validation

- `VALIDATION_PASS: pnpm run verify:market-publication-builder`
- `VALIDATION_PASS: sorted real-PostgreSQL migration replay`
- `VALIDATION_PASS: publication behavior and lifecycle SQL suite`
- `VALIDATION_PASS: fenced lease concurrency`
- `VALIDATION_PASS: same-date and adjacent-date builder concurrency`
- `VALIDATION_PASS: foundation immutability races`
- `VALIDATION_PASS: pnpm check --fail-on-warnings`
- `VALIDATION_PASS: shell syntax, Prettier, and git diff checks`
