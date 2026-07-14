# Pre-submission audit: CLI consent POST origin

## Verdict

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

## Intent

Allow the owned `https://purveyors.io` apex origin to submit the first authenticated form
POST after Vercel canonicalizes the CLI consent route to `https://www.purveyors.io`, while
retaining SvelteKit's CSRF rejection for every unrelated origin.

## Findings

No legitimate P0, P1, P2, or P3 findings.

The allowlist uses exact serialized-origin matching and contains only the controlled apex
domain. The CLI approval action still requires an authenticated session and Parchment's
signed, one-time authorization request. The configuration regression test prevents wildcard
broadening or the accidental addition of unrelated origins.

## Validation

- `pnpm exec vitest run src/svelte-config.test.ts src/routes/auth/cli/page.server.test.ts`: 18 tests passed
- `pnpm check`: 0 errors and 0 warnings
- `pnpm build`: passed
- Production-mode local preview: `Origin: https://purveyors.io` reached the action; `Origin: https://evil.example` returned SvelteKit's 403 CSRF rejection
- `pnpm test` in independent review: passed
- `git diff --check origin/main...HEAD`: passed
