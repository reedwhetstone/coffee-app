# Classify-roast API-key auth pre-submission audit

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: correct_boundary

The route now accepts owner-bound member API-key principals while retaining cookie-session trusted-mutation enforcement and existing bearer-session behavior. API-key owner entitlement lookup fails closed.

Validation:

- `pnpm exec vitest run src/lib/server/auth.test.ts`: VALIDATION_PASS, 9/9.
- `pnpm lint`: VALIDATION_PASS.
- `pnpm check`: VALIDATION_PASS, 0 errors and 0 warnings.
- `git diff --check`: VALIDATION_PASS.
