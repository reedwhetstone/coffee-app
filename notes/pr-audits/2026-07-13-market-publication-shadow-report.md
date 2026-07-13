# Pre-Submission Red-Team: Market Publication Shadow Report

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
SCOPE_ASSESSMENT: mergeable
```

## Review history

The first pass found three P1 and two P2 defects: synthetic legacy rows and
duplicate segment identities were not rejected, unusable-median days could
escape the gate, pooled-window metrics could hide severe daily divergence, and
human/loader/CLI coverage was incomplete. Commit `7cfeb376` corrected all five.

The final pass found no remaining legitimate findings.

## Validation

- `VALIDATION_PASS: full test suite` — 902 passed, 11 skipped
- `VALIDATION_PASS: focused shadow suites` — 21 passed
- `VALIDATION_PASS: pnpm check --fail-on-warnings` — 0 errors/warnings
- `VALIDATION_PASS: lint, formatting, and diff checks`
- `VALIDATION_PASS: read-only audit` — no RPC or mutation path
- `VALIDATION_PASS: CLI help/argument/missing-environment exit semantics`
- `VALIDATION_BLOCKED_ENV: live shadow query` — real Supabase credentials were
  unavailable in the isolated worktree
