# PR Audit: fix/v1-catalog-stocked-days-contract

**Date:** 2026-04-13
**PR:** #261
**Branch:** `fix/v1-catalog-stocked-days-contract`
**Base:** `origin/main`
**Intent:** Restore the documented `/v1/catalog` contract for `stocked_days` by rejecting malformed values with a structured 400, and preserve that behavior on the deprecated `/api/catalog-api` alias.

## Documents reviewed

- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`

## Changed files reviewed

- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts`

## Product and architecture alignment

This slice aligns with the product vision and ADR-002.

Why:

- It strengthens the API contract instead of letting malformed inputs silently degrade into broad queries.
- It keeps behavior centralized in the canonical `/v1/catalog` handler and preserves the delegating legacy alias behavior, which is exactly what ADR-002 calls for.
- It improves consistency across external API consumers and legacy callers without introducing surface-specific logic.

## What changed

The implementation adds `stocked_days` validation in `validateCatalogQuery(url)`:

- if `stocked_days` is present and `parseOptionalPositiveInteger(...)` returns `undefined`, the handler throws `CatalogQueryValidationError('stocked_days', value, 'positive integer')`
- the existing canonical error handling converts that into the structured 400 response shape already used for invalid `stocked_date`
- the legacy `/api/catalog-api` delegate keeps adding deprecation headers while passing through the canonical 400 response

## Correctness assessment

### Confirmed good

1. **Canonical `/v1/catalog` now rejects malformed `stocked_days`.**
   Evidence: `validateCatalogQuery()` now checks `stocked_days` before parsing the rest of the request.

2. **Structured error format is preserved.**
   Evidence: existing `CatalogQueryValidationError` handling returns:

   - `error: 'Invalid query parameter'`
   - human-readable `message`
   - `details: { parameter, value, expected }`

3. **Legacy alias behavior remains canonical plus deprecation headers.**
   Evidence: `/api/catalog-api/+server.ts` still delegates to `buildCanonicalCatalogResponse(...)` and merges legacy headers onto the returned response.

4. **The slice is independently coherent.**
   No hidden prerequisite work appears required. This is a self-contained contract repair in the shared canonical layer.

## Defects found

### P1: `stocked_days=3.5` is still accepted as `3`, not rejected

**Severity:** P1
**Status:** Confirmed defect

**Why this is real:**
`validateCatalogQuery()` uses `parseOptionalPositiveInteger(stockedDays) === undefined` as the validation check. But `parseOptionalPositiveInteger()` uses `Number.parseInt(value, 10)`, which truncates decimal strings.

Examples:

- `Number.parseInt('3.5', 10) === 3`
- `Number.parseInt('7abc', 10) === 7`

So the acceptance criterion `GET /v1/catalog?stocked_days=3.5 returns 400` is not actually satisfied by the current implementation.

**Impact:**
The endpoint still silently coerces malformed values into different valid values for some inputs. That is exactly the contract violation this PR is trying to remove.

**Recommended fix:**
Use strict positive-integer validation for request strings before numeric conversion, for example with a regex like `/^[1-9]\d*$/`, or parse with `Number(value)` plus integer checks.

## Test adequacy

### Good

- Canonical tests cover representative invalid values: `abc`, `-1`, `3.5`, `0`
- Canonical tests verify the structured 400 body and no search delegation on invalid input
- Legacy tests verify that 400s still preserve deprecation headers

### Gap / concern

- The new tests are directionally correct, but based on the implementation reviewed, the `3.5` case should currently fail. That suggests the test suite was not successfully executed for this PR in the audited environment, or the invocation used here could not validate it.
- There is no explicit test for malformed mixed strings such as `7abc`, which the current parser would also incorrectly accept.

## Validation

### Code inspection

- `VALIDATION_PASS`: diff and surrounding implementation review completed

### Test execution

- `VALIDATION_BLOCKED_ENV`: attempted command
  - `pnpm test -- --run src/lib/server/catalogResource.test.ts src/routes/api/catalog-api/catalog-api.test.ts`
- Result:
  - command invocation was malformed for this repo's scripts and launched Vitest in watch mode with broad suite discovery instead of a clean targeted run
  - run then failed due to an environment / workspace-path issue unrelated to this PR's logic: missing test dependency resolution from `/root/.openclaw/workspace/worktrees/coffee-app-public-homepage-contract-suite/.../@testing-library/svelte/src/vitest.js`
- Because of that, this audit cannot claim a clean local test pass.

## Mergeability judgment

Not merge-ready yet.

Reason: one acceptance criterion is not met in the implementation as written. The slice boundary itself is fine; it just needs a small same-PR patch to make validation strict.

## Recommended next action

Patch this PR, not rescope it.

Suggested patch shape:

1. Replace `parseInt`-based validation for `stocked_days` with strict whole-string positive integer validation
2. Add one more regression test for a mixed token like `stocked_days=7abc`
3. Re-run the targeted tests with the correct non-watch Vitest invocation for this repo

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 0
P3: 1
NEXT_ACTION: patch_same_pr
TOP_FIXES:

- Reject decimal `stocked_days` values strictly; `3.5` currently parses as `3`
- Consider adding a regression test for mixed tokens like `7abc`, which `parseInt` also accepts
- Re-run the targeted tests with a correct non-watch command after fixing the validation logic
