# PR Audit Rerun: fix/v1-catalog-stocked-days-contract

**Date:** 2026-04-13
**PR:** #261
**Branch:** `fix/v1-catalog-stocked-days-contract`
**Base:** `origin/main`
**Intent:** Re-verify that malformed `stocked_days` values are strictly rejected by the canonical `/v1/catalog` contract, that valid values still pass through, and that the deprecated `/api/catalog-api` alias preserves canonical behavior plus legacy deprecation headers.

## Documents reviewed
- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`

## Changed files reviewed
- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts`
- `src/routes/api/catalog-api/+server.ts` (context)

## Product and architecture alignment
This rerun stays aligned with the product vision and ADR-002.

Why:
- It tightens a public API contract instead of silently coercing malformed input into different semantics.
- The fix remains centralized in the canonical `/v1/catalog` handler, which is the right API-first shape.
- The deprecated `/api/catalog-api` route still behaves as a thin delegating alias with deprecation headers, matching ADR-002.

## What changed relative to the prior failing audit
The implementation now adds a whole-string digit guard before parsing optional positive integers:

- `parseOptionalPositiveInteger(value)` now returns `undefined` unless `value` matches `/^\d+$/`
- `validateCatalogQuery(url)` rejects any present `stocked_days` whose parsed value is `undefined`
- this means malformed values like `abc`, `-1`, `3.5`, `0`, and `7abc` now fail validation before search execution

## Correctness assessment
### Confirmed good
1. **Malformed `stocked_days` values are now strictly rejected at the canonical layer.**
   Evidence: `parseOptionalPositiveInteger()` now rejects non-digit tokens before conversion, and `validateCatalogQuery()` throws `CatalogQueryValidationError` when parsing fails.

2. **Acceptance criteria cases are satisfied in code.**
   - `abc` → fails regex, returns structured 400
   - `-1` → fails regex, returns structured 400
   - `3.5` → fails regex, returns structured 400
   - `7` → passes regex, parses to `7`, remains valid

3. **Structured error format is preserved.**
   Canonical tests assert the existing response shape:
   - `error: 'Invalid query parameter'`
   - `message: 'Query parameter "stocked_days" must use positive integer format'`
   - `details: { parameter, value, expected }`

4. **Legacy alias behavior remains canonical plus deprecation headers.**
   `/api/catalog-api/+server.ts` still delegates to `buildCanonicalCatalogResponse(...)` and wraps returned headers with `Deprecation`, `Link`, and `Sunset`.

5. **The slice remains independently mergeable.**
   No missing prerequisite work surfaced. This is still a tight contract repair in the shared handler.

## Test review
### Good
- Canonical tests now cover representative malformed values including `abc`, `-1`, `3.5`, `0`, and `7abc`
- Canonical tests assert the full structured 400 payload and confirm no search execution on invalid input
- Alias tests assert that upstream `stocked_days` 400 responses are preserved while legacy deprecation headers are added

### Minor note
- There is no explicit positive-path test added for `stocked_days=7`, but the implementation path is straightforward and the regression target here was malformed-input rejection. This is not blocking.

## Validation
### Code inspection
- `VALIDATION_PASS`: reviewed the diff and surrounding handler/test context
- `VALIDATION_PASS`: direct parser check confirms behavior for `abc`, `-1`, `3.5`, `0`, `7abc`, `7`, and `007`

### Automated execution
- `VALIDATION_BLOCKED_ENV`: `pnpm exec vitest run src/lib/server/catalogResource.test.ts src/routes/api/catalog-api/catalog-api.test.ts`
  - failed due to an existing workspace/test-resolution issue unrelated to this PR: Vitest attempted to resolve `@testing-library/svelte/src/vitest.js` from `/root/.openclaw/workspace/worktrees/coffee-app-public-homepage-contract-suite/...`, and the file was missing there
- `VALIDATION_BLOCKED_ENV`: `pnpm run verify:catalog-http-contract`
  - repo script requires a deploy host argument and `PURVEYORS_API_KEY`; the bare script command does not run locally without those inputs

These blockers prevent claiming a clean local automated pass in this environment, but they do not undermine the code-level acceptance review for this slice.

## Findings
No product or architecture defects found in the patched implementation.

## Mergeability judgment
Merge-ready.

Reason: the prior blocking issue is fixed, the canonical validation is now strict for malformed `stocked_days` values, alias behavior remains consistent with ADR-002, and no new contract drift was found.

## Operator summary
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 1
NEXT_ACTION: merge
TOP_FIXES:
- None required for this PR’s contract fix
- Optional: add an explicit positive-path test for `stocked_days=7` to make the acceptance criterion visible in tests
- Optional: repair the repo’s local Vitest workspace resolution so targeted verification can run cleanly
