# Pre-submission re-review: Parchment API usage cutover

**Date:** 2026-07-26  
**Base:** `origin/main` (`ecff4ad22f4b44421bdd3d295b9f1fc83b4481f8`)  
**Head:** `6d53fa590383a35eec3a906647d3941eeadd161d`  
**Verdict:** Ready

## Executive assessment

The focused closure patch resolves the final P2 without introducing a new
defect. Recent status classification now lives in the mapper, uses explicit
non-null predicates for success and error, and treats null status as pending.
The Svelte page renders those precomputed success, error, and pending counts
instead of relying on JavaScript coercion. A nullable-status fixture directly
asserts the corrected classification.

All prior findings are closed:

- Highest-key quota is derived only with complete key coverage. Incomplete key
  coverage suppresses quota claims and alerts while preserving exact aggregate
  totals.
- Every returned daily row renders, and normal recent-per-key sampling is
  disclosed separately from window-series and key-list truncation.
- Loader errors, no-active-key state, total keys, and active keys are presented
  truthfully from canonical summary fields.
- Pending recent reservations are no longer shown as successful requests.

The slice is independently mergeable, aligned with Accepted ADR-007 and the
canonical product direction, and leaves no legitimate P0/P1/P2/P3 findings.

## Final closure evidence

- `src/lib/data/api-usage.ts` exposes
  `recentSuccessRequests`, `recentErrorRequests`, and
  `recentPendingRequests`.
- Success requires `statusCode !== null && statusCode < 400`.
- Error requires `statusCode !== null && statusCode >= 400`.
- Pending requires `statusCode === null`.
- `src/routes/api-dashboard/usage/+page.svelte` renders only these mapper-owned
  counts and conditionally displays pending activity.
- `src/lib/data/api-usage.test.ts` includes a canonical
  `statusCode: null`/`responseTimeMs: null` recent record and asserts
  success `1`, error `0`, pending `1`.

## Architecture and safety

- SDK `0.16.0` remains behind the session-mode Parchment BFF client.
- Exact aggregates remain separate from bounded presentation series and
  per-key quota state.
- No key secrets are added to the view model.
- Direct duplicated usage readers remain deleted with no callers, while
  API-key validation, metering writes, and enforcement remain intact.
- No Accepted ADR divergence or wrong-boundary work remains.

## Validation

- `git diff --check 79bd6056..6d53fa59` — **VALIDATION_PASS**
- Parent focused suite — **VALIDATION_PASS** (11 tests)
- Parent full suite — **VALIDATION_PASS** (975 tests)
- Parent targeted lint/format — **VALIDATION_PASS**
- Parent Svelte/type check — **VALIDATION_PASS** (0 errors, 0 warnings)
- Parent build — **VALIDATION_PASS**
- Parent full diff check — **VALIDATION_PASS**
- Parent direct-boundary scan — **VALIDATION_PASS**

The reviewer also inspected the complete `79bd6056..6d53fa59` patch and the
current mapper, Svelte consumer, and mapper tests. The patch is narrow and
faithfully closes the remaining nullable-status failure scenario.
