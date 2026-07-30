# Roast chart settings Parchment cutover

## Verdict

- VERDICT: ready
- P0/P1/P2/P3: 0/0/0/0
- NEXT_ACTION: merge
- CONFIDENCE: high
- SCOPE_ASSESSMENT: mergeable

## Intent

Replace only `/api/roast-chart-settings` GET's direct Supabase read with the
deployed owner-scoped Parchment roast-detail contract. Preserve the legacy
settings envelope, authentication and roast ID validation behavior, and HTTP 200
`{ "settings": null }` degradation on upstream failure.

## Review

The independent pre-submission reviewer found no legitimate P0, P1, P2, or P3
issues. The route retains its existing user check and `parseInt` validation,
constructs a session-mode Parchment client only after those gates, maps all six
nullable chart fields into the unchanged range-tuple envelope, and keeps the
existing catch boundary for not-found, configuration, response, and network
failures.

The slice is independently mergeable and advances the API-first boundary without
changing chart consumers, roast writes, or other roast reads.

## Validation

- `pnpm test`: 1,071 passed, 11 skipped
- `pnpm check`: 0 errors, 0 warnings
- Focused ESLint and Prettier checks: passed
- `pnpm build`: passed
- `git diff --check origin/main...HEAD`: passed
