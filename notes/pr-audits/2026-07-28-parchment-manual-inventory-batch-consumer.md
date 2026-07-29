# Parchment manual inventory batch consumer pre-submission audit

## Intent

Replace coffee-app's human manual multi-row creation flow with one published
Parchment atomic batch request. Preserve the current beans-page projection,
catalog-backed creation, and the established scalar manual compatibility
contract.

## Scope

- The coffee-app form sends all manual rows in one atomic Parchment batch.
- Parchment allocates shared tax and shipping in exact cents.
- The browser retains only the batch UUID needed to reconcile an uncertain
  result.
- The UUID survives form dismissal and remains present for retryable
  authentication, service, rate-limit, and idempotency-in-progress responses.
- The BFF projects Parchment resources into the existing beans-page shape.
- Catalog-backed creation stays unchanged.
- The scalar manual payload remains on its prior compatibility path because it
  accepts fields that the published Parchment batch schema does not represent.

## Gate result

The first independent gate found two P1 continuity defects: scalar manual
callers fell through to a 400, and form dismissal discarded an uncertain batch
UUID. The second gate found two remaining P1s: retryable authentication and
idempotency-in-progress responses cleared that UUID, and the scalar adapter
dropped accepted fields and changed the success status. The final patch
preserves the scalar route unchanged and classifies reconciliation outcomes by
status and structured Parchment error code.

The lifecycle gate remains blocked. With `@purveyors/sdk@0.19.0`, a reload or
remount can reconcile the retained UUID while the original batch POST is still
in flight. Parchment can return a temporary 404 before that POST commits, and
the current client then clears the UUID even though the batch may later be
committed. Coffee-app must not paper over that distributed transaction race in
the BFF or browser. Parchment PR #147 must first provide a durable, typed
accepted/in-progress lifecycle and the SDK must publish it as `0.20.0`; this
PR can then consume that contract and add the overlap coverage.

```text
VERDICT: blocked
P0/P1/P2/P3: 0/1/0/0
NEXT_ACTION: blocked
CONFIDENCE: high
SCOPE_ASSESSMENT: blocked by upstream lifecycle prerequisite
```

## Validation

- `VALIDATION_PASS` 44 focused route, adapter, documentation, and UI tests
- `VALIDATION_PASS pnpm test` (1010 passed; 11 skipped by suite configuration)
- `VALIDATION_PASS pnpm check --fail-on-warnings` (zero errors and zero warnings)
- `VALIDATION_PASS` targeted ESLint and Prettier
- `VALIDATION_PASS pnpm build`
- `VALIDATION_PASS git diff --check`
- `VALIDATION_FAIL pnpm lint` because 18 unrelated pre-existing Markdown files
  do not match Prettier; all changed files pass targeted Prettier and ESLint
