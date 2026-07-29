# Parchment profit consumer pre-submission audit

Date: 2026-07-29
Branch: `feat/parchment-profit-consumer`
Base: `origin/main`

## Scope

Move only coffee-app `GET /api/profit` profit-summary reads from the retired direct-Supabase helper to the deployed `@purveyors/sdk` 0.21.0 profit contract. Preserve cookie-session authority, the `{ sales, profit }` envelope, legacy omission of missing names and dates, and existing sale reads and mutations.

## Final verdict

```text
VERDICT: ready
P0/P1/P2/P3: 0/0/0/0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

No legitimate defects were found.

## Validation

- `pnpm test`: 1,056 passed, 11 skipped.
- Focused profit adapter, route, and boundary tests: passed.
- `pnpm check --fail-on-warnings` with documented placeholder environment exports: 0 errors and 0 warnings.
- `pnpm build` with documented placeholder environment exports: passed.
- Targeted ESLint and changed-file Prettier checks: passed.
- `git diff --check origin/main...HEAD`: passed.
- Repository-wide `pnpm lint`: blocked by 18 unchanged, pre-existing Markdown formatting failures; no changed file was implicated.

Validation ran on Node 24.18.0 while the repository declares Node 22.x.

## Boundary evidence

- The route retains its cookie-session-only guard and session-mode Parchment client.
- The adapter exhausts owner summaries through the shared progress-checked pagination helper and deduplicates by inventory ID.
- Canonical `null` name and date values map to `undefined`, preserving the legacy serialized response.
- The deleted data module contained only the obsolete direct-Supabase profit query; no imports or references remain.
- Package and lockfile resolve `@purveyors/sdk` 0.21.0.
